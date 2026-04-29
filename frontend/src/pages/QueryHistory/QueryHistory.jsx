import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./QueryHistory.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

export default function QueryHistory() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchMyQueries = async () => {
    await fetchQueries(`${SERVER_URL}/tweet-fetch/my-queries?limit=50`);
  };

  const fetchUserQueries = async () => {
    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setMessage("Please enter a username.");
      return;
    }

    await fetchQueries(
      `${SERVER_URL}/tweet-fetch/user-queries?username=${encodeURIComponent(
        cleanUsername
      )}&limit=50`
    );
  };

  const fetchQueries = async (url) => {
    setMessage("");
    setLoading(true);

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        setQueries([]);
        setMessage(data?.detail || "Failed to load queries.");
        return;
      }

      setQueries(data);

      if (data.length === 0) {
        setMessage("No queries found.");
      }
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const openQueryResults = (queryId) => {
    navigate(`/query-results/${queryId}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back home
        </button>

        <h1 className={styles.title}>Query History</h1>

        <p className={styles.subtitle}>
          Search your own query history or view another user&apos;s query
          history by username.
        </p>

        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            onClick={fetchMyQueries}
            disabled={loading}
          >
            My queries
          </button>

          <div className={styles.searchBox}>
            <input
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Search by username"
              disabled={loading}
            />

            <button
              className={styles.secondaryButton}
              onClick={fetchUserQueries}
              disabled={loading}
            >
              Search user
            </button>
          </div>
        </div>

        {loading && <p className={styles.message}>Loading queries...</p>}
        {message && <p className={styles.message}>{message}</p>}

        <div className={styles.list}>
          {queries.map((query) => (
            <button
              key={query._id}
              className={styles.queryCard}
              onClick={() => openQueryResults(query._id)}
            >
              <div className={styles.queryTop}>
                <strong>{query.keywords?.join(", ") || "No keywords"}</strong>
                <span>{query.status || "unknown"}</span>
              </div>

              <div className={styles.queryMeta}>
                <span>Language: {query.language}</span>
                <span>
                  Dates: {query.start_date} → {query.end_date}
                </span>
                <span>Max: {query.max_items}</span>
                <span>Inserted: {query.inserted_count ?? 0}</span>
                <span>ML: {query.ml_processed_count ?? 0}</span>
              </div>

              <p className={styles.clickHint}>Click to view fetched tweets →</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}