from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
from torch import nn
from torchvision import transforms
from transformers import ViTModel, ViTConfig
from PIL import Image
import io
import os
import numpy as np
import cv2
import base64
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

device = torch.device("cpu")

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

# Alphabetical ImageFolder order: fake=0, real=1
IDX_TO_CLASS = {0: "fake", 1: "real"}

image_model_ready = False
vit = cnn_block = fc_layers = image_transform = None

try:
    weights_path = "../weights.pt"
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"{weights_path} not found")

    config = ViTConfig.from_pretrained("google/vit-base-patch16-224-in21k")

    vit = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k", config=config)

    cnn_block = nn.Sequential(
        nn.Conv2d(config.hidden_size, 256, kernel_size=3, padding=1),
        nn.ReLU(),
        nn.Conv2d(256, 128, kernel_size=3, padding=1),  # index 2 — GradCAM target
        nn.ReLU(),
        nn.AdaptiveAvgPool2d((8, 8)),
        nn.Flatten()
    )

    fc_layers = nn.Sequential(
        nn.Linear(128 * 8 * 8 + config.hidden_size, 512),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(512, 2)
    )

    checkpoint = torch.load(weights_path, map_location=device)
    vit.load_state_dict(checkpoint["vit"])
    cnn_block.load_state_dict(checkpoint["cnn_block"])
    fc_layers.load_state_dict(checkpoint["fc_layers"])

    vit.eval()
    cnn_block.eval()
    fc_layers.eval()

    image_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD)
    ])

    image_model_ready = True
    print("✅ Image model v2 (Firefly+SA) loaded")

except Exception as e:
    print(f"⚠️ Image model v2 NOT loaded: {e}")


# ── GradCAM ──────────────────────────────────────────────────────
def generate_gradcam(img_tensor: torch.Tensor, original_pil: Image.Image) -> str:
    """
    Runs GradCAM on cnn_block[2] (last Conv2d, 128 channels).
    Returns a base64-encoded PNG of the heatmap overlaid on the original image.
    """
    gradients = []
    activations = []

    target_layer = cnn_block[2]

    def forward_hook(module, input, output):
        activations.append(output.detach())

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0].detach())

    fwd_handle = target_layer.register_forward_hook(forward_hook)
    bwd_handle = target_layer.register_full_backward_hook(backward_hook)

    vit.eval()
    cnn_block.eval()
    fc_layers.eval()

    vit_outputs  = vit(pixel_values=img_tensor)
    last_hidden  = vit_outputs.last_hidden_state
    cls_token    = last_hidden[:, 0, :]
    patch_tokens = last_hidden[:, 1:, :]

    B, N, C = patch_tokens.shape
    h = w   = int(N ** 0.5)
    patch_grid = patch_tokens.transpose(1, 2).reshape(B, C, h, w)

    cnn_features = cnn_block(patch_grid)
    combined     = torch.cat([cls_token, cnn_features], dim=1)
    logits       = fc_layers(combined)

    predicted_class_idx = logits.argmax(dim=1).item()
    score = logits[0, predicted_class_idx]
    score.backward()

    fwd_handle.remove()
    bwd_handle.remove()

    grads = gradients[0]
    acts  = activations[0]

    weights = grads.mean(dim=(2, 3), keepdim=True)
    cam     = (weights * acts).sum(dim=1).squeeze(0)
    cam     = torch.clamp(cam, min=0)

    cam_min, cam_max = cam.min(), cam.max()
    if cam_max - cam_min > 1e-8:
        cam = (cam - cam_min) / (cam_max - cam_min)
    else:
        cam = torch.zeros_like(cam)

    cam_np = cam.cpu().numpy()

    cam_resized = cv2.resize(cam_np, (224, 224))
    heatmap     = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
    heatmap     = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

    orig_np = np.array(original_pil.resize((224, 224))).astype(np.float32)

    overlay = (0.55 * orig_np + 0.45 * heatmap).astype(np.uint8)

    overlay_pil = Image.fromarray(overlay)
    buffer      = io.BytesIO()
    overlay_pil.save(buffer, format="PNG")
    b64_str     = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return b64_str


# ── Routes ────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"service": "Image Detection Service v2 (Firefly+SA)", "status": "running"}


@app.get("/health")
def health():
    return {"status": "image service v2 running", "model": image_model_ready}


