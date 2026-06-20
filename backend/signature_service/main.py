from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import cv2
import timm
import tempfile
import os
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from PIL import Image
from torchvision import transforms
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config (must match training notebook exactly) ─────────────────────────────
IMG_SIZE  = 224
THRESHOLD = 0.7
DEVICE    = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Signature-appropriate normalisation (white paper, near-binary images)
_MEAN = [0.95, 0.95, 0.95]
_STD  = [0.10, 0.10, 0.10]

val_transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=_MEAN, std=_STD),
])

def denormalize(tensor: torch.Tensor) -> np.ndarray:
    """Undo signature normalisation → numpy HWC float32 in [0, 1]."""
    img = tensor.cpu().numpy().transpose(1, 2, 0)
    img = np.array(_STD) * img + np.array(_MEAN)
    return np.clip(img, 0, 1).astype(np.float32)


# ── Model Architecture ────────────────────────────────────────────────────────
class AttentionSiameseNetwork(nn.Module):
    """
    Siamese Network with:
      • EfficientNet-B0 shared backbone
      • Channel-wise attention on |f1 - f2|
      • Concatenation of [f1, f2, attended_diff] → MLP → similarity score
    """

    def __init__(self, backbone: str = "efficientnet_b0", pretrained: bool = False):
        super().__init__()
        self.backbone = timm.create_model(backbone, pretrained=pretrained, num_classes=0)

        with torch.no_grad():
            dummy = torch.randn(1, 3, IMG_SIZE, IMG_SIZE)
            self.feature_dim = self.backbone(dummy).shape[1]

        fd = self.feature_dim

        self.attention = nn.Sequential(
            nn.Linear(fd, fd // 4),
            nn.ReLU(inplace=True),
            nn.Linear(fd // 4, fd),
            nn.Sigmoid(),
        )

        self.classifier = nn.Sequential(
            nn.Linear(fd * 3, 512),
            nn.BatchNorm1d(512), nn.ReLU(inplace=True), nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.BatchNorm1d(256), nn.ReLU(inplace=True), nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.BatchNorm1d(128), nn.ReLU(inplace=True),
            nn.Linear(128, 1),
            nn.Sigmoid(),
        )

    def forward_once(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)

    def forward(self, x1: torch.Tensor, x2: torch.Tensor):
        f1, f2   = self.forward_once(x1), self.forward_once(x2)
        diff     = torch.abs(f1 - f2)
        att      = self.attention(diff)
        att_diff = att * diff
        combined = torch.cat([f1, f2, att_diff], dim=1)
        score    = self.classifier(combined)
        return score, f1, f2, att


# ── Load Model ────────────────────────────────────────────────────────────────
sig_model_ready = False
sig_model: AttentionSiameseNetwork = None

MODEL_PATH = os.environ.get("MODEL_PATH", "/app/models/best_model.pth")

try:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"{MODEL_PATH} not found")

    sig_model = AttentionSiameseNetwork(backbone="efficientnet_b0", pretrained=False).to(DEVICE)
    ckpt = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
    sig_model.load_state_dict(ckpt["model_state_dict"])
    sig_model.eval()
    sig_model_ready = True
    print(f"✅ Signature model loaded from {MODEL_PATH} on {DEVICE}")
    print(f"   Epoch: {ckpt.get('epoch', '?')}  |  val_acc: {ckpt.get('val_acc', '?')}")
except Exception as e:
    print(f"⚠️  Signature model NOT loaded: {e}")


# ── Image helpers ─────────────────────────────────────────────────────────────
def load_image_bytes(data: bytes) -> torch.Tensor:
    """bytes → normalised tensor (3, H, W)."""
    pil = Image.open(io.BytesIO(data)).convert("RGB")
    return val_transform(pil)


def tensor_to_pil_np(t: torch.Tensor) -> np.ndarray:
    """(3,H,W) normalised tensor → uint8 numpy HWC RGB."""
    arr = denormalize(t)
    return (arr * 255).astype(np.uint8)


# ── GradCAM helper ────────────────────────────────────────────────────────────
def _grad_cam(img_tensor: torch.Tensor) -> np.ndarray:
    """
    GradCAM on EfficientNet-B0's conv_head.
    img_tensor: (3, H, W) on CPU.
    Returns grayscale CAM (H, W) float32 in [0, 1].
    """
    try:
        target_layers = [sig_model.backbone.conv_head]
        cam_engine    = GradCAM(model=sig_model.backbone, target_layers=target_layers)
        inp           = img_tensor.unsqueeze(0).to(DEVICE)
        return cam_engine(input_tensor=inp, targets=None)[0]   # (H, W)
    except Exception as e:
        print(f"  GradCAM skipped: {e}")
        return np.zeros((IMG_SIZE, IMG_SIZE), dtype=np.float32)


# ── Build composite XAI figure ────────────────────────────────────────────────
def build_xai_figure(
    img1_t: torch.Tensor,
    img2_t: torch.Tensor,
    sim: float,
    att_np: np.ndarray,
    f1: torch.Tensor,
    f2: torch.Tensor,
    label: str,
    conf: float,
) -> str:
    """
    Builds a composite figure matching the notebook layout:
      Row 0: img1 | GradCAM1 | img2 | GradCAM2
      Row 1: diff map | heatmap | attention bars | metrics table
    Returns base64 PNG string.
    """
    img1_np = denormalize(img1_t)
    img2_np = denormalize(img2_t)

    cam1 = _grad_cam(img1_t)
    cam2 = _grad_cam(img2_t)
    vis1 = show_cam_on_image(img1_np, cam1, use_rgb=True)
    vis2 = show_cam_on_image(img2_np, cam2, use_rgb=True)

    diff_map  = np.abs(img1_np - img2_np)
    diff_gray = (np.mean(diff_map, axis=2) * 255).astype(np.uint8)
    heatmap   = cv2.applyColorMap(diff_gray, cv2.COLORMAP_JET)
    heatmap   = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

    cos_sim  = F.cosine_similarity(f1, f2).item()
    euc_dist = torch.norm(f1 - f2).item()

    label_color = "lime" if "Genuine" in label else "tomato"
    title_str   = (
        f"Prediction: {label}   Confidence: {conf:.1%}   "
        f"Score: {sim:.4f}   (threshold={THRESHOLD})"
    )

    fig = plt.figure(figsize=(20, 10))
    fig.patch.set_facecolor("#1a1a2e")
    gs  = gridspec.GridSpec(2, 4, figure=fig, hspace=0.4, wspace=0.3)
    fig.suptitle(title_str, fontsize=14, fontweight="bold",
                 color=label_color, y=1.01)

    def _show(ax, img, title_txt, cmap=None):
        ax.imshow(img, cmap=cmap)
        ax.set_title(title_txt, fontsize=10, color="white", pad=4)
        ax.axis("off")

    # Row 0
    _show(fig.add_subplot(gs[0, 0]), img1_np, "Signature 1\n(Original)")
    _show(fig.add_subplot(gs[0, 1]), vis1,    "GradCAM — Sig 1\n(Focus regions)")
    _show(fig.add_subplot(gs[0, 2]), img2_np, "Signature 2\n(Original)")
    _show(fig.add_subplot(gs[0, 3]), vis2,    "GradCAM — Sig 2\n(Focus regions)")

    # Row 1, col 0: pixel difference
    _show(fig.add_subplot(gs[1, 0]), diff_map, "Pixel Difference\n(absolute)")

    # Row 1, col 1: difference heatmap
    _show(fig.add_subplot(gs[1, 1]), heatmap, "Difference Heatmap\n(JET colormap)")

    # Row 1, col 2: top-k attention channels
    ax_att = fig.add_subplot(gs[1, 2])
    top_k   = 20
    top_idx = np.argsort(att_np)[-top_k:][::-1]
    ax_att.barh(range(top_k), att_np[top_idx], color="#e056fd", edgecolor="white", lw=0.5)
    ax_att.set_yticks(range(top_k))
    ax_att.set_yticklabels([f"ch{i}" for i in top_idx], fontsize=7, color="white")
    ax_att.set_xlabel("Attention weight", color="white", fontsize=9)
    ax_att.set_title(f"Top-{top_k} Attention Channels", color="white", fontsize=10)
    ax_att.set_facecolor("#2d3561")
    ax_att.tick_params(colors="white")
    for sp in ax_att.spines.values():
        sp.set_edgecolor("gray")

    # Row 1, col 3: metrics table
    ax_met = fig.add_subplot(gs[1, 3])
    ax_met.axis("off")
    metrics_data = [
        ["Metric",            "Value"],
        ["Similarity Score",  f"{sim:.4f}"],
        ["Confidence",        f"{conf:.2%}"],
        ["Cosine Similarity", f"{cos_sim:.4f}"],
        ["Euclidean Dist",    f"{euc_dist:.4f}"],
        ["Threshold",         f"{THRESHOLD}"],
        ["Prediction",        label],
    ]
    tbl = ax_met.table(
        cellText=metrics_data[1:],
        colLabels=metrics_data[0],
        loc="center", cellLoc="center",
    )
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(9)
    tbl.scale(1.4, 1.8)
    for (r, c), cell in tbl.get_celld().items():
        cell.set_facecolor("#2d3561" if r == 0 else "#1a1a2e")
        cell.set_text_props(
            color=label_color if (r > 0 and c == 1 and r == len(metrics_data) - 1) else "white"
        )
        cell.set_edgecolor("gray")
    ax_met.set_title("Similarity Metrics", color="white", fontsize=10)

    for ax in fig.axes:
        ax.set_facecolor("#1a1a2e")

    buf = io.BytesIO()
    plt.savefig(buf, format="PNG", dpi=130, bbox_inches="tight", facecolor="#1a1a2e")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"service": "Signature Detection Service (AttentionSiamese)", "status": "running"}


