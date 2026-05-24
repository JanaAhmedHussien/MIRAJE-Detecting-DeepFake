from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import tensorflow as tf
import numpy as np
import cv2
import tempfile
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def extract_features(path):
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Cannot read image file")
    img = cv2.resize(img, (128, 128))
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    img = img.astype(np.float32) / 255.0
    return np.expand_dims(img, 0)

@app.get("/")
def root():
    return {"service": "Signature Detection Service", "status": "running"}

@app.get("/health")
def health():
    return {"status": "signature service running", "model": signature_model_ready}

@app.post("/predict-signature")
async def predict_signature(signature: UploadFile = File(...)):
    if not signature_model_ready:
        return {"error": "Signature model not loaded"}
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        tmp.write(await signature.read())
        tmp_path = tmp.name
    try:
        features = extract_features(tmp_path)
        prob_genuine = float(signature_model.predict(features, verbose=0)[0][0])
        forged_prob = (1 - prob_genuine) * 100
        return {
            "prediction": "fake" if forged_prob > 50 else "real",
            "fake_probability": round(forged_prob, 2),
            "real_probability": round(prob_genuine * 100, 2)
        }
    finally:
        os.remove(tmp_path)