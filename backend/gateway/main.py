from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import torch
from torch import nn
from torchvision import transforms
from transformers import ViTModel, ViTConfig
import tensorflow as tf
import numpy as np
import cv2
from PIL import Image
import io
import os
import tempfile

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device("cpu")

# ============================================================
# IMAGE MODEL
# ============================================================
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

# ============================================================
# AUDIO MODEL
# ============================================================
audio_model_ready = False
audio_model = None
SAMPLE_RATE = 16000
DURATION = 2
N_MELS = 128
N_FFT = 2048
HOP_LENGTH = 512
TARGET_LENGTH = SAMPLE_RATE * DURATION

try:
    if not os.path.exists("../audio_model.keras"):
        raise FileNotFoundError("audio_model.keras not found")
    try:
        audio_model = tf.keras.models.load_model("../audio_model.keras", compile=False)
    except Exception:
        from tensorflow.keras.initializers import Orthogonal
        audio_model = tf.keras.models.load_model(
            "../audio_model.keras",
            compile=False,
            custom_objects={"Orthogonal": Orthogonal}
        )
    audio_model.trainable = False
    audio_model_ready = True
    print("✅ Audio model loaded")
except Exception as e:
    print(f"⚠️ Audio model NOT loaded: {e}")

# ============================================================
# SIGNATURE MODEL
# ============================================================
signature_model_ready = False
signature_model = None

try:
    if not os.path.exists("../signature_forgery_detector.keras"):
        raise FileNotFoundError("signature_forgery_detector.keras not found")
    signature_model = tf.keras.models.load_model(
        "../signature_forgery_detector.keras", compile=False
    )
    signature_model.trainable = False
    signature_model_ready = True
    print("✅ Signature model loaded")
except Exception as e:
    print(f"⚠️ Signature model NOT loaded: {e}")

# ============================================================
# FEATURE EXTRACTORS
# ============================================================
def extract_audio_features(path):
    import librosa
    audio, sr = librosa.load(path, sr=SAMPLE_RATE)
    if len(audio) >= TARGET_LENGTH:
        audio = audio[:TARGET_LENGTH]
    else:
        audio = np.pad(audio, (0, TARGET_LENGTH - len(audio)))
    mel = librosa.feature.melspectrogram(
        y=audio, sr=sr, n_mels=N_MELS, n_fft=N_FFT, hop_length=HOP_LENGTH
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)
    rng = log_mel.max() - log_mel.min()
    log_mel = (log_mel - log_mel.min()) / (rng + 1e-8)
    return log_mel[..., np.newaxis].astype(np.float32)

def extract_signature_features(path):
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Cannot read image file")
    img = cv2.resize(img, (128, 128))
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    img = img.astype(np.float32) / 255.0
    return np.expand_dims(img, 0)

@app.get("/")
def root():
    return {
        "project": "Miraje - Deepfake Detection",
        "version": "2.0",
        "docs": "http://localhost:5000/docs",
        "health": "http://localhost:5000/health"
    }
# ============================================================
# HEALTH CHECK
# ============================================================
@app.get("/health")
def health():
    return {
        "status": "running",
        "models": {
            "image": image_model_ready,
            "audio": audio_model_ready,
            "signature": signature_model_ready,
        }
    }

# ============================================================
# IMAGE PREDICTION
# ============================================================
@app.post("/predict-image")
async def predict_image(image: UploadFile = File(...)):
    if not image_model_ready:
        return {"error": "Image model not loaded"}
    contents = await image.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
    img = image_transform(img).unsqueeze(0).to(device)
    with torch.no_grad():
        vit_outputs = vit(pixel_values=img)
        cls_token = vit_outputs.last_hidden_state[:, 0, :]
        patch_tokens = vit_outputs.last_hidden_state[:, 1:, :]
        patch_tokens = patch_tokens.permute(0, 2, 1)
        patch_tokens = patch_tokens.view(
            patch_tokens.size(0), patch_tokens.size(1), 14, 14
        )
        cnn_features = cnn_block(patch_tokens)
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

# ============================================================
# AUDIO PREDICTION
# ============================================================
@app.post("/predict-audio")
async def predict_audio(audio: UploadFile = File(...)):
    if not audio_model_ready:
        return {"error": "Audio model not loaded"}
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name
    try:
        features = extract_audio_features(tmp_path)
        features = features[np.newaxis, ...]
        prediction = audio_model.predict(features, verbose=0)[0][0]
        real_prob_raw = float(prediction)
        fake_prob = (1 - real_prob_raw) * 100
        return {
            "prediction": "fake" if fake_prob > 50 else "real",
            "fake_probability": round(fake_prob, 2),
            "real_probability": round(100 - fake_prob, 2)
        }
    finally:
        os.remove(tmp_path)

# ============================================================
# SIGNATURE PREDICTION
# ============================================================
@app.post("/predict-signature")
async def predict_signature(signature: UploadFile = File(...)):
    if not signature_model_ready:
        return {"error": "Signature model not loaded"}
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        tmp.write(await signature.read())
        tmp_path = tmp.name
    try:
        features = extract_signature_features(tmp_path)
        prob_genuine = float(signature_model.predict(features, verbose=0)[0][0])
        forged_prob = (1 - prob_genuine) * 100
        return {
            "prediction": "fake" if forged_prob > 50 else "real",
            "fake_probability": round(forged_prob, 2),
            "real_probability": round(prob_genuine * 100, 2)
        }
    finally:
        os.remove(tmp_path)