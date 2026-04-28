import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header.jsx";
import styles from "./TaggingLeaderboardPage.module.css";

export default function TaggingLeaderboardPage() {
  const navigate = useNavigate();
  const serverUrl = import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/get_tagging_leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.detail || "Failed to fetch leaderboard";
        setError(msg);

        // ✅ אם לא מורשה/לא אדמין -> להעיף ללוגין
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          navigate("/login");
        }
        return;
      }

      setLeaders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Network error while fetching leaderboard");
    } finally {
      setLoading(false);
    }
  }, [navigate, serverUrl]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
  <div className={styles.page}>
    <Header />

    <div className={styles.container} aria-busy={loading}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Tagging Leaderboard</h2>

        <div className={styles.actions}>
          <button
            className={styles.backBtn}
            onClick={() => navigate("/home")}
            type="button"
          >
            Back
          </button>

          <button
            className={styles.refreshBtn}
            onClick={fetchLeaderboard}
            disabled={loading}
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.info} aria-live="polite">
          Loading...
        </div>
      ) : error ? (
        <div className={styles.error} aria-live="polite">
          {error}
        </div>
      ) : leaders.length === 0 ? (
        <div className={styles.info} aria-live="polite">
          No data yet.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Tagged</th>
              </tr>
            </thead>

            <tbody>
              {leaders.map((user, index) => {
                const username = user?.username || "Unknown";
                const total = user?.total_processed ?? 0;

                return (
                  <tr key={`${username}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{username}</td>
                    <td>{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
);
}