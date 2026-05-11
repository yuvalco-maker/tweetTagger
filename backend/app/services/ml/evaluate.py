"""
Evaluation script for TweetTagger ML models (3-model cascade).
Run from project root:
    python -m backend.app.services.ml.evaluate
"""

from pathlib import Path
import joblib
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns
from sklearn.metrics import (
    roc_curve, auc, confusion_matrix, classification_report,
    ConfusionMatrixDisplay, precision_score, recall_score, f1_score, roc_auc_score,
)

MODELS_DIR = Path(__file__).resolve().parents[4] / "models"
GRAPHS_DIR = MODELS_DIR / "graphs"
GRAPHS_DIR.mkdir(exist_ok=True)


def load_artifacts():
    danger_model    = joblib.load(MODELS_DIR / "danger_model.pkl")
    relevance_model = joblib.load(MODELS_DIR / "relevance_model.pkl")
    class_model     = joblib.load(MODELS_DIR / "class_model.pkl")
    class_encoder   = joblib.load(MODELS_DIR / "class_encoder.pkl")

    X_test      = np.load(MODELS_DIR / "X_test.npy")
    yd_test     = np.load(MODELS_DIR / "y_danger_test.npy")
    yr_test     = np.load(MODELS_DIR / "y_relevance_test.npy")
    X_class_test = np.load(MODELS_DIR / "X_class_test.npy")
    y_class_test = np.load(MODELS_DIR / "y_class_test.npy")

    return danger_model, relevance_model, class_model, class_encoder, \
           X_test, yd_test, yr_test, X_class_test, y_class_test


def print_threshold_table(danger_model, X_test, yd_test):
    probs = danger_model.predict_proba(X_test)[:, 1]
    total_dangerous = int(yd_test.sum())
    total_safe = int((yd_test == 0).sum())

    print("\nDanger model threshold analysis:")
    print(f"{'Threshold':>10} {'Recall':>8} {'Caught':>8} {'FalseAlarms':>12} {'Precision':>10} {'F1':>8}")
    print("-" * 62)
    for t in [0.50, 0.45, 0.42, 0.40, 0.38, 0.35]:
        preds  = (probs >= t).astype(int)
        prec   = precision_score(yd_test, preds, zero_division=0)
        rec    = recall_score(yd_test, preds, zero_division=0)
        f1     = f1_score(yd_test, preds, zero_division=0)
        caught = int((preds & yd_test).sum())
        fp     = int(((preds == 1) & (yd_test == 0)).sum())
        print(f"{t:>10.2f} {rec:>8.2%} {caught:>4}/{total_dangerous:<4} {fp:>6}/{total_safe:<6} {prec:>10.2%} {f1:>8.2%}")


