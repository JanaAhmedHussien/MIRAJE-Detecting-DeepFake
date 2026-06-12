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

IMAGE_SERVICE     = "http://localhost:5001"
AUDIO_SERVICE     = "http://localhost:5002"
SIGNATURE_SERVICE = "http://localhost:5003"
TEXT_SERVICE      = "http://localhost:5004"
VIDEO_SERVICE     = "http://localhost:5005"


@app.get("/")
def root():
    return {
        "project": "Miraje - Deepfake Detection",
        "version": "2.0",
        "docs": "http://localhost:5000/docs"
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
            r = await client.get(f"{VIDEO_SERVICE}/health")
            status["services"]["videi"] = r.json().get("status")
        except:
            status["services"]["video"] = "offline"

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


@app.post("/predict-video")
async def predict_video(video: UploadFile = File(...)):
    contents = await video.read()
    async with httpx.AsyncClient(timeout=120) as client:   # videos need more time
        response = await client.post(
            f"{VIDEO_SERVICE}/predict-video",
            files={"video": (video.filename, contents, video.content_type)}
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