@app.get("/health")
def health():
    return {
        "status": "signature service running",
        "model":  sig_model_ready,
        "device": str(DEVICE),
    }


@app.post("/predict-signature")
async def predict_signature(
    signature: UploadFile  = File(...),
    reference: UploadFile  = File(None),   # optional second image
):
    """
    Single-image mode  : upload only `signature`.
      The image is compared against a slightly-augmented version of itself.
      A genuine signature is self-consistent (score → high).
      An AI-synthesised or heavily-manipulated one tends to score lower.

    Two-image mode     : upload both `signature` (query) and `reference`.
      Standard Siamese verification — returns similarity score.
    """
    if not sig_model_ready:
        return {"error": "Signature model not loaded"}

    sig_bytes = await signature.read()
    img1_t    = load_image_bytes(sig_bytes)

    if reference is not None:
        ref_bytes = await reference.read()
        img2_t    = load_image_bytes(ref_bytes)
        mode_used = "two-image"
    else:
        # Self-comparison with a mild augmentation (slight rotation + brightness)
        aug = transforms.Compose([
            transforms.Grayscale(num_output_channels=3),
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.RandomRotation(degrees=3),
            transforms.ColorJitter(brightness=0.05, contrast=0.05),
            transforms.ToTensor(),
            transforms.Normalize(mean=_MEAN, std=_STD),
        ])
        pil      = Image.open(io.BytesIO(sig_bytes)).convert("RGB")
        img2_t   = aug(pil)
        mode_used = "single-image (self-comparison)"

    # ── Inference ─────────────────────────────────────────────────────────────
    with torch.no_grad():
        i1 = img1_t.unsqueeze(0).to(DEVICE)
        i2 = img2_t.unsqueeze(0).to(DEVICE)
        score, f1, f2, att = sig_model(i1, i2)

    sim     = score.item()
    # score > THRESHOLD → Genuine (real), score ≤ THRESHOLD → Forged (fake)
    forged  = sim <= THRESHOLD
    conf    = abs(sim - 0.5) * 2

    fake_prob = round((1.0 - sim) * 100, 2)
    real_prob = round(sim * 100, 2)
    label     = "Forged" if forged else "Genuine"

    att_np = att.squeeze().cpu().numpy()

    # ── GradCAM composite ─────────────────────────────────────────────────────
    gradcam_b64 = None
    try:
        gradcam_b64 = build_xai_figure(
            img1_t, img2_t, sim, att_np, f1, f2, label, conf
        )
    except Exception as e:
        print(f"⚠️  XAI figure failed: {e}")

    return {
        "prediction":       "fake" if forged else "real",
        "fake_probability": fake_prob,
        "real_probability": real_prob,
        "similarity_score": round(sim, 4),
        "confidence":       round(conf * 100, 2),
        "mode":             mode_used,
        "gradcam":          gradcam_b64,
    }


