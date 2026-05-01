import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TweetCard from "../../components/TweetCard/TweetCard.jsx";
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
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back to search
        </button>

        <h1>Query Results</h1>
        <p>{tweets.length} tweets found</p>
      </div>

      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.list}>
        {tweets.map((tweet) => (
          <TweetCard key={tweet._id || tweet.id || tweet.tweet_id} tweet={tweet} />
        ))}
      </div>
    </div>
  );
}