# Miraje — Deepfake & Forgery Detection Platform

Miraje is a web-based platform for detecting AI-generated and manipulated media. It supports four types of input — images, audio, video, and handwritten signatures — and runs deep learning models to determine whether the submitted file is authentic or synthetic.

The name is inspired by the concept of a desert mirage: something that looks real but isn't. The interface reflects this theme visually.

---

## What It Does

- **Image detection**: Uses a Vision Transformer (ViT) combined with a CNN to identify GAN-generated or manipulated photographs.
- **Audio detection**: Uses a CNN-LSTM model on Mel spectrograms to detect cloned or synthesized voices.
- **Signature verification**: Uses a MobileNetV2-based classifier to distinguish genuine handwritten signatures from forgeries.
- **Video analysis**: Frame-level temporal consistency checks for face-swap and deepfake detection (UI ready, model integration in progress).

Users upload a file through a drag-and-drop interface, the backend runs inference, and the results are displayed with a verdict, confidence score, and breakdown across multiple forensic subsystems.

---

## Architecture

The project is split into two parts:

- A **React frontend** (built with Vite) that handles the UI, authentication, file upload, and result display.
- A **Flask backend** that loads the trained models and exposes prediction endpoints.

The frontend sends files to the backend via HTTP POST requests with `multipart/form-data`, and the backend returns JSON with the prediction and probabilities.

```
Frontend (React + Vite)
    |
    |  POST /predict-image, /predict-audio, /predict-signature
    v
Backend (Flask)
    |
    |-- ViT + CNN       (PyTorch)       -> image classification
    |-- CNN-LSTM         (Keras)         -> audio classification
    |-- MobileNetV2      (Keras)         -> signature classification
```

Authentication is handled through Firebase (email/password and Google sign-in).

---

## Tech Stack

**Frontend**: React 19, Vite 7, Firebase Authentication, vanilla CSS

**Backend**: Flask, PyTorch, TensorFlow/Keras, OpenCV, Librosa, NumPy, Pillow

---

## Project Structure

```
Miraje-E2E/
|-- backend/
|   |-- api.py                            # Flask API with all prediction endpoints
|   |-- image_module.pth                  # ViT+CNN weights (not tracked in git)
|   |-- audio_model.keras                 # CNN-LSTM weights (not tracked in git)
|   |-- signature_forgery_detector.keras  # MobileNetV2 weights (not tracked in git)
|   |-- metadata.json                    # Model metadata
|
|-- src/
|   |-- main.jsx            # React entry point
|   |-- App.jsx              # Main app component (analysis UI, history, pipeline)
|   |-- Miraje.css           # Core styles and animations
|   |-- AuthPage.jsx         # Login and signup page
|   |-- AuthPage.css         # Auth page styles
|   |-- AuthContext.jsx      # Firebase auth context provider
|   |-- firebase.js          # Firebase SDK setup
|   |-- index.css            # Global styles and font imports
|
|-- index.html               # HTML shell
|-- vite.config.js
|-- package.json
|-- .env                     # Firebase credentials (not tracked in git)
|-- .gitignore
```

---

## Prerequisites

- Node.js 18 or later
- Python 3.9 or later
- npm
- pip

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/Miraje-E2E.git
cd Miraje-E2E
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Set up the backend

```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate

pip install flask flask-cors torch torchvision transformers tensorflow numpy opencv-python Pillow librosa
```

### 4. Configure Firebase

Create a `.env` file in the project root with your Firebase project credentials:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

You can find these values in the Firebase Console under Project Settings > Your Apps > Web App.

Make sure to enable **Email/Password** and **Google** sign-in methods under Authentication > Sign-in method.

### 5. Add model files

The trained model weights are not included in the repository because of their size. You need to place them in the `backend/` directory:

| File | Architecture | Approximate Size |
|------|-------------|-----------------|
| `image_module.pth` | ViT-Base + CNN | ~355 MB |
| `audio_model.keras` | CNN-LSTM | ~1.7 MB |
| `signature_forgery_detector.keras` | MobileNetV2 | ~28 MB |

Contact the project maintainers for the weight files, or train your own using the associated notebooks.

---

## Running

### Start the backend

```bash
cd backend
python api.py
```

This starts the Flask server on `http://localhost:5000`. It will print which models loaded successfully:

```
Miraje backend running on http://localhost:5000
   Image:     ready
   Audio:     ready
   Signature: ready
```

The server will still start even if some model files are missing — those endpoints will just return a 503 error until the files are added.

### Start the frontend

In a separate terminal:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Endpoints

### GET /health

Returns the server status and which models are loaded.

```json
{
  "status": "running",
  "models": {
    "image": true,
    "audio": true,
    "signature": true
  }
}
```

### POST /predict-image

Upload an image file in the `image` field.

```json
{
  "prediction": "fake",
  "fake_probability": 87.34,
  "real_probability": 12.66
}
```

### POST /predict-audio

Upload an audio file in the `audio` field.

```json
{
  "prediction": "real",
  "fake_probability": 23.10,
  "real_probability": 76.90,
  "score": 23.10
}
```

### POST /predict-signature

Upload a signature image in the `signature` field.

```json
{
  "prediction": "fake",
  "fake_probability": 91.52,
  "real_probability": 8.48,
  "score": 91.52
}
```

---

## About the Models

**Image model** — A hybrid ViT + CNN architecture. The ViT (google/vit-base-patch16-224) extracts global features through its CLS token and patch embeddings. The patch tokens are reshaped into a 2D grid and passed through two convolutional layers for local feature extraction. Both feature vectors are concatenated and classified through fully connected layers. Input images are resized to 224x224 and normalized to [-1, 1].

**Audio model** — A CNN-LSTM network that operates on log-Mel spectrograms. Audio is resampled to 16 kHz and clipped or padded to 2 seconds. A 128-band Mel spectrogram is computed, converted to log scale, and normalized. The model outputs a sigmoid score where lower values indicate synthetic speech.

**Signature model** — A MobileNetV2-based binary classifier. Input images are converted to grayscale, resized to 128x128, converted back to 3-channel RGB, and normalized to [0, 1]. The model outputs a sigmoid score for genuine probability; the complement gives the forgery likelihood.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push and open a pull request

---

## License

This project was developed as part of an academic graduation project. Contact the maintainers for licensing information.
