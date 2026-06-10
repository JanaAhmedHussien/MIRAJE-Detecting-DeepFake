from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn as nn
import numpy as np
import cv2
import tempfile
import os
from dataclasses import dataclass
from typing import List
from einops import rearrange

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

        fake_prob = float(probs[1].item()) * 100
        real_prob = float(probs[0].item()) * 100

        return {
            "prediction":       "fake" if fake_prob > 50 else "real",
            "fake_probability": round(fake_prob, 2),
            "real_probability": round(real_prob, 2),
        }
    finally:
        os.remove(tmp_path)