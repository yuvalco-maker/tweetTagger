import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header.jsx";
import styles from "./HomeUser.module.css";

export default function HomeUser() {
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

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => navigate("/tweets")}
          >
            pull random tweet
          </button>

          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => navigate("/tags")}
          >
            view my tags
          </button>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => navigate("/my-impact")}
          >
            my impact
          </button>
        </div>
      </div>
    </div>
  );
}