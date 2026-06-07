import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./UserActivity.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

function getIsAdmin() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return false;
    return !!JSON.parse(atob(token.split(".")[1])).isADMIN;
  } catch {
    return false;
  }
}

function StatCard({ label, value }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

export default function UserActivity() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("queries");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  if (!getIsAdmin()) {
    navigate("/home");
    return null;
  }

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(
          `${SERVER_URL}/users/search?q=${encodeURIComponent(val.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json().catch(() => []);
        if (Array.isArray(json) && json.length > 0) {
          setSuggestions(json);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch { /* ignore */ }
    }, 280);
  };

  const selectSuggestion = (name) => {
    setUsername(name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const fetchActivity = async () => {
    const clean = username.trim();
    if (!clean) {
      setMessage("Please enter a username.");
      return;
    }
    setMessage("");
    setLoading(true);
    setData(null);
    setShowSuggestions(false);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${SERVER_URL}/users/${encodeURIComponent(clean)}/activity`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json?.detail || "Failed to load activity.");
        return;
      }
      setData(json);
      setActiveTab("queries");
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") fetchActivity();
    if (e.key === "Escape") setShowSuggestions(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backButton} onClick={() => navigate("/admin")}>
          ← Back to Admin
        </button>

        <h1 className={styles.title}>User Activity</h1>
        <p className={styles.subtitle}>
          Search a username to see their queries and edited tweets.
        </p>

        <div className={styles.searchRow} ref={wrapperRef}>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              value={username}
              onChange={handleUsernameChange}
              onKeyDown={handleKey}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Enter username…"
              disabled={loading}
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className={styles.dropdown}>
                {suggestions.map((s) => (
                  <li
                    key={s}
                    className={styles.dropdownItem}
                    onMouseDown={() => selectSuggestion(s)}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            className={styles.searchBtn}
            onClick={fetchActivity}
            disabled={loading}
          >
            {loading ? "Loading…" : "Search"}
          </button>
        </div>

        {message && <p className={styles.message}>{message}</p>}

        {data && (
          <>
            <div className={styles.userBanner}>
              <div className={styles.avatar}>
                {data.user.username?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className={styles.bannerName}>{data.user.username}</div>
                <div className={styles.bannerEmail}>{data.user.email}</div>
              </div>
              {data.user.isADMIN && (
                <span className={styles.adminBadge}>Admin</span>
              )}
            </div>

            <div className={styles.statsRow}>
              <StatCard label="Queries run" value={data.stats.total_queries} />
              <StatCard label="Tweets fetched" value={data.stats.total_fetched ?? "—"} />
              <StatCard label="Tweets tagged" value={data.stats.total_edits} />
            </div>

            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === "queries" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("queries")}
              >
                Queries ({data.queries.length})
              </button>
              <button
                className={`${styles.tab} ${activeTab === "edits" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("edits")}
              >
                Edited Tweets ({data.edited_tweets.length})
              </button>
            </div>

            {activeTab === "queries" && (
              <div className={styles.list}>
                {data.queries.length === 0 && (
                  <p className={styles.empty}>No queries found.</p>
                )}
                {data.queries.map((q) => (
                  <button
                    key={q._id}
                    className={styles.queryCard}
                    onClick={() => navigate(`/query-results/${q._id}`)}
                  >
                    <div className={styles.queryTop}>
                      <strong>{q.keywords?.join(", ") || "No keywords"}</strong>
                      <span className={styles.statusBadge}>{q.status || "unknown"}</span>
                    </div>
                    <div className={styles.queryMeta}>
                      <span>Lang: {q.language}</span>
                      <span>{q.start_date} → {q.end_date}</span>
                      <span>Inserted: {q.inserted_count ?? 0}</span>
                      <span>ML: {q.ml_processed_count ?? 0}</span>
                      {q.dangerous_count > 0 && (
                        <span className={styles.dangerous}>
                          ⚠ {q.dangerous_count} dangerous
                        </span>
                      )}
                    </div>
                    <p className={styles.clickHint}>View results →</p>
                  </button>
                ))}
              </div>
            )}

            {activeTab === "edits" && (
              <div className={styles.list}>
                {data.edited_tweets.length === 0 && (
                  <p className={styles.empty}>No edited tweets found.</p>
                )}
                {data.edited_tweets.map((t) => (
                  <div key={t._id} className={styles.tweetCard}>
                    <p className={styles.tweetContent}>{t.content}</p>
                    <div className={styles.tweetMeta}>
                      <span className={styles.metaItem}>
                        <span className={styles.metaLabel}>Category:</span>
                        {t.original_category && t.original_category !== t.category ? (
                          <>
                            <span className={styles.original}>{t.original_category}</span>
                            <span className={styles.arrow}>→</span>
                            <span className={styles.current}>{t.category}</span>
                          </>
                        ) : (
                          <span className={styles.current}>{t.category}</span>
                        )}
                      </span>
                      <span className={styles.metaItem}>
                        <span className={styles.metaLabel}>Dangerous:</span>
                        {t.original_is_dangerous !== undefined && t.original_is_dangerous !== t.is_dangerous ? (
                          <>
                            <span className={styles.original}>{t.original_is_dangerous ? "Yes" : "No"}</span>
                            <span className={styles.arrow}>→</span>
                            <span className={t.is_dangerous ? styles.dangerYes : styles.dangerNo}>
                              {t.is_dangerous ? "Yes" : "No"}
                            </span>
                          </>
                        ) : (
                          <span className={t.is_dangerous ? styles.dangerYes : styles.dangerNo}>
                            {t.is_dangerous ? "Yes" : "No"}
                          </span>
                        )}
                      </span>
                      {t.confidence != null && (
                        <span className={styles.metaItem}>
                          <span className={styles.metaLabel}>Confidence:</span>
                          {(t.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <button
                      className={styles.detailLink}
                      onClick={() => navigate(`/tweet-detail/${t.tweet_id || t._id}`)}
                    >
                      Open tweet →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