@app.post("/explain-signature")
async def explain_signature(payload: dict):
    prediction  = payload.get("prediction")
    fake_prob   = payload.get("fake_probability")
    real_prob   = payload.get("real_probability")
    gradcam_b64 = payload.get("gradcam")

    if not gradcam_b64:
        return JSONResponse(status_code=400, content={"error": "No GradCAM image provided"})

    try:
        prompt = f"""You are a forensic AI analyst reviewing a signature forgery detection result.

Detection result:
- Prediction: {str(prediction).upper()}
- Forgery probability: {fake_prob:.1f}%
- Genuine probability: {real_prob:.1f}%

The attached image is a composite forensic analysis figure containing:
- Top row: the two signature images with their GradCAM heatmap overlays (red/orange = high model focus)
- Bottom row: pixel difference map, difference heatmap, top attention channels bar chart, and similarity metrics table

Please provide:
1. A clear 2-3 sentence summary of what the model found
2. What the GradCAM focus regions and difference map suggest (e.g. stroke inconsistencies, pen-lift anomalies, pressure variations)
3. Whether the attention pattern indicates systematic forgery or natural variation
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
            max_tokens=1024,
        )
        return {"explanation": response.choices[0].message.content}

    except Exception as e:
        print(f"⚠️  Groq signature explanation failed: {e}")
        return JSONResponse(status_code=500, content={"error": f"Groq request failed: {str(e)}"})