import styles from "./Tweet.module.css";

export default function Tweet({ tweet }) {
  const date = tweet?.created_at
    ? new Date(tweet.created_at).toLocaleString()
    : "";

  return (
    <div className={styles.card}>
      <div className={styles.date}>{date}</div>
      {/* Scrollable area starts here */}
      <div className={styles.scrollContainer}>
        <div className={styles.content} dir="auto">{tweet?.content}</div>
      </div>
    </div>
  );
}