def main():
    print("[evaluate] Loading artifacts …")
    (danger_model, relevance_model, class_model, class_encoder,
     X_test, yd_test, yr_test, X_class_test, y_class_test) = load_artifacts()

    print_threshold_table(danger_model, X_test, yd_test)

    # --- Graphs ---
    fig = plt.figure(figsize=(36, 18))
    fig.suptitle("TweetTagger ML Evaluation — 3-Model Cascade", fontsize=18, fontweight="bold", y=0.99)
    gs = gridspec.GridSpec(2, 5, figure=fig, hspace=0.55, wspace=0.5)

    # 1. Danger ROC
    ax_roc = fig.add_subplot(gs[0, 0])
    probs = danger_model.predict_proba(X_test)[:, 1]
    fpr, tpr, _ = roc_curve(yd_test, probs)
    roc_auc = auc(fpr, tpr)
    ax_roc.plot(fpr, tpr, color="#1DA1F2", lw=2, label=f"AUC = {roc_auc:.3f}")
    ax_roc.plot([0, 1], [0, 1], color="gray", lw=1, linestyle="--")
    ax_roc.set_title("Danger — ROC Curve")
    ax_roc.set_xlabel("False Positive Rate")
    ax_roc.set_ylabel("True Positive Rate")
    ax_roc.legend(loc="lower right")

    # 2. Threshold analysis graph
    ax_thr = fig.add_subplot(gs[0, 1])
    thresholds = [0.50, 0.48, 0.45, 0.43, 0.42, 0.40, 0.38, 0.36, 0.35]
    total_dangerous = int(yd_test.sum())
    total_safe = int((yd_test == 0).sum())
    recalls, precisions, false_alarm_rates = [], [], []
    for t in thresholds:
        preds = (probs >= t).astype(int)
        recalls.append(recall_score(yd_test, preds, zero_division=0))
        precisions.append(precision_score(yd_test, preds, zero_division=0))
        false_alarm_rates.append(((preds == 1) & (yd_test == 0)).sum() / total_safe)
    ax_thr.plot(thresholds, recalls,           color="#FF6B6B", lw=2, marker="o", label="Recall")
    ax_thr.plot(thresholds, precisions,        color="#1DA1F2", lw=2, marker="o", label="Precision")
    ax_thr.plot(thresholds, false_alarm_rates, color="#FFA500", lw=2, marker="o", label="False Alarm Rate")
    ax_thr.axvline(x=0.45, color="gray", linestyle="--", lw=1, alpha=0.7, label="Threshold 0.45")
    ax_thr.set_xlabel("Threshold")
    ax_thr.set_ylabel("Rate")
    ax_thr.set_title("Danger — Threshold Tradeoff")
    ax_thr.legend(fontsize=9, loc="upper left", bbox_to_anchor=(0, -0.18), ncol=2)
    ax_thr.invert_xaxis()

    # 3. Danger confusion matrix
    ax_dcm = fig.add_subplot(gs[0, 2])
    yd_pred = danger_model.predict(X_test)
    ConfusionMatrixDisplay(
        confusion_matrix(yd_test, yd_pred),
        display_labels=["Safe", "Dangerous"]
    ).plot(ax=ax_dcm, colorbar=False, cmap="Blues")
    ax_dcm.set_title("Danger — Confusion Matrix")

    # 4. Relevance confusion matrix
    ax_rcm = fig.add_subplot(gs[0, 3])
    yr_pred = relevance_model.predict(X_test)
    ConfusionMatrixDisplay(
        confusion_matrix(yr_test, yr_pred),
        display_labels=["Other", "Relevant"]
    ).plot(ax=ax_rcm, colorbar=False, cmap="Greens")
    ax_rcm.set_title("Relevance — Confusion Matrix")

    # 5. Class confusion matrix
    ax_ccm = fig.add_subplot(gs[1, 0:3])
    yc_pred = class_model.predict(X_class_test)
    labels = class_encoder.classes_
    sns.heatmap(
        confusion_matrix(y_class_test, yc_pred),
        annot=True, fmt="d", cmap="Blues",
        xticklabels=labels, yticklabels=labels, ax=ax_ccm,
    )
    ax_ccm.set_xlabel("Predicted")
    ax_ccm.set_ylabel("Actual")
    ax_ccm.set_title("Class Model — Confusion Matrix (Oil/Gas/Electricity)")

    # 6. Class precision & recall
    ax_pr = fig.add_subplot(gs[0:2, 4])
    report = classification_report(y_class_test, yc_pred, target_names=labels, output_dict=True)
    precision = [report[l]["precision"] for l in labels]
    recall    = [report[l]["recall"]    for l in labels]
    x = np.arange(len(labels))
    ax_pr.bar(x - 0.175, precision, 0.35, label="Precision", color="#1DA1F2")
    ax_pr.bar(x + 0.175, recall,    0.35, label="Recall",    color="#FF6B6B")
    ax_pr.set_xticks(x)
    ax_pr.set_xticklabels(labels)
    ax_pr.set_ylim([0, 1.1])
    ax_pr.set_ylabel("Score")
    ax_pr.set_title("Class Model — Precision & Recall")
    ax_pr.legend()
    ax_pr.axhline(y=0.7, color="gray", linestyle="--", lw=1, alpha=0.5)

    out_path = GRAPHS_DIR / "evaluation.png"
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    print(f"\n[evaluate] Saved to {out_path}")

    # --- Summary ---
    rel_acc   = float((yr_pred == yr_test).mean())
    class_acc = float((yc_pred == y_class_test).mean())
    print(f"\nDanger    AUC      : {roc_auc:.3f}")
    print(f"Danger    accuracy : {(yd_pred == yd_test).mean():.2%}")
    print(f"Relevance accuracy : {rel_acc:.2%}")
    print(f"Class     accuracy : {class_acc:.2%}")
    print("\nClass model report:")
    print(classification_report(y_class_test, yc_pred, target_names=labels))

    plt.show()


if __name__ == "__main__":
    main()
