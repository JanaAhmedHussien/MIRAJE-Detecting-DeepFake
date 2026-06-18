from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tensorflow as tf
import numpy as np
import cv2
import tempfile
import os
import io
import base64
from PIL import Image
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


# ── GradCAM (Keras / MobileNetV2 backbone) ─────────────────────────
def generate_gradcam(img_array: np.ndarray, original_gray: np.ndarray) -> str:
    base_model = signature_model.get_layer(index=1)

    last_conv_layer = None
    for layer in reversed(base_model.layers):
        if isinstance(layer, tf.keras.layers.Conv2D):
            last_conv_layer = layer
            break
    if last_conv_layer is None:
        raise RuntimeError("Could not locate a Conv2D layer for GradCAM")

    conv_to_base_output = tf.keras.Model(
        inputs=base_model.input,
        outputs=[base_model.get_layer(last_conv_layer.name).output, base_model.output],
    )

    img_tensor = tf.convert_to_tensor(img_array, dtype=tf.float32)

    # Take everything AFTER base_model's real position, instead of a
    # hardcoded [2:] that assumed an InputLayer that may not be there.
    head_layers = signature_model.layers[signature_model.layers.index(base_model) + 1:]

    with tf.GradientTape() as tape:
        conv_outputs, x = conv_to_base_output(img_tensor, training=False)
        for layer in head_layers:
            x = layer(x, training=False)
        loss = x[:, 0]

    grads = tape.gradient(loss, conv_outputs)

# ── Routes ────────────────────────────────────────────────────────
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

        prediction = "fake" if forged_prob > 50 else "real"

        # ── GradCAM ───────────────────────────────────────────────
        gradcam_b64 = None
        try:
            original_gray = cv2.imread(tmp_path, cv2.IMREAD_GRAYSCALE)
            gradcam_b64 = generate_gradcam(features, original_gray)
        except Exception as e:
            print(f"⚠️ GradCAM failed: {e}")

        return {
            "prediction": prediction,
            "fake_probability": round(forged_prob, 2),
            "real_probability": round(prob_genuine * 100, 2),
            "gradcam": gradcam_b64,
        }
    finally:
        os.remove(tmp_path)


# ── Groq explanation ────────────────────────────────────────────
@app.post("/explain")
async def explain(payload: dict):
    prediction  = payload.get("prediction")
    fake_prob   = payload.get("fake_probability")
    real_prob   = payload.get("real_probability")
    gradcam_b64 = payload.get("gradcam")

    if not gradcam_b64:
        return JSONResponse(status_code=400, content={"error": "No GradCAM image provided"})

    try:
        prompt = f"""You are a forensic document examiner reviewing a signature forgery detection result.

Detection result:
- Prediction: {str(prediction).upper()}
- Forged probability: {fake_prob:.1f}%
- Genuine probability: {real_prob:.1f}%

The attached image is a GradCAM heatmap overlay on the analysed signature.
Red/orange regions indicate areas the model focused on most when making its decision.
Blue/green regions had low influence.

Please provide:
1. A clear 2-3 sentence summary of what the model found
2. What the highlighted regions suggest about the signature (e.g. stroke pressure, letter formation, pen lifts, inconsistent slant)
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