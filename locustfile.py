from locust import HttpUser, task, between

class MirajeUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def test_image(self):
        with open("test_image.jpg", "rb") as f:
            self.client.post("/predict-image",
                files={"image": f})

    @task
    def test_audio(self):
        with open("test_audio.wav", "rb") as f:
            self.client.post("/predict-audio",
                files={"audio": f})

    @task
    def test_signature(self):
        with open("test_signature.jpeg", "rb") as f:
            self.client.post("/predict-signature",
                files={"signature": f})