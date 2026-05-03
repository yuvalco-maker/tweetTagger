import styles from "./TweetCard.module.css";

export default function TweetCard({ tweet, onClick }) {
  const dangerText =
    tweet.is_dangerous === true
      ? "Dangerous"
      : tweet.is_dangerous === false
      ? "Not dangerous"
      : "Not classified";

  return (
    <article className={styles.card} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className={styles.top}>
        <span className={styles.username}>
          @{tweet.username || "unknown"}
        </span>

        <div className={styles.badges}>
          <span className={styles.badge}>{dangerText}</span>
          {tweet.edited && <span className={styles.editedBadge}>edited</span>}
        </div>
      </div>

      <p className={styles.content}>{tweet.content}</p>

      <div className={styles.meta}>
        <span>Category: {tweet.category || "None"}</span>
        <span>Status: {tweet.status || "pending"}</span>
      </div>

      {tweet.url && (
        <a
          className={styles.link}
          href={tweet.url}
          target="_blank"
          rel="noreferrer"
        >
          Open original tweet
        </a>
      )}
    </article>
  );
}