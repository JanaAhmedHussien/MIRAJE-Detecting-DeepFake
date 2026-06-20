from locust import HttpUser, task, between
import random

class MirajeUser(HttpUser):
    wait_time = between(1, 3)

    # -------------------------
    # IMAGE SERVICE
    # -------------------------
    @task(5)
    def test_image(self):
        with open("test_image.jpg", "rb") as f:
            self.client.post(
                "/predict-image-v2",
                files={
                    "image": (
                        "test_image.jpg",
                        f,
                        "image/jpeg"
                    )
                }
            )

    @task(3)
    def test_image_explain(self):
        payload = {
            "prediction": "fake",
            "confidence": 0.87
        }
        self.client.post("/explain-image", json=payload)

    # -------------------------
    # AUDIO SERVICE
    # -------------------------
    @task(4)
    def test_audio(self):
        with open("test_audio.wav", "rb") as f:
            self.client.post(
                "/predict-audio",
                files={
                    "audio": (
                        "test_audio.wav",
                        f,
                        "audio/wav"
                    )
                }
            )

    # -------------------------
    # SIGNATURE SERVICE (ONLY WITH REFERENCE)
    # -------------------------
    @task(4)
    def test_signature_with_reference(self):
        with open("TobeVerified.jpeg", "rb") as sig, \
             open("ref.jpeg", "rb") as ref:

            self.client.post(
                "/predict-signature",
                files={
                    "signature": ("sig.jpeg", sig, "image/jpeg"),
                    "reference": ("ref.jpeg", ref, "image/jpeg")
                }
            )

    # -------------------------
    # VIDEO SERVICE
    # -------------------------
    @task(2)
    def test_video(self):
        with open("test_video.mp4", "rb") as f:
            self.client.post(
                "/predict-video",
                files={
                    "video": (
                        "test_video.mp4",
                        f,
                        "video/mp4"
                    )
                }
            )

    @task(1)
    def test_video_explain(self):
        payload = {
            "frame_id": random.randint(1, 100),
            "analysis": "deepfake suspicion"
        }
        self.client.post("/explain-video", json=payload)

    # -------------------------
    # TEXT SERVICE
    # -------------------------
    @task(4)
    def test_text(self):
        self.client.post(
            "/predict-text",
            json={
                "text": "This is a sample text used for deepfake detection testing."
            }
        )

    # -------------------------
    # HEALTH CHECK
    # -------------------------
    @task(1)
    def test_health(self):
        self.client.get("/health")