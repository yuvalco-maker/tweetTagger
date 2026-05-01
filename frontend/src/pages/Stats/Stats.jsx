import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Stats.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

function StatBox({ title, count, percentage }) {
  return (
    <div className={styles.statBox}>
      <h3>{title}</h3>
      <p className={styles.count}>{count}</p>
      <span>{percentage}%</span>
    </div>
  );
}

function CategoryTable({ title, data }) {
  return (
    <div className={styles.tableCard}>
      <h2>{title}</h2>

      {!data || data.length === 0 ? (
        <p className={styles.empty}>No data yet</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item) => (
              <tr key={item.category}>
                <td>{item.category}</td>
                <td>{item.count}</td>
                <td>{item.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Stats() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const res = await fetch(
          `${SERVER_URL}/tweet-fetch/global-processed-stats`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMessage(data?.detail || "Failed to load statistics.");
          return;
        }

        setStats(data);
      } catch {
        setMessage("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [navigate]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>Loading statistics...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back home
        </button>

        <h1 className={styles.title}>Global ML Statistics</h1>

        <p className={styles.subtitle}>
          Statistics calculated from all tweets processed by the model.
        </p>

        {message && <p className={styles.message}>{message}</p>}

        {stats && (
          <>
            <p className={styles.totalLine}>
              Total model-tagged tweets:{" "}
              <strong>{stats.total_ml_tagged}</strong>
            </p>

            <div className={styles.statsGrid}>
              <StatBox
                title="Dangerous"
                count={stats.dangerous?.count ?? 0}
                percentage={stats.dangerous?.percentage ?? 0}
              />

              <StatBox
                title="Not dangerous"
                count={stats.not_dangerous?.count ?? 0}
                percentage={stats.not_dangerous?.percentage ?? 0}
              />
            </div>

            <CategoryTable
              title="Categories overall"
              data={stats.categories_total}
            />

            <CategoryTable
              title="Categories inside dangerous tweets"
              data={stats.categories_dangerous}
            />

            <CategoryTable
              title="Categories inside not dangerous tweets"
              data={stats.categories_not_dangerous}
            />
          </>
        )}
      </div>
    </div>
  );
}