@app.post("/predict-image")
async def predict_image(image: UploadFile = File(...)):
    if not image_model_ready:
        return {"error": "Image model v2 not loaded"}

    contents   = await image.read()
    original   = Image.open(io.BytesIO(contents)).convert("RGB")
    img_tensor = image_transform(original).unsqueeze(0).to(device)

    # ── Prediction ────────────────────────────────────────────────
    with torch.no_grad():
        vit_outputs  = vit(pixel_values=img_tensor)
        last_hidden  = vit_outputs.last_hidden_state
        cls_token    = last_hidden[:, 0, :]
        patch_tokens = last_hidden[:, 1:, :]

        B, N, C = patch_tokens.shape
        h = w   = int(N ** 0.5)
        patch_grid = patch_tokens.transpose(1, 2).reshape(B, C, h, w)

        cnn_features = cnn_block(patch_grid)
        combined     = torch.cat([cls_token, cnn_features], dim=1)
        logits       = fc_layers(combined)

        probs = torch.softmax(logits, dim=1)
        conf_by_class = {
            IDX_TO_CLASS[i]: probs[0][i].item() * 100
            for i in range(probs.shape[1])
        }
        fake_prob = conf_by_class.get("fake", 0.0)
        real_prob = conf_by_class.get("real", 0.0)

    prediction = "fake" if fake_prob > real_prob else "real"

    # ── GradCAM ───────────────────────────────────────────────────
    gradcam_b64 = None
    try:
        gradcam_b64 = generate_gradcam(img_tensor, original)
    except Exception as e:
        print(f"⚠️ GradCAM failed: {e}")

    return {
        "prediction":       prediction,
        "fake_probability": round(fake_prob, 2),
        "real_probability": round(real_prob, 2),
        "gradcam":          gradcam_b64,
    }


# ── Gemini explanation ────────────────────────────────────────────
@app.post("/explain")
async def explain(payload: dict):
    prediction  = payload.get("prediction")
    fake_prob   = payload.get("fake_probability")
    real_prob   = payload.get("real_probability")
    gradcam_b64 = payload.get("gradcam")

    if not gradcam_b64:
        return JSONResponse(status_code=400, content={"error": "No GradCAM image provided"})

    try:
        prompt = f"""You are a forensic AI analyst reviewing a deepfake detection result.

Detection result:
- Prediction: {str(prediction).upper()}
- Synthetic probability: {fake_prob:.1f}%
- Authentic probability: {real_prob:.1f}%

The attached image is a GradCAM heatmap overlay on the analysed image.
Red/orange regions indicate areas the model focused on most when making its decision.
Blue/green regions had low influence.

Please provide:
1. A clear 2-3 sentence summary of what the model found
2. What the highlighted regions suggest about the image (e.g. facial boundaries, eye region, skin texture)
3. A confidence assessment — is the model's decision reliable at this probability level?
4. Any caveats or limitations the user should know

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
        print(f"⚠️ Groq explanation failed: {e}")
        return JSONResponse(status_code=500, content={"error": f"Groq request failed: {str(e)}"})
    prediction  = payload.get("prediction")
    fake_prob   = payload.get("fake_probability")
    real_prob   = payload.get("real_probability")
    gradcam_b64 = payload.get("gradcam")

    if not gradcam_b64:
        return JSONResponse(status_code=400, content={"error": "No GradCAM image provided"})

    try:
        image_part = {
            "mime_type": "image/png",
            "data": gradcam_b64,
        }

        prompt = f"""You are a forensic AI analyst reviewing a deepfake detection result.

Detection result:
- Prediction: {str(prediction).upper()}
- Synthetic probability: {fake_prob:.1f}%
- Authentic probability: {real_prob:.1f}%

The attached image is a GradCAM heatmap overlay on the analysed image.
Red/orange regions indicate areas the model focused on most when making its decision.
Blue/green regions had low influence.

Please provide:
1. A clear 2-3 sentence summary of what the model found
2. What the highlighted regions suggest about the image (e.g. facial boundaries, eye region, skin texture)
3. A confidence assessment — is the model's decision reliable at this probability level?
4. Any caveats or limitations the user should know

Keep the tone professional but accessible. Do not use bullet points, write in flowing paragraphs."""

        response = gemini.generate_content([prompt, image_part])
        return {"explanation": response.text}

    except Exception as e:
        print(f"⚠️ Gemini explanation failed: {e}")
        return JSONResponse(status_code=500, content={"error": f"Gemini request failed: {str(e)}"})