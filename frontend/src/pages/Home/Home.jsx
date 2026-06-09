import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import styles from "./Home.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

console.log("[config] Backend URL:", SERVER_URL);

function getIsAdmin() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return false;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return !!payload.isADMIN;
  } catch {
    return false;
  }
}

const NAV_ITEMS = [
  {
    icon: "🔍",
    label: "Search Query",
    desc: "Fetch tweets from Apify by keywords & date range",
    path: "/search-query",
    primary: true,
  },
  {
    icon: "📋",
    label: "Query History",
    desc: "Browse and revisit past searches",
    path: "/query-history",
  },
  {
    icon: "📊",
    label: "ML Statistics",
    desc: "Accuracy breakdown & tagging summary",
    path: "/stats",
  },
  {
    icon: "🧩",
    label: "Threat Themes",
    desc: "Semantic clustering of dangerous tweets",
    path: "/threat-themes",
  },
  {
    icon: "🌍",
    label: "Global Threat Map",
    desc: "Heat-map of dangerous tweet locations",
    path: "/threat-map",
  },
  {
    icon: "🐦",
    label: "All Tagged Tweets",
    desc: "Full list of ML-processed tweets",
    path: "/all-tweets",
  },
  {
    icon: "🔬",
    label: "Entity Explorer",
    desc: "Knowledge graph & threat queries for any entity",
    path: "/entity-explorer",
  },
  {
    icon: "📌",
    label: "My Activity",
    desc: "Your tagged tweets and query history",
    path: "/my-activity",
  },
];

function Home() {
  const navigate = useNavigate();
  const isAdmin = getIsAdmin();

  const [stats, setStats] = useState(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    const token = localStorage.getItem("token");
    fetch(`${SERVER_URL}/admin/model-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .catch(() => null)
      .then((data) => { if (data) setStats(data); });
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !stats?.in_progress) return;
    const interval = setInterval(() => {
      const token = localStorage.getItem("token");
      fetch(`${SERVER_URL}/admin/model-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .catch(() => null)
        .then((data) => {
          if (!data) return;

          setStats(data);
          if (!data.in_progress) {
            setRetraining(false);
            setRetrainMsg("Retraining complete.");
            clearInterval(interval);
          }
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [isAdmin, stats?.in_progress]);

  const handleRetrain = async () => {
    const token = localStorage.getItem("token");
    setRetraining(true);
    setRetrainMsg("");
    console.log("[retrain] Sending retrain request…");
    const res = await fetch(`${SERVER_URL}/admin/retrain`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[retrain] Failed to start:", data?.detail);
      setRetraining(false);
      setRetrainMsg(data?.detail || "Failed to start retraining.");
    } else {
      console.log("[retrain] Started successfully");
      setStats((s) => ({ ...s, in_progress: true }));
      setRetrainMsg("Retraining started, this will take a few minutes…");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Header ── */}
        <div className={styles.hero}>
          <h1 className={styles.title}>Tweet-Tagger</h1>
          <p className={styles.subtitle}>
            Infrastructure threat intelligence — fetch, classify, and analyse.
          </p>
        </div>

        {/* ── Navigation grid ── */}
        <nav className={styles.grid}>
          {NAV_ITEMS.map(({ icon, label, desc, path, primary }) => (
            <button
              key={path}
              className={primary ? `${styles.navBtn} ${styles.navBtnPrimary}` : styles.navBtn}
              onClick={() => navigate(path)}
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navText}>
                <span className={styles.navLabel}>{label}</span>
                <span className={styles.navDesc}>{desc}</span>
              </span>
              <span className={styles.navArrow}>→</span>
            </button>
          ))}

          {isAdmin && (
            <button
              className={`${styles.navBtn} ${styles.navBtnAdmin}`}
              onClick={() => navigate("/admin")}
            >
              <span className={styles.navIcon}>⚙️</span>
              <span className={styles.navText}>
                <span className={styles.navLabel}>Admin Panel</span>
                <span className={styles.navDesc}>Model retraining &amp; system config</span>
              </span>
              <span className={styles.navArrow}>→</span>
            </button>
          )}
        </nav>

        {/* ── Admin retrain box ── */}
        {isAdmin && stats && (
          <div className={styles.retrainBox}>
            <div className={styles.retrainInfo}>
              <span>{stats.edit_count ?? 0} edits since last training</span>
              {stats.last_trained_at && (
                <span>Last trained: {new Date(stats.last_trained_at).toLocaleDateString()}</span>
              )}
              {stats.last_metrics && (
                <span>
                  Last accuracy — Danger: {(stats.last_metrics.danger_accuracy * 100).toFixed(1)}%,
                  Relevance: {(stats.last_metrics.relevance_accuracy * 100).toFixed(1)}%,
                  Class: {(stats.last_metrics.class_accuracy * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <button
              className={styles.retrainButton}
              onClick={handleRetrain}
              disabled={retraining || stats.in_progress || (stats.edit_count ?? 0) < (stats.retrain_threshold ?? 300)}
            >
              {stats.in_progress
                ? "Training in progress…"
                : `Retrain model (${stats.retrain_threshold ?? 300} edits required)`}
            </button>
            {retrainMsg && <p className={styles.retrainMsg}>{retrainMsg}</p>}
            {stats.last_error && <p className={styles.retrainError}>Last error: {stats.last_error}</p>}
          </div>
        )}

      </div>
    </div>
  );
}

export default Home;
