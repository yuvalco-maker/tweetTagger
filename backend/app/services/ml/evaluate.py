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

    X_test       = np.load(MODELS_DIR / "X_test.npy")
    yd_test      = np.load(MODELS_DIR / "y_danger_test.npy")
    yr_test      = np.load(MODELS_DIR / "y_relevance_test.npy")
    X_class_test = np.load(MODELS_DIR / "X_class_test.npy")
    y_class_test = np.load(MODELS_DIR / "y_class_test.npy")
    t_test       = joblib.load(MODELS_DIR / "t_test.pkl")
    tfidf_danger = joblib.load(MODELS_DIR / "tfidf_danger.pkl")
    X_danger_test = tfidf_danger.transform(t_test)

    return danger_model, relevance_model, class_model, class_encoder, \
           X_test, X_danger_test, yd_test, yr_test, X_class_test, y_class_test


def print_threshold_table(danger_model, X_danger_test, yd_test):
    probs = danger_model.predict_proba(X_danger_test)[:, 1]
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
     X_test, X_danger_test, yd_test, yr_test, X_class_test, y_class_test) = load_artifacts()

    print_threshold_table(danger_model, X_danger_test, yd_test)

    # --- Shared data ---
    probs = danger_model.predict_proba(X_danger_test)[:, 1]
    fpr, tpr, roc_thresholds = roc_curve(yd_test, probs)
    roc_auc = auc(fpr, tpr)
    thresh_idx = np.argmin(np.abs(roc_thresholds - 0.35))

    yd_pred = danger_model.predict(X_danger_test)
    yr_pred = relevance_model.predict(X_test)
    yc_pred = class_model.predict(X_class_test)
    labels  = class_encoder.classes_

    thresholds = [0.50, 0.48, 0.45, 0.43, 0.42, 0.40, 0.38, 0.36, 0.35]
    total_safe = int((yd_test == 0).sum())
    recalls, precisions, false_alarm_rates = [], [], []
    for t in thresholds:
        preds = (probs >= t).astype(int)
        recalls.append(recall_score(yd_test, preds, zero_division=0))
        precisions.append(precision_score(yd_test, preds, zero_division=0))
        false_alarm_rates.append(((preds == 1) & (yd_test == 0)).sum() / total_safe)

    report = classification_report(y_class_test, yc_pred, target_names=labels, output_dict=True)
    pr_precision = [report[l]["precision"] for l in labels]
    pr_recall    = [report[l]["recall"]    for l in labels]

    def _plot_roc(ax):
        ax.plot(fpr, tpr, color="#1DA1F2", lw=2, label=f"AUC = {roc_auc:.3f}")
        ax.plot([0, 1], [0, 1], color="gray", lw=1, linestyle="--")
        ax.scatter(fpr[thresh_idx], tpr[thresh_idx], color="#FF6B6B", zorder=5,
                   label=f"t=0.35 (recall={tpr[thresh_idx]:.2f}, FPR={fpr[thresh_idx]:.2f})")
        ax.set_title("Danger — ROC Curve")
        ax.set_xlabel("False Positive Rate")
        ax.set_ylabel("True Positive Rate")
        ax.legend(loc="lower right")

    def _plot_threshold(ax):
        ax.plot(thresholds, recalls,           color="#FF6B6B", lw=2, marker="o", label="Recall")
        ax.plot(thresholds, precisions,        color="#1DA1F2", lw=2, marker="o", label="Precision")
        ax.plot(thresholds, false_alarm_rates, color="#FFA500", lw=2, marker="o", label="False Alarm Rate")
        ax.axvline(x=0.35, color="gray", linestyle="--", lw=1, alpha=0.7, label="Chosen threshold (0.35)")
        ax.set_xlabel("Threshold")
        ax.set_ylabel("Rate")
        ax.set_title("Danger — Threshold Tradeoff")
        ax.legend(fontsize=9, loc="upper right")
        ax.invert_xaxis()

    def _plot_danger_cm(ax):
        ConfusionMatrixDisplay(
            confusion_matrix(yd_test, yd_pred),
            display_labels=["Safe", "Dangerous"]
        ).plot(ax=ax, colorbar=False, cmap="Blues")
        ax.set_title("Danger — Confusion Matrix")

    def _plot_relevance_cm(ax):
        ConfusionMatrixDisplay(
            confusion_matrix(yr_test, yr_pred),
            display_labels=["Other", "Relevant"]
        ).plot(ax=ax, colorbar=False, cmap="Greens")
        ax.set_title("Relevance — Confusion Matrix")

    def _plot_class_cm(ax):
        sns.heatmap(
            confusion_matrix(y_class_test, yc_pred),
            annot=True, fmt="d", cmap="Blues",
            xticklabels=labels, yticklabels=labels, ax=ax,
        )
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        ax.set_title("Class Model — Confusion Matrix (Oil/Gas/Electricity)")

    def _plot_class_pr(ax):
        x = np.arange(len(labels))
        ax.bar(x - 0.175, pr_precision, 0.35, label="Precision", color="#1DA1F2")
        ax.bar(x + 0.175, pr_recall,    0.35, label="Recall",    color="#FF6B6B")
        ax.set_xticks(x)
        ax.set_xticklabels(labels)
        ax.set_ylim([0, 1.1])
        ax.set_ylabel("Score")
        ax.set_title("Class Model — Precision & Recall")
        ax.legend()
        ax.axhline(y=0.7, color="gray", linestyle="--", lw=1, alpha=0.5)

    # --- Window 1: all graphs combined ---
    fig_all = plt.figure(figsize=(36, 20), num="All graphs")
    fig_all.suptitle("TweetTagger ML Evaluation — 3-Model Cascade", fontsize=18, fontweight="bold", y=0.99)
    gs = gridspec.GridSpec(2, 5, figure=fig_all, hspace=0.7, wspace=0.5)
    _plot_roc(fig_all.add_subplot(gs[0, 0]))
    _plot_threshold(fig_all.add_subplot(gs[0, 1]))
    _plot_danger_cm(fig_all.add_subplot(gs[0, 2]))
    _plot_relevance_cm(fig_all.add_subplot(gs[0, 3]))
    _plot_class_cm(fig_all.add_subplot(gs[1, 0:3]))
    _plot_class_pr(fig_all.add_subplot(gs[0:2, 4]))

    out_path = GRAPHS_DIR / "evaluation.png"
    fig_all.savefig(out_path, dpi=150, bbox_inches="tight")
    print(f"\n[evaluate] Saved to {out_path}")

    # --- Windows 2-7: one graph each ---
    for title, fn in [
        ("Danger — ROC Curve",                   _plot_roc),
        ("Danger — Threshold Tradeoff",          _plot_threshold),
        ("Danger — Confusion Matrix",            _plot_danger_cm),
        ("Relevance — Confusion Matrix",         _plot_relevance_cm),
        ("Class Model — Confusion Matrix",       _plot_class_cm),
        ("Class Model — Precision & Recall",     _plot_class_pr),
    ]:
        fig_single, ax_single = plt.subplots(figsize=(8, 6), num=title)
        fn(ax_single)
        fig_single.tight_layout()

    # --- Summary ---
    rel_acc   = float((yr_pred == yr_test).mean())
    class_acc = float((yc_pred == y_class_test).mean())
    print(f"\nDanger    AUC      : {roc_auc:.3f}")
    print(f"Danger    accuracy : {(danger_model.predict(X_danger_test) == yd_test).mean():.2%}")
    print(f"Relevance accuracy : {rel_acc:.2%}")
    print(f"Class     accuracy : {class_acc:.2%}")
    print("\nClass model report:")
    print(classification_report(y_class_test, yc_pred, target_names=labels))

    plt.show()


if __name__ == "__main__":
    main()
