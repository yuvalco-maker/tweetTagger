import React, { useState, useEffect, useRef } from "react";
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
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  const suggestionRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("query_history_state");
    if (saved) {
      sessionStorage.removeItem("query_history_state");
      try {
        const s = JSON.parse(saved);
        setQueries(s.queries || []);
        setUsername(s.username || "");
        setMessage(s.message || "");
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!username.trim()) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(
          `${SERVER_URL}/users/search?q=${encodeURIComponent(username.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) setSuggestions(await res.json());
      } catch {}
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [username]);

  useEffect(() => {
    const handleClick = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
    sessionStorage.setItem("query_history_state", JSON.stringify({ queries, username, message }));
    navigate(`/query-results/${queryId}?from=query-history`);
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

          <div className={styles.searchBox} ref={suggestionRef}>
            <div className={styles.inputWrapper}>
              <input
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchUserQueries()}
                placeholder="Search by username"
                disabled={loading}
              />
              {suggestions.length > 0 && (
                <ul className={styles.suggestions}>
                  {suggestions.map((name) => (
                    <li
                      key={name}
                      className={styles.suggestionItem}
                      onMouseDown={() => {
                        setUsername(name);
                        setSuggestions([]);
                      }}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

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