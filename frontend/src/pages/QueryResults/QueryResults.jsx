import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TaggedTweetCard from "../../components/TaggedTweetCard/TaggedTweetCard.jsx";
import TweetMap from "../../components/TweetMap/TweetMap.jsx";
import styles from "./QueryResults.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

function dangerLabel(value) {
  if (value === true) return "Dangerous";
  if (value === false) return "Safe";
  return "—";
}

export default function QueryResults() {
  const { queryId } = useParams();
  const navigate = useNavigate();

  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [queue, setQueue] = useState(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueOpen, setQueueOpen] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    const fetchTweets = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/tweet-fetch/query/${queryId}/tweets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) { setMessage(data?.detail || "Failed to load tweets."); return; }
        setTweets(data);
      } catch {
        setMessage("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    const fetchQueue = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/review-queue/query/${queryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (res.ok) setQueue(data);
      } finally {
        setQueueLoading(false);
      }
    };

    fetchTweets();
    fetchQueue();
  }, [queryId, navigate]);

  if (loading) {
    return <div className={styles.page}>Loading tweets...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerActions}>
          <button className={styles.backButton} onClick={() => navigate("/home")}>
            ← Back to search
          </button>
          <button className={styles.aiButton} onClick={() => navigate(`/ai-summary/${queryId}`)}>
            AI Summary
          </button>
        </div>
        <h1>Query Results</h1>
        <p>{tweets.length} tweets found</p>
      </div>

      {message && <p className={styles.message}>{message}</p>}

      {/* Threat Location Map */}
      {(() => {
        const allLocations = tweets.flatMap((t) =>
          Array.isArray(t.coordinates)
            ? t.coordinates.map((c) => ({
                ...c,
                category: t.category || null,
                is_dangerous: t.is_dangerous ?? null,
              }))
            : []
        );
        return allLocations.length > 0 ? (
          <TweetMap coordinates={allLocations} queryId={queryId} />
        ) : null;
      })()}

      {/* Review Queue */}
      <div className={styles.queueSection}>
        <button className={styles.queueToggle} onClick={() => setQueueOpen((o) => !o)}>
          <span>Suggested Review Queue</span>
          <span className={styles.queueChevron}>{queueOpen ? "▲" : "▼"}</span>
        </button>

        {queueOpen && (
          <div className={styles.queueBody}>
            {queueLoading ? (
              <p className={styles.queueNote}>Running LP optimizer...</p>
            ) : !queue ? (
              <p className={styles.queueNote}>Could not load review queue.</p>
            ) : queue.no_review ? (
              <p className={styles.queueNote}>✓ {queue.reason}</p>
            ) : (
              <>
                <p className={styles.queueNote}>
                  LP selected <strong>{queue.queue.length}</strong> tweet{queue.queue.length !== 1 ? "s" : ""} to review — minimum set covering all categories.
                </p>
                <div className={styles.queueList}>
                  {queue.queue.map((item) => (
                    <div
                      key={item._id}
                      className={styles.queueCard}
                      onClick={() => item.tweet_id && navigate(`/tweet-detail/${item.tweet_id}`)}
                      style={item.tweet_id ? { cursor: "pointer" } : undefined}
                    >
                      <div className={styles.queueCardTop}>
                        <span className={item.is_dangerous ? styles.dangerBadge : styles.safeBadge}>
                          {dangerLabel(item.is_dangerous)}
                        </span>
                        <span className={styles.categoryBadge}>{item.category || "—"}</span>
                        <span className={styles.uncertaintyBadge}>
                          {(item.uncertainty * 100).toFixed(0)}% uncertain
                        </span>
                      </div>
                      <p className={styles.queueContent}>{item.content}</p>
                      <p className={styles.queueReason}>↳ {item.reason}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.list}>
        {tweets.map((tweet) => (
          <TaggedTweetCard
            key={tweet._id || tweet.tweet_id}
            tweet={tweet}
            onClick={tweet.tweet_id ? () => navigate(`/tweet-detail/${tweet.tweet_id}`) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
