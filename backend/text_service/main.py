import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device("cpu")

MAX_LEN = 512
MODEL_NAME = "roberta-base"

# ── Linguistic Feature Extractor (exact copy from notebook) ──
class LinguisticFeatureExtractor:
    @staticmethod
    def extract(batch_texts):
        features = []
        for text in batch_texts:
            if not text or len(text.strip()) == 0:
                text = " "
            words = text.split()
            n_words = len(words)
            n_chars = len(text)
            if n_words == 0:
                features.append([0.0] * 8)
                continue

            avg_word_len = sum(len(w) for w in words) / n_words
            avg_word_len_norm = min(avg_word_len / 20.0, 1.0)

            unique_words = len(set(w.lower() for w in words))
            ttr = unique_words / n_words

            sentence_delimiters = text.count('.') + text.count('!') + text.count('?')
            n_sentences = max(sentence_delimiters, 1)
            avg_sent_len = n_words / n_sentences
            avg_sent_len_norm = min(avg_sent_len / 100.0, 1.0)

            punct_chars = sum(1 for c in text if c in '.,;:!?()[]{}\'\"')
            punct_density = punct_chars / max(n_chars, 1)

            upper_ratio = sum(1 for c in text if c.isupper()) / max(n_chars, 1)
            digit_ratio = sum(1 for c in text if c.isdigit()) / max(n_chars, 1)

            char_counts = {}
            for c in text.lower():
                if c.isalpha():
                    char_counts[c] = char_counts.get(c, 0) + 1
            if char_counts:
                total = sum(char_counts.values())
                entropy = -sum((count/total) * np.log(count/total + 1e-10)
                              for count in char_counts.values())
                entropy_norm = min(entropy / 4.0, 1.0)
            else:
                entropy_norm = 0.0

            stopwords = {'the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'that', 'for',
                        'on', 'with', 'as', 'was', 'at', 'by', 'an', 'be', 'this', 'are'}
            stopword_count = sum(1 for w in words if w.lower() in stopwords)
            stopword_ratio = stopword_count / max(n_words, 1)

            features.append([
                avg_word_len_norm, ttr, avg_sent_len_norm,
                punct_density, upper_ratio, digit_ratio,
                entropy_norm, stopword_ratio
            ])
        return torch.tensor(features, dtype=torch.float32)


# ── Model Architecture (exact copy from notebook) ──
class RoBERTaAIDetector(nn.Module):
    def __init__(self, model_name='roberta-base', dropout=0.5, n_ling_features=8):
        super().__init__()
        self.roberta = AutoModel.from_pretrained(model_name, attn_implementation="eager")

        # Freeze first 6 layers (matches training)
        for layer_idx, layer in enumerate(self.roberta.encoder.layer):
            if layer_idx < 6:
                for param in layer.parameters():
                    param.requires_grad = False

        hidden = self.roberta.config.hidden_size

        self.ling_net = nn.Sequential(
            nn.Linear(n_ling_features, 16),
            nn.BatchNorm1d(16),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(16, 16),
        )

        fused_dim = hidden + 16
        self.classifier = nn.Sequential(
            nn.Linear(fused_dim, 256),
            nn.BatchNorm1d(256),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(256, 2)
        )

    def mean_pool(self, last_hidden, attention_mask):
        mask = attention_mask.unsqueeze(-1).expand(last_hidden.size()).float()
        return torch.sum(last_hidden * mask, dim=1) / mask.sum(dim=1).clamp(min=1e-9)

    def forward(self, input_ids, attention_mask, ling_features):
        outputs = self.roberta(input_ids=input_ids, attention_mask=attention_mask,
                               output_attentions=True)
        pooled = self.mean_pool(outputs.last_hidden_state, attention_mask)
        ling_out = self.ling_net(ling_features)
        combined = torch.cat([pooled, ling_out], dim=1)
        logits = self.classifier(combined)
        return logits, outputs.attentions


# ── Load model ──
text_model_ready = False
model = None
tokenizer = None

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ai_detector_roberta_final.pth")

try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = RoBERTaAIDetector(model_name=MODEL_NAME, dropout=0.5)
    state_dict = torch.load(MODEL_PATH, map_location=device)
    model.load_state_dict(state_dict)
    model.eval()
    text_model_ready = True
    print("✅ Text model loaded")
except Exception as e:
    print(f"⚠️  Text model NOT loaded: {e}")


