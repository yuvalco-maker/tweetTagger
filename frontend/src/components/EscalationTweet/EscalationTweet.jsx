function isRTL(text = "") {
  return /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

function EscalationTweet({ tweet }) {
  if (!tweet) return null;

  const cleanContent = tweet?.content?.trim() || "";
  const rtl = isRTL(cleanContent);

  return (
    <div className={styles.card}>
      <div className={styles.tweetScroll}>
        <div
          className={styles.tweetText}
          dir={rtl ? "rtl" : "ltr"}
          style={{ textAlign: rtl ? "right" : "left" }}
        >
          {cleanContent}
        </div>
      </div>
    </div>
  );
}