import React from "react";
import styles from "./TaggedTweetCard.module.css";

function dangerLabel(value) {
  if (value === true) return "Dangerous";
  if (value === false) return "Not dangerous";
  return "—";
}

export default function TaggedTweetCard({ tweet, onClick }) {
  if (!tweet) return null;

  const isEdited = tweet.edited === true;

  const STATUS_LABELS = {
    ml_tagged:    "ML tagged",
    human_tagged: "Reviewed",
  };
  const status =
    STATUS_LABELS[tweet.status] ??
    (tweet.is_dangerous != null ? "ML tagged" : "Unprocessed");

  // Use original ML values as the base; fall back to current values if originals
  // were never stored (older documents).
  const mlDanger   = tweet.original_is_dangerous ?? tweet.is_dangerous;
  const mlCategory = tweet.original_category     ?? tweet.category;

  // The human edit changed at least one field
  const editChanged =
    isEdited &&
    (tweet.is_dangerous !== mlDanger || tweet.category !== mlCategory);

  return (
    <article
      className={styles.card}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      {/* ── Top row: author / date / badges ── */}
      <div className={styles.topRow}>
        <div className={styles.metaLeft}>
          <div className={styles.author}>
            <span>@{tweet.username || tweet.uploaded_by || "unknown"}</span>
          </div>
          {tweet.created_at && (
            <div className={styles.date}>
              {new Date(tweet.created_at).toLocaleString()}
            </div>
          )}
        </div>

        <div className={styles.metaRight}>
          <span className={styles.badge}>{status}</span>
          {isEdited && <span className={styles.editedBadge}>edited</span>}
        </div>
      </div>

      {/* ── Tweet content ── */}
      <div className={styles.text} dir="auto">
        {tweet.content || "No content"}
      </div>

      <div className={styles.divider} />

      {/* ── Tagging comparison ── */}
      {editChanged ? (
        /* Side-by-side: ML model vs. human edit */
        <div className={styles.compareGrid}>
          <div className={styles.compareCol}>
            <span className={styles.colLabel}>ML model</span>
            <div className={styles.tagItem}>
              <span className={styles.label}>category</span>
              <span className={styles.value}>{mlCategory || "—"}</span>
            </div>
            <div className={styles.tagItem}>
              <span className={styles.label}>danger</span>
              <span className={styles.value}>{dangerLabel(mlDanger)}</span>
            </div>
          </div>

          <div className={`${styles.compareCol} ${styles.editCol}`}>
            <span className={styles.colLabel}>Human edit</span>
            <div className={`${styles.tagItem} ${styles.tagItemEdit}`}>
              <span className={styles.label}>category</span>
              <span className={`${styles.value} ${styles.editValue}`}>
                {tweet.category || "—"}
              </span>
            </div>
            <div className={`${styles.tagItem} ${styles.tagItemEdit}`}>
              <span className={styles.label}>danger</span>
              <span className={`${styles.value} ${styles.editValue}`}>
                {dangerLabel(tweet.is_dangerous)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Single column: ML tagging (unedited or no change) */
        <div className={styles.tagsRow}>
          <div className={styles.tagItem}>
            <span className={styles.label}>category</span>
            <span className={styles.value}>{mlCategory || "—"}</span>
          </div>
          <div className={styles.tagItem}>
            <span className={styles.label}>danger</span>
            <span className={styles.value}>{dangerLabel(mlDanger)}</span>
          </div>
          {tweet.locked_at && (
            <div className={styles.tagItem}>
              <span className={styles.label}>locked at</span>
              <span className={styles.value}>
                {new Date(tweet.locked_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
