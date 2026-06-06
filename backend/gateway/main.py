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

IMAGE_SERVICE     = "http://localhost:8001"
AUDIO_SERVICE     = "http://localhost:8002"
SIGNATURE_SERVICE = "http://localhost:8003"
TEXT_SERVICE      = "http://localhost:8004"


@app.get("/")
def root():
    return {
        "project":      "Miraje - Deepfake Detection",
        "version":      "2.0",
        "docs":         "http://localhost:8000/docs",
        "health":       "http://localhost:8000/health",
        "architecture": "microservices"
    }


@app.get("/health")
async def health():
    status = {"status": "gateway running", "services": {}}

    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(f"{IMAGE_SERVICE}/health")
            status["services"]["image"] = r.json().get("status")
        except:
            status["services"]["image"] = "offline"

        try:
            r = await client.get(f"{AUDIO_SERVICE}/health")
            status["services"]["audio"] = r.json().get("status")
        except:
            status["services"]["audio"] = "offline"

        try:
            r = await client.get(f"{SIGNATURE_SERVICE}/health")
            status["services"]["signature"] = r.json().get("status")
        except:
            status["services"]["signature"] = "offline"

        try:
            r = await client.get(f"{TEXT_SERVICE}/health")
            status["services"]["text"] = r.json().get("status")
        except:
            status["services"]["text"] = "offline"

    return status


@app.post("/predict-image")
async def predict_image(image: UploadFile = File(...)):
    async with httpx.AsyncClient(timeout=60.0) as client:
        files = {
            "image": (
                image.filename,
                await image.read(),
                image.content_type
            )
        }

        response = await client.post(
            f"{IMAGE_SERVICE}/predict-image",
            files=files
        )

        return response.json()


@app.post("/predict-audio")
async def predict_audio(audio: UploadFile = File(...)):
    async with httpx.AsyncClient(timeout=60.0) as client:
        files = {
            "audio": (
                audio.filename,
                await audio.read(),
                audio.content_type
            )
        }

        response = await client.post(
            f"{AUDIO_SERVICE}/predict-audio",
            files=files
        )

        return response.json()


@app.post("/predict-signature")
async def predict_signature(signature: UploadFile = File(...)):
    async with httpx.AsyncClient(timeout=60.0) as client:
        files = {
            "signature": (
                signature.filename,
                await signature.read(),
                signature.content_type
            )
        }

        response = await client.post(
            f"{SIGNATURE_SERVICE}/predict-signature",
            files=files
        )

        return response.json()


@app.post("/predict-text")
async def predict_text(input: dict):
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{TEXT_SERVICE}/predict-text",
            json=input,
        )

        return response.json()