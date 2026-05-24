from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import tensorflow as tf
import numpy as np
import librosa
import tempfile
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_RATE = 16000
DURATION = 2
N_MELS = 128
N_FFT = 2048
HOP_LENGTH = 512
TARGET_LENGTH = SAMPLE_RATE * DURATION

audio_model = tf.keras.models.load_model("audio_model.keras", compile=False)
audio_model.trainable = False

def extract_features(path):
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

@app.post("/predict-audio")
async def predict_audio(audio: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name
    try:
        features = extract_features(tmp_path)[np.newaxis, ...]
        prediction = audio_model.predict(features, verbose=0)[0][0]
        fake_prob = (1 - float(prediction)) * 100
        return {
            "prediction": "fake" if fake_prob > 50 else "real",
            "fake_probability": round(fake_prob, 2),
            "real_probability": round(100 - fake_prob, 2)
        }
    finally:
        os.remove(tmp_path)

@app.get("/health")
def health():
    return {"status": "audio service running"}