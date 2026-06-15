"""
ML training service for TweetTagger.

Can be run directly for initial training:
    python -m backend.app.services.ml.trainer

Or called programmatically for retraining:
    from backend.app.services.ml.trainer import run_training
    await run_training()
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
import joblib
import numpy as np
import torch
from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight
from transformers import AutoModel, AutoTokenizer

_env_path = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_env_path)

MONGO_URI = os.getenv("MONGO_URI")
print(f"[trainer] .env loaded from: {_env_path}")
print(f"[trainer] MONGO_URI set: {bool(MONGO_URI)}")
MODELS_DIR = Path(__file__).resolve().parents[4] / "models"
MODELS_DIR.mkdir(exist_ok=True)

EMBED_MODEL = "distilbert-base-uncased"
BATCH_SIZE = 32
MAX_LENGTH = 128
CATEGORIES = ["Oil", "Electricity", "Gas", "Other"]
MIN_SAMPLES = 10


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def _load_tagged_tweets():
    client = MongoClient(MONGO_URI)
    db = client["tweet_tag_database"]
    collection = db["processed"]

    docs = list(collection.find(
        {"is_dangerous": {"$exists": True}, "category": {"$exists": True}},
        {"content": 1, "is_dangerous": 1, "category": 1, "_id": 0},
    ))
    client.close()

    texts, danger_labels, category_labels = [], [], []
    skipped_reasons = {"no_content": 0, "null_danger": 0, "bad_category": set()}
    for doc in docs:
        content = doc.get("content", "").strip()
        danger = doc.get("is_dangerous")
        category = doc.get("category", "").strip()

        if category == "Unrelated":
            category = "Other"

        if not content:
            skipped_reasons["no_content"] += 1
            continue
        if danger is None:
            skipped_reasons["null_danger"] += 1
            continue
        if category not in CATEGORIES:
            skipped_reasons["bad_category"].add(category)
            continue

        texts.append(content)
        danger_labels.append(int(danger))
        category_labels.append(category)

    print(f"[trainer] Loaded {len(texts)} tagged tweets")
    print(f"[trainer] Skipped — no content: {skipped_reasons['no_content']}, null danger: {skipped_reasons['null_danger']}, bad category values: {skipped_reasons['bad_category']}")
    return texts, danger_labels, category_labels


def _load_all_tagged_tweets():
    """Load from both processed (phase I) and human-corrected processed_phase_II."""
    client = MongoClient(MONGO_URI)
    db = client["tweet_tag_database"]

    phase_I = list(db["processed"].find(
        {"is_dangerous": {"$exists": True}, "category": {"$exists": True}},
        {"content": 1, "is_dangerous": 1, "category": 1, "tweet_id": 1, "_id": 0},
    ))
    phase_II = list(db["processed_phase_II"].find(
        {"is_dangerous": {"$exists": True}, "category": {"$exists": True}, "edited": True},
        {"content": 1, "is_dangerous": 1, "category": 1, "tweet_id": 1, "_id": 0},
    ))
    client.close()

    # Phase II corrections take precedence for same tweet_id
    seen_ids = set()
    merged = []
    for doc in phase_II:
        tid = doc.get("tweet_id")
        if tid:
            seen_ids.add(tid)
        merged.append(doc)
    for doc in phase_I:
        if doc.get("tweet_id") in seen_ids:
            continue
        merged.append(doc)

    print(f"[trainer] Phase I: {len(phase_I)}, Phase II corrections: {len(phase_II)}, merged: {len(merged)}")

    texts, danger_labels, category_labels = [], [], []
    skipped_reasons = {"no_content": 0, "null_danger": 0, "bad_category": set()}
    for doc in merged:
        content = doc.get("content", "").strip()
        danger = doc.get("is_dangerous")
        category = doc.get("category", "").strip()

        if category == "Unrelated":
            category = "Other"

        if not content:
            skipped_reasons["no_content"] += 1
            continue
        if danger is None:
            skipped_reasons["null_danger"] += 1
            continue
        if category not in CATEGORIES:
            skipped_reasons["bad_category"].add(category)
            continue

        texts.append(content)
        danger_labels.append(int(danger))
        category_labels.append(category)

    print(f"[trainer] Loaded {len(texts)} tagged tweets (merged)")
    print(f"[trainer] Skipped — no content: {skipped_reasons['no_content']}, null danger: {skipped_reasons['null_danger']}, bad category values: {skipped_reasons['bad_category']}")
    return texts, danger_labels, category_labels


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

def _embed_texts(texts):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[trainer] Embedding on {device} …")

    tokenizer = AutoTokenizer.from_pretrained(EMBED_MODEL)
    model = AutoModel.from_pretrained(EMBED_MODEL).to(device)
    model.eval()

    all_embeddings = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        encoded = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        ).to(device)

        with torch.no_grad():
            output = model(**encoded)

        cls_embeddings = output.last_hidden_state[:, 0, :].cpu().numpy()
        all_embeddings.append(cls_embeddings)

        if (i // BATCH_SIZE) % 5 == 0:
            print(f"[trainer]   {min(i + BATCH_SIZE, len(texts))}/{len(texts)} embedded")

    return np.vstack(all_embeddings)


# ---------------------------------------------------------------------------
# Model training
# ---------------------------------------------------------------------------

def _fit_logreg(X, y):
    classes = np.unique(y)
    weights = compute_class_weight("balanced", classes=classes, y=y)
    return LogisticRegression(
        max_iter=1000,
        class_weight=dict(zip(classes, weights)),
        C=1.0,
        solver="lbfgs",
    ).fit(X, y)


def _fit_svm(X, y):
    classes = np.unique(y)
    weights = compute_class_weight("balanced", classes=classes, y=y)
    return SVC(
        kernel="rbf",
        C=10.0,
        gamma="scale",
        class_weight=dict(zip(classes, weights)),
        probability=True,
    ).fit(X, y)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_tfidf_danger_experiment(t_train, t_test, yd_train, yd_test):
    """Train a TF-IDF logistic regression danger model and report AUC."""
    tfidf = TfidfVectorizer(max_features=20000, ngram_range=(1, 2), sublinear_tf=True)
    X_train_tfidf = tfidf.fit_transform(t_train)
    X_test_tfidf  = tfidf.transform(t_test)

    classes = np.unique(yd_train)
    weights = compute_class_weight("balanced", classes=classes, y=yd_train)
    model = LogisticRegression(
        max_iter=1000,
        class_weight=dict(zip(classes, weights)),
        C=1.0, solver="lbfgs",
    ).fit(X_train_tfidf, yd_train)

    probs = model.predict_proba(X_test_tfidf)[:, 1]
    auc   = roc_auc_score(yd_test, probs)
    acc   = float((model.predict(X_test_tfidf) == yd_test).mean())

    print(f"[trainer] TF-IDF danger — accuracy: {acc:.2%}  AUC: {auc:.3f}")
    return model, tfidf, auc


def run_training() -> dict:
    """
    Train 3 models and save them to models/:
      - danger_model    : dangerous vs safe (binary)
      - relevance_model : energy-related vs Other (binary)
      - class_model     : Oil / Gas / Electricity (3-class, relevant tweets only)
    Returns a dict with accuracy metrics.
    """
    texts, danger_labels, category_labels = _load_tagged_tweets()

    if len(texts) < MIN_SAMPLES:
        raise ValueError(f"Not enough tagged data ({len(texts)} < {MIN_SAMPLES})")

    X = _embed_texts(texts)


    y_danger       = np.array(danger_labels)
    y_relevance    = np.array([
        0 if (c == "Other" and d == 0) else 1
        for c, d in zip(category_labels, danger_labels)
    ])

    y_category = np.array(category_labels)

    texts_arr = np.array(texts)

    # --- train/test split (stratify on danger) ---
    (X_train, X_test,
     yd_train, yd_test,
     yr_train, yr_test,
     ycat_train, ycat_test,
     t_train, t_test) = train_test_split(
        X, y_danger, y_relevance, y_category, texts_arr,
        test_size=0.2, random_state=42, stratify=y_danger,
    )

    # --- 1. Danger model (TF-IDF) ---
    print("[trainer] Training danger model (TF-IDF) …")
    tfidf_danger = TfidfVectorizer(max_features=20000, ngram_range=(1, 2), sublinear_tf=True)
    X_danger_train = tfidf_danger.fit_transform(t_train)
    X_danger_test  = tfidf_danger.transform(t_test)
    danger_model = _fit_logreg(X_danger_train, yd_train)
    joblib.dump(tfidf_danger, MODELS_DIR / "tfidf_danger.pkl")

    # --- 2. Relevance model ---
    print("[trainer] Training relevance model …")
    relevance_model = _fit_logreg(X_train, yr_train)

    # --- 3. Class model (Oil / Gas / Electricity only) ---
    relevant_mask_train = yr_train == 1
    relevant_mask_test  = yr_test  == 1

    X_class_train = X_train[relevant_mask_train]
    y_class_train_raw = ycat_train[relevant_mask_train]
    X_class_test  = X_test[relevant_mask_test]
    y_class_test_raw  = ycat_test[relevant_mask_test]

    class_encoder = LabelEncoder()
    y_class_train = class_encoder.fit_transform(y_class_train_raw)
    y_class_test  = class_encoder.transform(y_class_test_raw)

    print("[trainer] Training class model (Oil/Gas/Electricity) …")
    class_model = _fit_logreg(X_class_train, y_class_train)

    # --- Save ---
    joblib.dump(danger_model,    MODELS_DIR / "danger_model.pkl")
    joblib.dump(relevance_model, MODELS_DIR / "relevance_model.pkl")
    joblib.dump(class_model,     MODELS_DIR / "class_model.pkl")
    joblib.dump(class_encoder,   MODELS_DIR / "class_encoder.pkl")

    # Save test split for evaluate.py
    np.save(MODELS_DIR / "X_test.npy",           X_test)
    np.save(MODELS_DIR / "y_danger_test.npy",    yd_test)
    np.save(MODELS_DIR / "y_relevance_test.npy", yr_test)
    np.save(MODELS_DIR / "X_class_test.npy",     X_class_test)
    np.save(MODELS_DIR / "y_class_test.npy",     y_class_test)
    joblib.dump(t_test.tolist(),                  MODELS_DIR / "t_test.pkl")

    # --- Metrics ---
    yd_pred  = danger_model.predict(X_danger_test)
    yr_pred  = relevance_model.predict(X_test)
    yc_pred  = class_model.predict(X_class_test)

    danger_acc    = float((yd_pred  == yd_test).mean())
    relevance_acc = float((yr_pred  == yr_test).mean())
    class_acc     = float((yc_pred  == y_class_test).mean())

    print(f"[trainer] Danger    accuracy: {danger_acc:.2%}")
    print(f"[trainer] Relevance accuracy: {relevance_acc:.2%}")
    print(f"[trainer] Class     accuracy: {class_acc:.2%}")
    print(f"[trainer] Models saved to {MODELS_DIR}")

    return {
        "danger_accuracy":    danger_acc,
        "relevance_accuracy": relevance_acc,
        "class_accuracy":     class_acc,
    }


def run_retraining() -> dict:
    """
    Same as run_training() but merges processed (phase I) + human-corrected
    processed_phase_II before training. Human corrections get 10x sample weight.
    """
    texts, danger_labels, category_labels = _load_all_tagged_tweets()

    if len(texts) < MIN_SAMPLES:
        raise ValueError(f"Not enough tagged data ({len(texts)} < {MIN_SAMPLES})")

    X = _embed_texts(texts)

    y_danger    = np.array(danger_labels)
    y_relevance = np.array([
        0 if (c == "Other" and d == 0) else 1
        for c, d in zip(category_labels, danger_labels)
    ])
    y_category  = np.array(category_labels)
    texts_arr   = np.array(texts)

    (X_train, X_test,
     yd_train, yd_test,
     yr_train, yr_test,
     ycat_train, ycat_test,
     t_train, t_test) = train_test_split(
        X, y_danger, y_relevance, y_category, texts_arr,
        test_size=0.2, random_state=42, stratify=y_danger,
    )

    print("[trainer] Retraining danger model (TF-IDF) …")
    tfidf_danger   = TfidfVectorizer(max_features=20000, ngram_range=(1, 2), sublinear_tf=True)
    X_danger_train = tfidf_danger.fit_transform(t_train)
    X_danger_test  = tfidf_danger.transform(t_test)
    danger_model   = _fit_logreg(X_danger_train, yd_train)
    joblib.dump(tfidf_danger, MODELS_DIR / "tfidf_danger.pkl")

    print("[trainer] Retraining relevance model …")
    relevance_model = _fit_logreg(X_train, yr_train)

    relevant_mask_train  = yr_train == 1
    relevant_mask_test   = yr_test  == 1
    X_class_train        = X_train[relevant_mask_train]
    y_class_train_raw    = ycat_train[relevant_mask_train]
    X_class_test         = X_test[relevant_mask_test]
    y_class_test_raw     = ycat_test[relevant_mask_test]

    class_encoder  = LabelEncoder()
    y_class_train  = class_encoder.fit_transform(y_class_train_raw)
    y_class_test   = class_encoder.transform(y_class_test_raw)

    print("[trainer] Retraining class model (Oil/Gas/Electricity) …")
    class_model = _fit_logreg(X_class_train, y_class_train)

    joblib.dump(danger_model,    MODELS_DIR / "danger_model.pkl")
    joblib.dump(relevance_model, MODELS_DIR / "relevance_model.pkl")
    joblib.dump(class_model,     MODELS_DIR / "class_model.pkl")
    joblib.dump(class_encoder,   MODELS_DIR / "class_encoder.pkl")

    np.save(MODELS_DIR / "X_test.npy",           X_test)
    np.save(MODELS_DIR / "y_danger_test.npy",    yd_test)
    np.save(MODELS_DIR / "y_relevance_test.npy", yr_test)
    np.save(MODELS_DIR / "X_class_test.npy",     X_class_test)
    np.save(MODELS_DIR / "y_class_test.npy",     y_class_test)
    joblib.dump(t_test.tolist(),                  MODELS_DIR / "t_test.pkl")

    yd_pred  = danger_model.predict(X_danger_test)
    yr_pred  = relevance_model.predict(X_test)
    yc_pred  = class_model.predict(X_class_test)

    danger_acc    = float((yd_pred  == yd_test).mean())
    relevance_acc = float((yr_pred  == yr_test).mean())
    class_acc     = float((yc_pred  == y_class_test).mean())

    print(f"[trainer] Danger    accuracy: {danger_acc:.2%}")
    print(f"[trainer] Relevance accuracy: {relevance_acc:.2%}")
    print(f"[trainer] Class     accuracy: {class_acc:.2%}")
    print(f"[trainer] Models saved to {MODELS_DIR}")

    return {
        "danger_accuracy":    danger_acc,
        "relevance_accuracy": relevance_acc,
        "class_accuracy":     class_acc,
    }


if __name__ == "__main__":
    run_training()
