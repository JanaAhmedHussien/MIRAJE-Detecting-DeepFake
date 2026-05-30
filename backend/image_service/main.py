from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import torch
from torch import nn
from torchvision import transforms
from transformers import ViTModel, ViTConfig
from PIL import Image
import io
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device("cpu")

image_model_ready = False
vit = cnn_block = fc_layers = image_transform = None

try:
    if not os.path.exists("../image_module.pth"):
        raise FileNotFoundError("image_module.pth not found")
    config = ViTConfig.from_pretrained("google/vit-base-patch16-224-in21k")
    vit = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k", config=config)
    cnn_block = nn.Sequential(
        nn.Conv2d(config.hidden_size, 256, kernel_size=3, padding=1),
        nn.ReLU(),
        nn.Conv2d(256, 128, kernel_size=3, padding=1),
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
    checkpoint = torch.load("../image_module.pth", map_location=device)
    vit.load_state_dict(checkpoint["vit"])
    cnn_block.load_state_dict(checkpoint["cnn_block"])
    fc_layers.load_state_dict(checkpoint["fc_layers"])
    vit.eval()
    cnn_block.eval()
    fc_layers.eval()
    image_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
    ])
    image_model_ready = True
    print("✅ Image model loaded")
except Exception as e:
    print(f"⚠️ Image model NOT loaded: {e}")

@app.get("/")
def root():
    return {"service": "Image Detection Service", "status": "running"}

@app.get("/health")
def health():
    return {"status": "image service running", "model": image_model_ready}

@app.post("/predict-image")
async def predict_image(image: UploadFile = File(...)):
    if not image_model_ready:
        return {"error": "Image model not loaded"}
    contents = await image.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
    img = image_transform(img).unsqueeze(0).to(device)
    with torch.no_grad():
        vit_outputs = vit(pixel_values=img)
        last_hidden = vit_outputs.last_hidden_state
        cls_token = last_hidden[:, 0, :]
        patch_tokens = last_hidden[:, 1:, :]

        B, N, C = patch_tokens.shape
        h = w = int(N ** 0.5)
        patch_grid = patch_tokens.transpose(1, 2).contiguous().view(B, C, h, w)

        cnn_features = cnn_block(patch_grid)
        combined = torch.cat([cls_token, cnn_features], dim=1)
        logits = fc_layers(combined)
        probs = torch.softmax(logits, dim=1)
        fake_prob = probs[0][1].item() * 100
        real_prob = probs[0][0].item() * 100
    return {
        "prediction": "fake" if fake_prob > real_prob else "real",
        "fake_probability": round(fake_prob, 2),
        "real_probability": round(real_prob, 2)
    }