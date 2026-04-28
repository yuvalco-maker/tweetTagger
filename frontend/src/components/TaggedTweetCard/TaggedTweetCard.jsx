import React from "react";
import styles from "./TaggedTweetCard.module.css";

export default function TaggedTweetCard({ tweet }) {
  if (!tweet) return null;

  const dangerLabel =
    tweet.is_dangerous === true
      ? "dangerous"
      : tweet.is_dangerous === false
      ? "not dangerous"
      : "unknown";

  const status = tweet.status || "pending";

  return (
    <article className={styles.card}>
      <div className={styles.topRow}>
        <div className={styles.metaLeft}>
          <div className={styles.author}>
            <span>{tweet.uploaded_by || "Unknown uploader"}</span>
          </div>

          {tweet.created_at ? (
            <div className={styles.date}>
              {new Date(tweet.created_at).toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className={styles.metaRight}>
          <span className={styles.badge}>{status}</span>
        </div>
      </div>

      <div className={styles.text} dir="auto">
        {tweet.content || "No content"}
      </div>

      <div className={styles.divider} />

      <div className={styles.tagsRow}>
        <div className={styles.tagItem}>
          <span className={styles.label}>category</span>
          <span className={styles.value}>{tweet.category || "—"}</span>
        </div>

        <div className={styles.tagItem}>
          <span className={styles.label}>danger</span>
          <span className={styles.value}>{dangerLabel}</span>
        </div>

        {}
        <div className={styles.tagItem}>
          <span className={styles.label}>tagged by</span>
          <span className={styles.value}>
            {tweet.tagged_by_username || "Me"}
          </span>
        </div>

        {tweet.locked_at ? (
          <div className={styles.tagItem}>
            <span className={styles.label}>locked at</span>
            <span className={styles.value}>
              {new Date(tweet.locked_at).toLocaleString()}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}