# ── XAI: attention-based token importance ──
def get_token_importance(text: str):
    if not text_model_ready:
        return []
    inputs = tokenizer(
        text, return_tensors="pt", truncation=True,
        max_length=MAX_LEN, padding="max_length",
    )
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs["attention_mask"].to(device)
    ling_feats = LinguisticFeatureExtractor.extract([text]).to(device)

    with torch.no_grad():
        _, attentions = model(input_ids, attention_mask, ling_feats)

    # Last layer, average all heads, CLS row
    last_attn = attentions[-1][0]          # [heads, seq, seq]
    cls_attn  = last_attn[:, 0, :].mean(dim=0).cpu().numpy()  # [seq]

    tokens = tokenizer.convert_ids_to_tokens(input_ids[0].tolist())

    # Step 1: collect only content tokens
    pairs = []
    for tok, imp in zip(tokens, cls_attn.tolist()):
        if tok in ["<s>", "</s>", "<pad>"]:
            continue
        clean = tok.replace("Ġ", " ").replace("Ċ", "\n").strip()
        if clean:
            pairs.append((clean, float(imp)))

    if not pairs:
        return []

    # Step 2: normalize within content tokens only
    imps   = [p[1] for p in pairs]
    i_min  = min(imps)
    i_max  = max(imps)
    i_rng  = i_max - i_min

    result = []
    for tok, imp in pairs:
        norm = (imp - i_min) / i_rng if i_rng > 1e-8 else 0.5
        result.append({"token": tok, "importance": round(norm, 4)})
    return result


# ── Sentence scoring ──
def score_sentences(text: str):
    if not text_model_ready:
        return []
    sentences = [s.strip() for s in text.replace("!", ".").replace("?", ".").split(".") if len(s.strip()) > 10]
    out = []
    for sent in sentences[:8]:
        s_inputs = tokenizer(sent, return_tensors="pt", truncation=True,
                             max_length=MAX_LEN, padding="max_length")
        s_ling = LinguisticFeatureExtractor.extract([sent]).to(device)
        with torch.no_grad():
            s_logits, _ = model(s_inputs["input_ids"].to(device),
                                s_inputs["attention_mask"].to(device),
                                s_ling)
            s_probs = F.softmax(s_logits, dim=-1)
            # probs[1] = AI probability (matches notebook: label 1 = AI)
            s_ai = round(s_probs[0][1].item() * 100, 1)
        out.append({"sentence": sent[:120], "fake_probability": s_ai})
    return out


# ── Endpoints ──

@app.get("/")
def root():
    return {"service": "Text Detection Service", "status": "running"}

@app.get("/health")
def health():
    return {"status": "text service running", "model": text_model_ready}


class TextInput(BaseModel):
    text: str


@app.post("/predict-text")
async def predict_text(input: TextInput):
    from fastapi.responses import JSONResponse
    if not text_model_ready:
        return JSONResponse(status_code=503, content={"error": "Text model not loaded."})

    text = input.text.strip()
    if not text:
        return JSONResponse(status_code=400, content={"error": "Empty text provided"})

    try:
        inputs = tokenizer(
            text, return_tensors="pt", truncation=True,
            max_length=MAX_LEN, padding="max_length",
        )
        input_ids      = inputs["input_ids"].to(device)
        attention_mask = inputs["attention_mask"].to(device)
        ling_feats     = LinguisticFeatureExtractor.extract([text]).to(device)

        with torch.no_grad():
            logits, _ = model(input_ids, attention_mask, ling_feats)
            probs     = F.softmax(logits, dim=-1)
            # Notebook: label 0 = Human, label 1 = AI
            # probs[0][0] = human prob, probs[0][1] = AI prob
            ai_prob   = probs[0][1].item() * 100
            human_prob = probs[0][0].item() * 100

        prediction       = "fake" if ai_prob > 50 else "real"
        token_importance = get_token_importance(text)
        sentence_scores  = score_sentences(text)

        print(f"Text — AI: {ai_prob:.2f}% | Human: {human_prob:.2f}%")

        return {
            "prediction":        prediction,
            "fake_probability":  round(ai_prob, 2),
            "real_probability":  round(human_prob, 2),
            "token_importance":  token_importance,
            "sentence_scores":   sentence_scores,
            "char_count":        len(text),
            "word_count":        len(text.split()),
        }

    except Exception as e:
        print(f"Text error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})