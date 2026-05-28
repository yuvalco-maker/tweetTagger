from pathlib import Path
import joblib
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModel

from backend.app.schemas.ml_schema import PredictionResult

MODELS_DIR = Path(__file__).resolve().parents[4] / "models"

EMBED_MODEL   = "distilbert-base-uncased"
MAX_LENGTH    = 128
DANGER_THRESHOLD = 0.35

_tokenizer       = None
_embed_model     = None
_tfidf_danger    = None
_danger_model    = None
_relevance_model = None
_class_model     = None
_class_encoder   = None


def _patch_lr(model):
    # Models trained with sklearn 1.8+ don't store multi_class; sklearn 1.7.x
    # predict_proba accesses self.multi_class directly, so we backfill it.
    if not hasattr(model, "multi_class"):
        model.multi_class = "deprecated"
    return model


def _load_models():
    global _tokenizer, _embed_model, _tfidf_danger
    global _danger_model, _relevance_model, _class_model, _class_encoder

    if _danger_model is not None:
        return

    device = "cuda" if torch.cuda.is_available() else "cpu"

    _tokenizer   = AutoTokenizer.from_pretrained(EMBED_MODEL)
    _embed_model = AutoModel.from_pretrained(EMBED_MODEL).to(device)
    _embed_model.eval()

    _tfidf_danger    = joblib.load(MODELS_DIR / "tfidf_danger.pkl")
    _danger_model    = _patch_lr(joblib.load(MODELS_DIR / "danger_model.pkl"))
    _relevance_model = _patch_lr(joblib.load(MODELS_DIR / "relevance_model.pkl"))
    _class_model     = _patch_lr(joblib.load(MODELS_DIR / "class_model.pkl"))
    _class_encoder   = joblib.load(MODELS_DIR / "class_encoder.pkl")


def _embed(text: str) -> np.ndarray:
    device = next(_embed_model.parameters()).device
    encoded = _tokenizer(
        [text],
        padding=True,
        truncation=True,
        max_length=MAX_LENGTH,
        return_tensors="pt",
    ).to(device)
    with torch.no_grad():
        output = _embed_model(**encoded)
    return output.last_hidden_state[:, 0, :].cpu().numpy()


def predict_from_text(text: str) -> PredictionResult:
    _load_models()

    # 1. Danger — TF-IDF
    tfidf_vec = _tfidf_danger.transform([text])
    danger_prob = _danger_model.predict_proba(tfidf_vec)[0, 1]
    is_dangerous = bool(danger_prob >= DANGER_THRESHOLD)

    # 2. Embed once for relevance + class
    embedding = _embed(text)

    # 3. If dangerous → skip relevance, go straight to class model
    if is_dangerous:
        class_proba = _class_model.predict_proba(embedding)[0]
        class_idx = int(class_proba.argmax())
        category = _class_encoder.inverse_transform([class_idx])[0]
        return PredictionResult(is_dangerous=True, category=category, confidence=round(float(danger_prob), 4))

    # 4. Safe → check relevance
    is_relevant = bool(_relevance_model.predict(embedding)[0] == 1)
    if not is_relevant:
        return PredictionResult(is_dangerous=False, category="Other", confidence=round(1 - float(danger_prob), 4))

    # 5. Relevant + safe → classify
    class_proba = _class_model.predict_proba(embedding)[0]
    class_idx = int(class_proba.argmax())
    category = _class_encoder.inverse_transform([class_idx])[0]
    return PredictionResult(is_dangerous=False, category=category, confidence=round(float(class_proba.max()), 4))
