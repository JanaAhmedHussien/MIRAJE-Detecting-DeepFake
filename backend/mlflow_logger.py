import mlflow

# Point to the same database the UI uses
mlflow.set_tracking_uri("sqlite:///mlflow.db")

# ============================================================
# IMAGE MODEL
# ============================================================
mlflow.set_experiment("Image Deepfake Detection")

with mlflow.start_run(run_name="ViT-CNN-evaluation"):
    mlflow.log_param("model_type", "ViT + CNN Hybrid")
    mlflow.log_param("base_model", "google/vit-base-patch16-224-in21k")
    mlflow.log_param("input_size", "224x224")
    mlflow.log_param("classes", "real, fake")

    mlflow.log_metric("precision_real", 0.9634)
    mlflow.log_metric("precision_fake", 0.9565)
    mlflow.log_metric("recall_real", 0.9562)
    mlflow.log_metric("recall_fake", 0.9637)
    mlflow.log_metric("f1_real", 0.9598)
    mlflow.log_metric("f1_fake", 0.9600)
    mlflow.log_metric("macro_precision", 0.9599)
    mlflow.log_metric("macro_recall", 0.9599)
    mlflow.log_metric("macro_f1", 0.9599)

    print("✅ Image model metrics logged")

# ============================================================
# AUDIO MODEL
# ============================================================
mlflow.set_experiment("Audio Deepfake Detection")

with mlflow.start_run(run_name="CNN-LSTM-evaluation"):
    mlflow.log_param("model_type", "CNN-LSTM")
    mlflow.log_param("input", "mel-spectrogram 128x63")
    mlflow.log_param("sample_rate", "16000")
    mlflow.log_param("duration", "2 seconds")

    mlflow.log_metric("accuracy", 0.95)

    print("✅ Audio model metrics logged")

# ============================================================
# SIGNATURE MODEL
# ============================================================
mlflow.set_experiment("Signature Verification")

with mlflow.start_run(run_name="MobileNetV2-evaluation"):
    mlflow.log_param("model_type", "MobileNetV2")
    mlflow.log_param("input_size", "128x128")
    mlflow.log_param("classes", "genuine, forged")

    mlflow.log_metric("accuracy", 0.97)

    print("✅ Signature model metrics logged")

print("\n✅ All metrics logged to MLflow")
print("Run: mlflow ui --port 5005")
print("Open: http://localhost:5005")