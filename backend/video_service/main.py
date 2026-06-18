from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse 
import torch
import torch.nn as nn
import numpy as np
import cv2
import tempfile
import os
from dataclasses import dataclass
from typing import List
from einops import rearrange
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
import matplotlib
matplotlib.use('Agg')   # headless — no display needed
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import io, base64
from PIL import Image
from groq import Groq
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../.env")
groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config (must match what the model was trained with) ───────────────────────
@dataclass
class Config:
    frames_per_clip: int   = 16
    frame_stride:    int   = 3
    face_size:       int   = 224
    face_margin:     float = 0.15
    spatial_backbone: str  = 'efficientnet_b4'
    vit_backbone:     str  = 'vit_base_patch16_224'
    fusion_dim:       int  = 512
    lstm_hidden:      int  = 256
    lstm_layers:      int  = 2
    num_heads:        int  = 8
    dropout:          float = 0.5

CFG = Config()
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# ── Model Architecture (must mirror the notebook exactly) ─────────────────────
import timm

class SpatialEncoder(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.backbone = timm.create_model(cfg.spatial_backbone, pretrained=False,
                                          num_classes=0, global_pool='avg')
        self.out_dim  = self.backbone.num_features
        self.norm     = nn.LayerNorm(self.out_dim)

    def forward(self, x):
        return self.norm(self.backbone(x))


class FrequencyEncoder(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.backbone = timm.create_model(cfg.vit_backbone, pretrained=False,
                                          num_classes=0, img_size=cfg.face_size)
        self.out_dim  = self.backbone.num_features
        self.norm     = nn.LayerNorm(self.out_dim)

    def forward(self, x):
        return self.norm(self.backbone(x))


class TemporalEncoder(nn.Module):
    def __init__(self, in_dim, hidden, layers, dropout):
        super().__init__()
        self.lstm    = nn.LSTM(in_dim, hidden, num_layers=layers,
                               batch_first=True, bidirectional=True,
                               dropout=dropout if layers > 1 else 0.0)
        self.out_dim = hidden * 2

    def forward(self, x):
        out, _ = self.lstm(x)
        return out[:, -1, :]


class CrossAttentionFusion(nn.Module):
    def __init__(self, dim_a, dim_b, fdim, heads):
        super().__init__()
        self.proj_a = nn.Linear(dim_a, fdim)
        self.proj_b = nn.Linear(dim_b, fdim)
        self.attn   = nn.MultiheadAttention(fdim, heads, dropout=0.1, batch_first=True)
        self.norm_a = nn.LayerNorm(fdim)
        self.norm_b = nn.LayerNorm(fdim)
        self.ff     = nn.Sequential(
            nn.Linear(fdim * 2, fdim), nn.GELU(), nn.Dropout(0.1), nn.Linear(fdim, fdim)
        )

    def forward(self, a, b):
        a = self.proj_a(a).unsqueeze(1)
        b = self.proj_b(b).unsqueeze(1)
        ac, _ = self.attn(a, b, b);  ac = self.norm_a(a + ac).squeeze(1)
        bc, _ = self.attn(b, a, a);  bc = self.norm_b(b + bc).squeeze(1)
        return self.ff(torch.cat([ac, bc], dim=-1))


class DeepfakeDetector(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.spatial_enc  = SpatialEncoder(cfg)
        self.temporal_enc = TemporalEncoder(self.spatial_enc.out_dim,
                                            cfg.lstm_hidden, cfg.lstm_layers, cfg.dropout)
        self.freq_enc     = FrequencyEncoder(cfg)
        self.fusion       = CrossAttentionFusion(self.temporal_enc.out_dim,
                                                 self.freq_enc.out_dim,
                                                 cfg.fusion_dim, cfg.num_heads)
        self.classifier   = nn.Sequential(
            nn.Linear(cfg.fusion_dim, 256), nn.LayerNorm(256), nn.GELU(),
            nn.Dropout(cfg.dropout),
            nn.Linear(256, 64),             nn.GELU(),
            nn.Dropout(cfg.dropout / 2),
            nn.Linear(64, 2),
        )

    def forward(self, frames, ffts):
        B, T, C, H, W = frames.shape
        flat      = rearrange(frames, 'b t c h w -> (b t) c h w')
        spat      = self.spatial_enc(flat)
        spat_seq  = rearrange(spat, '(b t) d -> b t d', b=B, t=T)
        temp_feat = self.temporal_enc(spat_seq)
        mid       = T // 2
        freq_feat = self.freq_enc(ffts[:, mid])
        fused     = self.fusion(temp_feat, freq_feat)
        return self.classifier(fused)


class VideoGradCAM:
    """GradCAM on the spatial encoder's last conv block."""
    def __init__(self, model):
        self.model      = model
        self.gradients  = None
        self.activations = None
        # Hook into the last conv block of EfficientNet-B4
        target = model.spatial_enc.backbone.conv_head
        target.register_forward_hook(self._save_activation)
        target.register_backward_hook(self._save_gradient)

    def _save_activation(self, _, __, output):
        self.activations = output.detach()

    def _save_gradient(self, _, __, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, frames_t, ffts_t, face_uint8: np.ndarray) -> str:
        """Returns base64 PNG of GradCAM heatmap overlaid on the most suspicious frame."""
        self.model.zero_grad()
        frames_t = frames_t.requires_grad_(False)

        # Forward — run on single middle frame batch for GradCAM
        B, T, C, H, W = frames_t.shape
        flat   = rearrange(frames_t, 'b t c h w -> (b t) c h w')
        flat   = flat.requires_grad_(True)
        spat   = self.model.spatial_enc(flat)

        # Only backprop through spatial encoder on the most suspicious frame
        # We need a scalar — sum of fake-class activations
        score = spat.sum()
        score.backward()

        grads = self.gradients       # [B*T, C, h, w]
        acts  = self.activations     # [B*T, C, h, w]

        if grads is None or acts is None:
            return None

        # Average over spatial dims → channel weights
        weights = grads.mean(dim=(2, 3), keepdim=True)   # [B*T, C, 1, 1]
        cam     = (weights * acts).sum(dim=1)             # [B*T, h, w]
        cam     = torch.relu(cam)

        # Use the middle frame's CAM
        mid_cam = cam[T // 2].cpu().numpy()
        mid_cam = (mid_cam - mid_cam.min()) / (mid_cam.max() - mid_cam.min() + 1e-8)

        # Resize to face size and apply colormap
        heatmap = cv2.resize(mid_cam, (H, H))
        heatmap = np.uint8(255 * heatmap)
        heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
        heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

        # Overlay on the original face crop
        face_resized = cv2.resize(face_uint8, (H, H))
        overlay = cv2.addWeighted(face_resized, 0.5, heatmap, 0.5, 0)

        # Encode to base64
        img = Image.fromarray(overlay)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("utf-8")


def score_frames_individually(faces: list, ffts_list: list) -> list:
    scores = []
    T = 1  # treat each frame as a single-frame clip

    for i, face in enumerate(faces):
        if face is None:
            scores.append(50.0)
            continue
        try:
            # Build a [1, 1, 3, H, W] tensor for this single frame
            x = face.astype(np.float32) / 255.0
            x = (x - _MEAN) / _STD
            frame_t = torch.tensor(x.transpose(2, 0, 1)).unsqueeze(0).unsqueeze(0).to(DEVICE)  # [1,1,3,H,W]

            # FFT for this frame
            fft_f32 = ffts_list[i] if i < len(ffts_list) else compute_fft_features(face)
            fft_uint8 = (fft_f32 * 255).clip(0, 255).astype(np.uint8)
            fx = fft_uint8.astype(np.float32) / 255.0
            fx = (fx - _MEAN) / _STD
            fft_t = torch.tensor(fx.transpose(2, 0, 1)).unsqueeze(0).unsqueeze(0).to(DEVICE)  # [1,1,3,H,W]

            with torch.no_grad():
                logits = video_model(frame_t, fft_t)
                prob   = torch.softmax(logits, dim=-1)[0]
                scores.append(round(float(prob[1].item()) * 100, 2))
        except Exception as e:
            print(f"Frame {i} scoring failed: {e}")
            scores.append(50.0)

    return scores
# ── Load Model ────────────────────────────────────────────────────────────────
video_model_ready = False
video_model = None

MODEL_PATH = "../final_model.pt"   # .pt saved from training notebook

try:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"{MODEL_PATH} not found")
    video_model = DeepfakeDetector(CFG).to(DEVICE)
    # weights_only=False needed because the checkpoint contains numpy scalars
    # (e.g. from saving metrics/config alongside the state dict). Safe here
    # because this is our own trusted training output.
    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
    # support all checkpoint formats
    if isinstance(checkpoint, dict) and 'model_state' in checkpoint:
        state = checkpoint['model_state']       # what this notebook saves
    elif isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
        state = checkpoint['model_state_dict']
    elif isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
        state = checkpoint['state_dict']
    else:
        state = checkpoint                      # plain state_dict
    video_model.load_state_dict(state)
    video_model.eval()
    video_model_ready = True
    print(f"✅ Video model loaded from {MODEL_PATH} on {DEVICE}")
except Exception as e:
    print(f"⚠️  Video model NOT loaded: {e}")


# ── Preprocessing Helpers ─────────────────────────────────────────────────────
try:
    from facenet_pytorch import MTCNN
    _mtcnn = MTCNN(
        image_size=CFG.face_size,
        margin=int(CFG.face_size * CFG.face_margin),
        keep_all=False, select_largest=True,
        device=DEVICE, post_process=False,
    )
    _mtcnn_ready = True
except Exception:
    _mtcnn_ready = False
    print("⚠️  MTCNN not available — using center-crop fallback")


def _center_crop(rgb: np.ndarray, size: int) -> np.ndarray:
    h, w = rgb.shape[:2]
    s = min(h, w)
    y0, x0 = (h - s) // 2, (w - s) // 2
    return cv2.resize(rgb[y0:y0 + s, x0:x0 + s], (size, size))


def extract_face(frame_bgr: np.ndarray) -> np.ndarray:
    """Returns uint8 RGB face crop [H, W, 3]. Never returns None."""
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    if _mtcnn_ready:
        try:
            face = _mtcnn(frame_rgb)
            if face is not None:
                return face.permute(1, 2, 0).byte().numpy()
        except Exception:
            pass
    return _center_crop(frame_rgb, CFG.face_size)


def compute_fft_features(face_uint8: np.ndarray) -> np.ndarray:
    """Log-magnitude FFT spectrum. Returns float32 [H, W, 3] in [0, 1]."""
    gray = cv2.cvtColor(face_uint8, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mag  = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(gray))))
    mag  = (mag - mag.min()) / (mag.max() - mag.min() + 1e-8)
    return np.stack([mag, mag, mag], axis=-1).astype(np.float32)


def sample_video_frames(path: str, n: int, stride: int) -> List[np.ndarray]:
    cap    = cv2.VideoCapture(path)
    total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    idxs   = np.linspace(0, max(0, total - stride), n, dtype=int)
    frames = []
    for i in idxs:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
    cap.release()
    return frames


# ImageNet normalisation constants
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def preprocess_video(video_path: str):
    """
    Full pipeline: video → face crops → FFT maps → normalised tensors.
    Returns (frames_tensor, ffts_tensor) both shape [1, T, 3, H, W].
    """
    T, H = CFG.frames_per_clip, CFG.face_size
    blank_face = np.zeros((H, H, 3), dtype=np.uint8)
    blank_fft  = np.zeros((H, H, 3), dtype=np.float32)

    raw_frames = sample_video_frames(video_path, T, CFG.frame_stride)

    faces, ffts = [], []
    for frame in raw_frames:
        face = extract_face(frame)
        fft  = compute_fft_features(face)
        faces.append(face)
        ffts.append(fft)

    # Pad to T if the video was shorter
    while len(faces) < T:
        faces.append(blank_face)
        ffts.append(blank_fft)

    faces = faces[:T]
    ffts  = ffts[:T]

    def to_tensor(img_uint8: np.ndarray) -> np.ndarray:
        """uint8 HWC → float32 CHW, ImageNet-normalised."""
        x = img_uint8.astype(np.float32) / 255.0
        x = (x - _MEAN) / _STD
        return x.transpose(2, 0, 1)   # CHW

    def fft_to_tensor(fft_f32: np.ndarray) -> np.ndarray:
        """float32 HWC [0,1] → float32 CHW, ImageNet-normalised."""
        fft_uint8 = (fft_f32 * 255).clip(0, 255).astype(np.uint8)
        return to_tensor(fft_uint8)

    frame_tensors = np.stack([to_tensor(f)    for f in faces])   # [T, 3, H, W]
    fft_tensors   = np.stack([fft_to_tensor(f) for f in ffts])   # [T, 3, H, W]

    frames_t = torch.tensor(frame_tensors).unsqueeze(0).to(DEVICE)  # [1, T, 3, H, W]
    ffts_t   = torch.tensor(fft_tensors).unsqueeze(0).to(DEVICE)    # [1, T, 3, H, W]

    return frames_t, ffts_t

class SpatialWrapper(nn.Module):
    """Thin wrapper exposing only the EfficientNet backbone for GradCAM — mirrors notebook."""
    def __init__(self, detector: DeepfakeDetector):
        super().__init__()
        self.backbone = detector.spatial_enc.backbone

    def forward(self, x):
        return self.backbone(x)


def get_gradcam_target_layer(backbone):
    """
    Hook into blocks[-1][-1] (last MBConv in last stage) — exact match to notebook.
    Falls back to conv_head if indexing fails.
    """
    try:
        return [backbone.blocks[-1][-1]]
    except (IndexError, TypeError):
        return [backbone.conv_head]


def run_video_xai(
    frames_batch,     # [1, T, 3, H, W] tensor already on DEVICE
    ffts_batch,       # [1, T, 3, H, W] tensor
    faces_uint8,      # list of T np.ndarray uint8 face crops
    fake_prob: float,
    pred_label: int,
    video_name: str,
    n_display_frames: int = 8,
) -> tuple:
    """
    Runs per-frame GradCAM exactly as notebook Cell 49.
    Returns (composite_b64, frame_scores, cam_scores).
      - composite_b64 : base64 PNG of the full verdict figure
      - frame_scores  : list[float] fake probability per sampled frame
      - cam_scores    : list[float] mean GradCAM activation per displayed frame
    """
    T = frames_batch.shape[1]
    verdict       = 'FAKE' if pred_label == 1 else 'REAL'
    verdict_conf  = fake_prob if pred_label == 1 else (1 - fake_prob)
    verdict_color = '#d62728' if verdict == 'FAKE' else '#2ca02c'

    wrapper       = SpatialWrapper(video_model).to(DEVICE).eval()
    target_layers = get_gradcam_target_layer(wrapper.backbone)
    cam_engine    = GradCAM(model=wrapper, target_layers=target_layers)
    targets       = [ClassifierOutputTarget(pred_label)]

    mean_t = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1).to(DEVICE)
    std_t  = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1).to(DEVICE)

    display_idxs = np.linspace(0, T - 1, n_display_frames, dtype=int)
    cam_maps, disp_imgs, cam_scores = [], [], []

    for fi in display_idxs:
        frame_i = frames_batch[0, fi].unsqueeze(0)
        disp    = (frame_i * std_t + mean_t).clamp(0, 1).squeeze().permute(1, 2, 0).cpu().numpy()
        gcam    = cam_engine(input_tensor=frame_i, targets=targets)[0]
        overlay = show_cam_on_image(disp, gcam, use_rgb=True)
        cam_maps.append(gcam)
        disp_imgs.append((disp, overlay))
        cam_scores.append(float(gcam.mean()))

    # ── Per-frame fake probabilities (full pipeline per frame) ────────────
    frame_scores = []
    for fi in range(T):
        try:
            f_t = frames_batch[:, fi:fi+1, :, :, :]   # [1,1,3,H,W]
            q_t = ffts_batch[:,   fi:fi+1, :, :, :]
            with torch.no_grad():
                lgt = video_model(f_t, q_t)
                p   = torch.softmax(lgt, dim=-1)[0]
                frame_scores.append(round(float(p[1].item()) * 100, 2))
        except Exception:
            frame_scores.append(round(fake_prob * 100, 2))

    # ── Build composite figure (mirrors notebook exactly) ─────────────────
    n_cols = n_display_frames
    fig = plt.figure(figsize=(3.5 * n_cols, 10.5))
    fig.patch.set_facecolor('#111111')

    gs = gridspec.GridSpec(4, n_cols,
                    height_ratios=[0.6, 1, 1, 0.6],
                    hspace=0.12, wspace=0.06)

    # Row 0: verdict banner
    ax_banner = fig.add_subplot(gs[0, :])
    ax_banner.set_facecolor(verdict_color)
    ax_banner.text(0.5, 0.55, f'VERDICT: {verdict}',
                   ha='center', va='center', fontsize=28, fontweight='bold',
                   color='white', transform=ax_banner.transAxes)
    ax_banner.text(0.5, 0.15,
                   f'Fake probability: {fake_prob:.2%}   |   Confidence: {verdict_conf:.2%}   |   {video_name}',
                   ha='center', va='center', fontsize=10, color='white',
                   transform=ax_banner.transAxes)
    ax_banner.axis('off')

    # Row 1: raw face crops
    for col, (fi, (disp, _)) in enumerate(zip(display_idxs, disp_imgs)):
        ax = fig.add_subplot(gs[1, col])
        ax.imshow(disp); ax.axis('off')
        ax.set_title(f'Frame {fi}', color='white', fontsize=8, pad=2)
        if col == 0:
            ax.set_ylabel('Face crop', color='#aaaaaa', fontsize=8, rotation=90, labelpad=4)

    # Row 2: GradCAM overlays
    for col, (fi, (_, overlay)) in enumerate(zip(display_idxs, disp_imgs)):
        ax = fig.add_subplot(gs[2, col])
        ax.imshow(overlay); ax.axis('off')
        score      = cam_scores[col]
        border_col = '#ff3333' if score > np.median(cam_scores) else '#555555'
        for spine in ax.spines.values():
            spine.set_edgecolor(border_col); spine.set_linewidth(2.5); spine.set_visible(True)
        ax.set_title(f'CAM {score:.3f}', color=border_col, fontsize=7, pad=2)
        if col == 0:
            ax.set_ylabel('Grad-CAM', color='#aaaaaa', fontsize=8, rotation=90, labelpad=4)

    # Row 3: timeline bar
    # Row 3: timeline bar
    ax_time = fig.add_subplot(gs[3, :])
    ax_time.set_facecolor('#1a1a1a')
    x_pos  = np.arange(len(display_idxs))
    colors = ['#d62728' if s > np.median(cam_scores) else '#555577' for s in cam_scores]
    ax_time.bar(x_pos, cam_scores, color=colors, width=0.7, alpha=0.9)
    ax_time.axhline(np.median(cam_scores), color='yellow', ls='--', lw=1.2, alpha=0.8,
                    label='Median activation')
    ax_time.set_xlim(-0.5, len(display_idxs) - 0.5)
    ax_time.set_ylim(0, max(cam_scores) * 1.3 + 1e-6)
    ax_time.set_xticks(x_pos)
    ax_time.set_xticklabels([f'F{i}' for i in display_idxs], color='white', fontsize=7)
    ax_time.set_ylabel('Grad-CAM\nactivation', color='white', fontsize=8)
    ax_time.set_title('Frame-level Grad-CAM Activation  (red = high suspicion)',
                    color='white', fontsize=9, pad=4)
    ax_time.tick_params(colors='white')
    for sp in ax_time.spines.values(): sp.set_color('#444444')
    ax_time.legend(fontsize=7, labelcolor='white', facecolor='#1a1a1a', edgecolor='#444444')

    plt.suptitle('Deepfake Detection Analysis', fontsize=13, color='white',
                 fontweight='bold', y=1.002)

    buf = io.BytesIO()
    plt.savefig(buf, format='PNG', dpi=130, bbox_inches='tight', facecolor='#111111')
    plt.close(fig)
    buf.seek(0)
    composite_b64 = base64.b64encode(buf.read()).decode('utf-8')

    return composite_b64, frame_scores, cam_scores

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"service": "Video Detection Service", "status": "running"}


