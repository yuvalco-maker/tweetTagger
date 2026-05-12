import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import styles from "./Home.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";


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
    const res = await fetch(`${SERVER_URL}/admin/retrain`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRetraining(false);
      setRetrainMsg(data?.detail || "Failed to start retraining.");
    } else {
      setStats((s) => ({ ...s, in_progress: true }));
      setRetrainMsg("Retraining started, this will take a few minutes…");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome to Tweet-Tagger</h1>

        <p className={styles.description}>
          Fetch tweets, analyze them, and prepare data for ML tagging.
        </p>

        <button className={styles.button} onClick={() => navigate("/search-query")}>
          Search Query
        </button>

        <button className={styles.button} onClick={() => navigate("/query-history")}>
          Query History
        </button>

        <button className={styles.button} onClick={() => navigate("/stats")}>
          ML Statistics
        </button>

        <button className={styles.button} onClick={() => navigate("/threat-themes")}>
          Threat Themes
        </button>

        <button className={styles.button} onClick={() => navigate("/all-tweets")}>
          All Tagged Tweets
        </button>

        {isAdmin && (
          <button className={styles.button} onClick={() => navigate("/admin")}>
            Admin Panel
          </button>
        )}

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
              {stats.in_progress ? "Training in progress…" : `Retrain model (${stats.retrain_threshold ?? 300} edits required)`}
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