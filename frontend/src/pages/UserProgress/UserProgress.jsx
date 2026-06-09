import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./UserProgress.module.css";

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

const COLUMNS = [
  { key: "username", label: "User" },
  { key: "total_queries", label: "Queries" },
  { key: "total_fetched", label: "Tweets Fetched" },
  { key: "total_edits", label: "Edits" },
];

export default function UserProgress() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortCol, setSortCol] = useState("total_queries");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    if (!getIsAdmin()) { navigate("/home"); return; }
    const token = localStorage.getItem("token");
    fetch(`${SERVER_URL}/users/all-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json().catch(() => []))
      .then((data) => {
        if (Array.isArray(data)) setStats(data);
        else setError(data?.detail || "Failed to load stats.");
      })
      .catch(() => setError("Could not connect to the server."))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = [...stats].sort((a, b) => {
    const av = sortCol === "username" ? (a.username || "").toLowerCase() : (a[sortCol] ?? 0);
    const bv = sortCol === "username" ? (b.username || "").toLowerCase() : (b[sortCol] ?? 0);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalQueries = stats.reduce((s, u) => s + u.total_queries, 0);
  const totalFetched = stats.reduce((s, u) => s + u.total_fetched, 0);
  const totalEdits = stats.reduce((s, u) => s + u.total_edits, 0);

  const sortLabel = (col) => {
    if (sortCol !== col) return " ⇅";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Loading…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate("/admin")}>
          ← Back to Admin
        </button>
      </div>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <div>
          <h1 className={styles.heroTitle}>User Progress</h1>
          <p className={styles.heroSub}>{stats.length} users · activity overview</p>
        </div>
      </div>

      {/* ── Summary chips ── */}
      <div className={styles.chips}>
        <div className={styles.chip}>
          <span className={styles.chipNum}>{stats.length}</span>
          <span className={styles.chipLabel}>Users</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipNum}>{totalQueries}</span>
          <span className={styles.chipLabel}>Total Queries</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipNum}>{totalFetched}</span>
          <span className={styles.chipLabel}>Tweets Fetched</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipNum}>{totalEdits}</span>
          <span className={styles.chipLabel}>Total Edits</span>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* ── Table ── */}
      <div className={styles.tableSection}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map(({ key, label }) => (
                  <th
                    key={key}
                    className={`${styles.th} ${sortCol === key ? styles.thActive : ""}`}
                    onClick={() => handleSort(key)}
                  >
                    {label}
                    <span className={styles.sortIcon}>{sortLabel(key)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u._id} className={styles.tr}>
                  <td className={styles.td}>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>
                        {u.username?.slice(0, 2).toUpperCase() || "??"}
                      </div>
                      <div>
                        <div className={styles.username}>{u.username}</div>
                        <div className={styles.email}>{u.email}</div>
                      </div>
                      {u.isADMIN && <span className={styles.adminBadge}>Admin</span>}
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.num}>{u.total_queries}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.num}>{u.total_fetched}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.num}>{u.total_edits}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
