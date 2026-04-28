import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header.jsx";
import Tweet from "../../components/Tweet/Tweet";
import styles from "./EscalatedTweetsPage.module.css";

export default function EscalatedTweetsPage() {
  const navigate = useNavigate();

  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const serverUrl = import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

  const fetchEscalatedTweets = async () => {
    setLoading(true);
    setError("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/get_escalated_tweets`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.detail || "Failed to fetch escalated tweets";
        setError(msg);

        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          navigate("/login");
        }
        return;
      }

      setTweets(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Network error while fetching escalated tweets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalatedTweets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClickTweet = (tweet) => {
    navigate("/escalation-tag", {
      state: { tweet }, 
    });
  };

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.bg} />

      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>Escalated Tweets</h2>

          <div className={styles.actions}>
            <button
              className={`${styles.btn} ${styles.btnMid}`}
              onClick={() => navigate("/home")}
            >
              back
            </button>

            <button
              className={`${styles.btn} ${styles.btnLight}`}
              onClick={fetchEscalatedTweets}
              disabled={loading}
            >
              refresh
            </button>
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {loading ? (
          <div className={styles.infoBox}>Loading...</div>
        ) : tweets.length === 0 ? (
          <div className={styles.infoBox}>No escalated tweets right now.</div>
        ) : (
          <div className={styles.grid}>
            {tweets.map((tweet, idx) => (
              <button
                key={tweet?._id || tweet?.id || idx}
                className={styles.tweetButton}
                onClick={() => handleClickTweet(tweet)}
                type="button"
              >
                <Tweet tweet={tweet} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}