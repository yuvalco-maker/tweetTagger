import React, { useState, useEffect } from "react";
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

  // user list view
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);

  // detail view
  const [selected, setSelected] = useState(null); // username string
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("queries");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  if (!getIsAdmin()) {
    navigate("/home");
    return null;
  }

  // load all users once
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${SERVER_URL}/users/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json().catch(() => []))
      .then((json) => {
        if (Array.isArray(json)) setUsers(json);
      })
      .finally(() => setUsersLoading(false));
  }, []);

  const filteredUsers = users.filter((u) =>
    u.username?.toLowerCase().includes(filter.toLowerCase()) ||
    u.email?.toLowerCase().includes(filter.toLowerCase())
  );

  const openUser = async (username) => {
    setSelected(username);
    setData(null);
    setDetailError("");
    setActiveTab("queries");
    setDetailLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${SERVER_URL}/users/${encodeURIComponent(username)}/activity`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setDetailError(json?.detail || "Failed to load."); return; }
      setData(json);
    } catch {
      setDetailError("Could not connect to the server.");
    } finally {
      setDetailLoading(false);
    }
  };

  const goBack = () => {
    setSelected(null);
    setData(null);
    setDetailError("");
  };

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selected !== null) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <button className={styles.backButton} onClick={goBack}>
            ← Back to Users
          </button>

          {detailLoading && <p className={styles.loadingMsg}>Loading activity…</p>}
          {detailError && <p className={styles.message}>{detailError}</p>}

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
                  Tagged Tweets ({data.edited_tweets.length})
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
                    <p className={styles.empty}>No tagged tweets found.</p>
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

  // ── User list view ───────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backButton} onClick={() => navigate("/admin")}>
          ← Back to Admin
        </button>

        <h1 className={styles.title}>User Activity</h1>
        <p className={styles.subtitle}>
          {usersLoading ? "Loading users…" : `${users.length} users — click one to see their activity.`}
        </p>

        <div className={styles.filterRow}>
          <input
            className={styles.input}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by username or email…"
            autoComplete="off"
          />
          {filter && (
            <button className={styles.clearBtn} onClick={() => setFilter("")}>✕</button>
          )}
        </div>

        {!usersLoading && filteredUsers.length === 0 && (
          <p className={styles.message}>No users match "{filter}".</p>
        )}

        <div className={styles.userGrid}>
          {filteredUsers.map((u) => (
            <button
              key={u._id}
              className={styles.userCard}
              onClick={() => openUser(u.username)}
            >
              <div className={styles.userCardAvatar}>
                {u.username?.slice(0, 2).toUpperCase()}
              </div>
              <div className={styles.userCardInfo}>
                <span className={styles.userCardName}>{u.username}</span>
                <span className={styles.userCardEmail}>{u.email}</span>
              </div>
              {u.isADMIN && <span className={styles.adminBadge}>Admin</span>}
              <span className={styles.userCardArrow}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
