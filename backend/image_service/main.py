from flask import Flask, request, jsonify
from flask_cors import CORS

import torch
from torch import nn
from torchvision import transforms
from transformers import ViTModel, ViTConfig

import tensorflow as tf
import numpy as np
import cv2
from PIL import Image
import os

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────
# DEVICE
# ─────────────────────────────────────────
device = torch.device("cpu")

# ============================================================
# IMAGE MODEL (ViT + CNN)  — load only if .pth exists
# ============================================================

image_model_ready = False
vit = cnn_block = fc_layers = image_transform = None

try:
    if not os.path.exists("image_module.pth"):
        raise FileNotFoundError("image_module.pth not found in backend/")

    config = ViTConfig.from_pretrained("google/vit-base-patch16-224-in21k")

    vit = ViTModel.from_pretrained(
        "google/vit-base-patch16-224-in21k",
        config=config
    )

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

    checkpoint = torch.load("image_module.pth", map_location=device)
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
    print(f"⚠️  Image model NOT loaded: {e}")


# ============================================================
# AUDIO MODEL (CNN-LSTM)  — load only if .keras exists
# ============================================================

audio_model_ready = False
audio_model = None

SAMPLE_RATE   = 16000
DURATION      = 2
N_MELS        = 128
N_FFT         = 2048
HOP_LENGTH    = 512
TARGET_LENGTH = SAMPLE_RATE * DURATION

try:
    if not os.path.exists("audio_model.keras"):
        raise FileNotFoundError("audio_model.keras not found in backend/")

    # Try loading; Keras 3 may have initializer compat issues with older models
    try:
        audio_model = tf.keras.models.load_model("audio_model.keras", compile=False)
    except Exception:
        # Fallback: load with custom_objects to fix Orthogonal initialiser format
        from tensorflow.keras.initializers import Orthogonal
        audio_model = tf.keras.models.load_model(
            "audio_model.keras",
            compile=False,
            custom_objects={"Orthogonal": Orthogonal}
        )

    audio_model.trainable = False
    audio_model_ready = True
    print("✅ Audio model loaded")

except Exception as e:
    print(f"⚠️  Audio model NOT loaded: {e}")


# ============================================================
# SIGNATURE MODEL (MobileNetV2)  — load only if .keras exists
# ============================================================

signature_model_ready = False
signature_model = None

try:
    if not os.path.exists("signature_forgery_detector.keras"):
        raise FileNotFoundError("signature_forgery_detector.keras not found in backend/")

    signature_model = tf.keras.models.load_model(
        "signature_forgery_detector.keras", compile=False
    )
    signature_model.trainable = False
    signature_model_ready = True
    print("✅ Signature model loaded")

except Exception as e:
    print(f"⚠️  Signature model NOT loaded: {e}")


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
    mel     = librosa.feature.melspectrogram(y=audio, sr=sr, n_mels=N_MELS, n_fft=N_FFT, hop_length=HOP_LENGTH)
    log_mel = librosa.power_to_db(mel, ref=np.max)
    rng     = log_mel.max() - log_mel.min()
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


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "models": {
            "image":     image_model_ready,
            "audio":     audio_model_ready,
            "signature": signature_model_ready,
        }
    })


# ============================================================
# IMAGE PREDICTION
# ============================================================

@app.route("/predict-image", methods=["POST"])
def predict_image():
    if not image_model_ready:
        return jsonify({"error": "Image model not loaded. Place image_module.pth in the backend/ folder."}), 503

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    try:
        image = Image.open(file.stream).convert("RGB")
        image = image_transform(image).unsqueeze(0).to(device)

        with torch.no_grad():
            vit_outputs  = vit(pixel_values=image)
            cls_token    = vit_outputs.last_hidden_state[:, 0, :]
            patch_tokens = vit_outputs.last_hidden_state[:, 1:, :]
            patch_tokens = patch_tokens.permute(0, 2, 1)
            patch_tokens = patch_tokens.view(patch_tokens.size(0), patch_tokens.size(1), 14, 14)
            cnn_features = cnn_block(patch_tokens)
            combined = torch.cat([cls_token, cnn_features], dim=1)
            logits       = fc_layers(combined)
            probs        = torch.softmax(logits, dim=1)
            fake_prob    = probs[0][1].item() * 100
            real_prob    = probs[0][0].item() * 100

        print(f"Image — fake: {fake_prob:.2f}% | real: {real_prob:.2f}%")
        return jsonify({
            "prediction":       "fake" if fake_prob > real_prob else "real",
            "fake_probability": round(fake_prob, 2),
            "real_probability": round(real_prob, 2)
        })

    except Exception as e:
        print(f"Image error: {e}")
        return jsonify({"error": str(e)}), 500


# ============================================================
# AUDIO PREDICTION
# ============================================================

@app.route("/predict-audio", methods=["POST"])
def predict_audio():
    if not audio_model_ready:
        return jsonify({"error": "Audio model not loaded. Place audio_model.keras in the backend/ folder."}), 503

    if "audio" not in request.files:
        return jsonify({"error": "No audio uploaded"}), 400

    file      = request.files["audio"]
    temp_path = "temp_audio.wav"
    try:
        with open(temp_path, "wb") as f:
            f.write(file.read())

        features = extract_audio_features(temp_path)
        features = features[np.newaxis, ...]

        prediction    = audio_model.predict(features, verbose=0)[0][0]
        real_prob_raw = float(prediction)
        fake_prob     = (1 - real_prob_raw) * 100

        print(f"Audio — fake: {fake_prob:.2f}%")
        return jsonify({
            "prediction":       "fake" if fake_prob > 50 else "real",
            "fake_probability": round(fake_prob, 2),
            "real_probability": round(100 - fake_prob, 2),
            "score":            round(fake_prob, 2)
        })

    except Exception as e:
        print(f"Audio error: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ============================================================
# SIGNATURE PREDICTION
# ============================================================

@app.route("/predict-signature", methods=["POST"])
def predict_signature():
    if not signature_model_ready:
        return jsonify({"error": "Signature model not loaded. Place signature_forgery_detector.keras in the backend/ folder."}), 503

    if "signature" not in request.files:
        return jsonify({"error": "No signature uploaded"}), 400

    file      = request.files["signature"]
    temp_path = "temp_signature.png"
    try:
        with open(temp_path, "wb") as f:
            f.write(file.read())

        features     = extract_signature_features(temp_path)
        prob_genuine = float(signature_model.predict(features, verbose=0)[0][0])
        forged_prob  = (1 - prob_genuine) * 100

        print(f"Signature — forged: {forged_prob:.2f}%")
        return jsonify({
            "prediction":       "fake" if forged_prob > 50 else "real",
            "fake_probability": round(forged_prob, 2),
            "real_probability": round(prob_genuine * 100, 2),
            "score":            round(forged_prob, 2)
        })

    except Exception as e:
        print(f"Signature error: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    print("\n🚀 Miraje backend running on http://localhost:5000")
    print(f"   Image:     {'✅ ready' if image_model_ready     else '❌ missing (image_module.pth)'}")
    print(f"   Audio:     {'✅ ready' if audio_model_ready     else '❌ missing/incompatible (audio_model.keras)'}")
    print(f"   Signature: {'✅ ready' if signature_model_ready else '❌ missing (signature_forgery_detector.keras)'}\n")
    app.run(port=5000, debug=False, use_reloader=False)
