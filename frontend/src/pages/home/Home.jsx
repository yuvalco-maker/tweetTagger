import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header.jsx";
import styles from "./Home.module.css";

export default function Home() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username") || "User";

  React.useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.bg} />

      <div className={styles.container}>
        <div className={styles.card}>
          <h2 className={styles.title}>TweetTag #</h2>
          <p className={styles.welcome}>hello {username}!</p>

          <div className={styles.buttonGrid}>
            <button
              className={`${styles.btn} ${styles.btnDark}`}
              onClick={() => navigate("/tweets")}
            >
              pull random tweet
            </button>

            <button
              className={`${styles.btn} ${styles.btnMid}`}
              onClick={() => navigate("/tags")}
            >
              view my tags
            </button>

            <button
              className={`${styles.btn} ${styles.btnLight}`}
              onClick={() => navigate("/my-impact")}
            >
              your impact
            </button>

            <button
              className={`${styles.btn} ${styles.btnLight}`}
              onClick={() => navigate("/tagged-tweets")}
            >
              view database
            </button>

            <button
              className={`${styles.btn} ${styles.btnLight}`}
              onClick={() => navigate("/escalation")}
            >
              tag escalated tweets
            </button>

            <button
              className={`${styles.btn} ${styles.btnLight}`}
              onClick={() => navigate("/table")}
            >
              tagging rankings
            </button>

            <button
              className={`${styles.btn} ${styles.btnLight}`}
              onClick={() => navigate("/admin-daily-stats")}
            >
              daily stats
            </button>

            <button
              className={`${styles.btn} ${styles.btnLight}`}
              onClick={() => navigate("/admin-tagging-distribution")}
            >
              distribution stats
            </button>

            <button
              className={`${styles.btn} ${styles.btnLight} ${styles.fullWidthBtn}`}
              onClick={() => navigate("/admin-user-insights")}
            >
              user insights
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}