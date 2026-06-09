import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./MyActivity.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

function StatCard({ label, value }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

export default function MyActivity() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("tweets");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetch(`${SERVER_URL}/users/me/activity`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) { navigate("/login"); return null; }
        return res.json().catch(() => null);
      })
      .then((json) => {
        if (!json) { setMessage("Failed to load activity."); return; }
        if (json.detail) { setMessage(json.detail); return; }
        setData(json);
      })
      .catch(() => setMessage("Could not connect to the server."))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>Loading your activity…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back to Home
        </button>

        <h1 className={styles.title}>My Activity</h1>
        <p className={styles.subtitle}>Your queries and tweets you've tagged.</p>

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
              <StatCard label="Tweets fetched" value={data.stats.total_fetched} />
              <StatCard label="Tweets tagged" value={data.stats.total_edits} />
            </div>

            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === "tweets" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("tweets")}
              >
                Tweets I Tagged ({data.edited_tweets.length})
              </button>
              <button
                className={`${styles.tab} ${activeTab === "queries" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("queries")}
              >
                My Queries ({data.queries.length})
              </button>
            </div>

            {activeTab === "tweets" && (
              <div className={styles.list}>
                {data.edited_tweets.length === 0 && (
                  <p className={styles.empty}>You haven't tagged any tweets yet.</p>
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

            {activeTab === "queries" && (
              <div className={styles.list}>
                {data.queries.length === 0 && (
                  <p className={styles.empty}>No queries found.</p>
                )}
                {data.queries.map((q) => (
                  <button
                    key={q._id}
                    className={styles.queryCard}
                    onClick={() => navigate(`/query-results/${q._id}?from=my-activity`)}
                  >
                    <div className={styles.queryTop}>
                      <strong>{q.keywords?.join(", ") || "No keywords"}</strong>
                      <span className={styles.statusBadge}>{q.status || "unknown"}</span>
                    </div>
                    <div className={styles.queryMeta}>
                      <span>Lang: {q.language}</span>
                      <span>{q.start_date} → {q.end_date}</span>
                      <span>Fetched: {q.inserted_count ?? 0}</span>
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
          </>
        )}
      </div>
    </div>
  );
}
