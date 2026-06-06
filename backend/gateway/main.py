from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

IMAGE_SERVICE = "http://localhost:5001"
AUDIO_SERVICE = "http://localhost:5002"
SIGNATURE_SERVICE = "http://localhost:5003"
TEXT_SERVICE      = "http://localhost:5004"

@app.get("/")
def root():
    return {
        "project": "Miraje - Deepfake Detection",
        "version": "2.0",
        "docs": "http://localhost:5000/docs"
    }

@app.get("/health")
async def health():
    async with httpx.AsyncClient(timeout=10) as client:
        image_status = await client.get(f"{IMAGE_SERVICE}/health")
        audio_status = await client.get(f"{AUDIO_SERVICE}/health")
        sig_status = await client.get(f"{SIGNATURE_SERVICE}/health")
    return {
        "gateway": "running",
        "services": {
            "image": image_status.json(),
            "audio": audio_status.json(),
            "signature": sig_status.json()
        }
    }

@app.post("/predict-image")
async def predict_image(image: UploadFile = File(...)):
    contents = await image.read()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{IMAGE_SERVICE}/predict-image",
            files={"image": (image.filename, contents, image.content_type)}
        )
    return response.json()

@app.post("/predict-audio")
async def predict_audio(audio: UploadFile = File(...)):
    contents = await audio.read()
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{AUDIO_SERVICE}/predict-audio",
            files={"audio": (audio.filename, contents, audio.content_type)}
        )
    return response.json()

@app.post("/predict-signature")
async def predict_signature(signature: UploadFile = File(...)):
    contents = await signature.read()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{SIGNATURE_SERVICE}/predict-signature",
            files={"signature": (signature.filename, contents, signature.content_type)}
        )
    return response.json()