@app.get("/health")
def health():
    return {
        "status": "video service running",
        "model": video_model_ready,
        "device": str(DEVICE),
    }

@app.post("/predict-video")
async def predict_video(video: UploadFile = File(...)):
    if not video_model_ready:
        return {"error": "Video model not loaded"}

    suffix = os.path.splitext(video.filename or "video.mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await video.read())
        tmp_path = tmp.name

    try:
        frames_t, ffts_t = preprocess_video(tmp_path)

        with torch.no_grad():
            logits = video_model(frames_t, ffts_t)
            probs  = torch.softmax(logits, dim=-1)[0]

        fake_prob  = float(probs[1].item())
        real_prob  = float(probs[0].item())
        pred_label = int(probs.argmax().item())

        # XAI
        composite_b64, frame_scores, cam_scores = run_video_xai(
            frames_t, ffts_t,
            faces_uint8=[],
            fake_prob=fake_prob,
            pred_label=pred_label,
            video_name=video.filename or "video",
            n_display_frames=8,
        )

        return {
            "prediction":       "fake" if pred_label == 1 else "real",
            "fake_probability": round(fake_prob * 100, 2),
            "real_probability": round(real_prob * 100, 2),
            "gradcam":          composite_b64,     # full composite figure
            "frame_scores":     frame_scores,       # per-frame fake %
            "cam_scores":       cam_scores,         # per-frame CAM activation
        }
    finally:
        os.remove(tmp_path)

@app.post("/explain-video")
async def explain_video(payload: dict):
    prediction  = payload.get("prediction")
    fake_prob   = payload.get("fake_probability")
    real_prob   = payload.get("real_probability")
    gradcam_b64 = payload.get("gradcam")

    if not gradcam_b64:
        return JSONResponse(status_code=400, content={"error": "No GradCAM image provided"})

    try:
        prompt = f"""You are a forensic AI analyst reviewing a deepfake video detection result.

Detection result:
- Prediction: {str(prediction).upper()}
- Synthetic probability: {fake_prob:.1f}%
- Authentic probability: {real_prob:.1f}%

The attached image shows sampled video frames (top row) with their corresponding GradCAM heatmap overlays (bottom row).
Red/orange regions indicate areas the model focused on most when making its decision across frames.
Blue/green regions had low forensic significance.

Please provide:
1. A clear 2-3 sentence summary of what the model found across the video frames
2. What the highlighted regions suggest (e.g. facial boundaries, eye region, skin texture inconsistencies across time)
3. Whether the attention pattern is consistent across frames or concentrated in specific moments
4. A confidence assessment — is the model's decision reliable at this probability level?
5. Any caveats or limitations the user should know

Keep the tone professional but accessible. Do not use bullet points, write in flowing paragraphs."""

        response = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{gradcam_b64}"}
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }],
            max_tokens=1024
        )
        return {"explanation": response.choices[0].message.content}

    except Exception as e:
        print(f"⚠️ Groq video explanation failed: {e}")
        return JSONResponse(status_code=500, content={"error": f"Groq request failed: {str(e)}"})