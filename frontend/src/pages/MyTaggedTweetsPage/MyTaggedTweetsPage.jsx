import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header.jsx";
import TaggedTweetCard from "../../components/TaggedTweetCard/TaggedTweetCard.jsx";
import styles from "./MyTaggedTweetsPage.module.css";

export default function MyTaggedTweetsPage() {
  const navigate = useNavigate();
  const serverUrl = import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(50);

  const fetchMyTagged = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/my_tagged_tweets?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.detail || "Failed to fetch your tagged tweets";
        setError(msg);

        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          navigate("/login");
        }
        return;
      }

      setTweets(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Network error while fetching tagged tweets");
    } finally {
      setLoading(false);
    }
  }, [navigate, serverUrl, limit]);

  useEffect(() => {
    fetchMyTagged();
  }, [fetchMyTagged]);

  return (
    <div className={styles.page}>
      <Header />

      <div className={styles.container}>
        <div className={styles.headerRow}>
          <div className={styles.titleWrap}>
            <h2 className={styles.title}>My Tagged Tweets</h2>
            <p className={styles.subtitle}>
              Showing {tweets.length} item{tweets.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.backBtn}
              type="button"
              onClick={() => {
                const isAdmin = localStorage.getItem("isADMIN") === "true";
                navigate(isAdmin ? "/home" : "/home-user");
              }}
            >
              Back
            </button>

            <select
              className={styles.select}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label="Limit"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={12000}>All</option>
              
            </select>

            <button
              className={styles.refreshBtn}
              type="button"
              onClick={fetchMyTagged}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.info}>Loading...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : tweets.length === 0 ? (
          <div className={styles.info}>No tagged tweets yet.</div>
        ) : (
          <div className={styles.list}>
            {tweets.map((tweet) => (
              <TaggedTweetCard
                key={tweet?.id || tweet?._id}
                tweet={tweet}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}