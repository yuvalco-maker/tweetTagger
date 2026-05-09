import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TaggedTweetCard from "../../components/TaggedTweetCard/TaggedTweetCard.jsx";
import styles from "./QueryResults.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

export default function QueryResults() {
  const { queryId } = useParams();
  const navigate = useNavigate();

  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchTweets = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const res = await fetch(
          `${SERVER_URL}/tweet-fetch/query/${queryId}/tweets`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json().catch(() => []);

        if (!res.ok) {
          setMessage(data?.detail || "Failed to load tweets.");
          return;
        }

        setTweets(data);
      } catch {
        setMessage("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchTweets();
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

        <button
          className={styles.aiButton}
          onClick={() => navigate(`/ai-summary/${queryId}`)}
        >
          AI Summary
        </button>
      </div>

      <h1>Query Results</h1>
      <p>{tweets.length} tweets found</p>
    </div>

    {message && <p className={styles.message}>{message}</p>}

    <div className={styles.list}>
      {tweets.map((tweet) => (
        <TaggedTweetCard
          key={tweet._id || tweet.tweet_id}
          tweet={tweet}
          onClick={
            tweet.tweet_id
              ? () => navigate(`/tweet-detail/${tweet.tweet_id}`)
              : undefined
          }
        />
      ))}
    </div>
  </div>
);
}