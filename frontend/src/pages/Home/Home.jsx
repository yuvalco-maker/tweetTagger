import { useNavigate } from "react-router-dom";
import styles from "./Home.module.css";

function Home() {
  const navigate = useNavigate();

  const handleSearchQueryClick = () => {
    navigate("/search-query");
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome to Tweet-Tagger</h1>

        <p className={styles.description}>
          Fetch tweets, analyze them, and prepare data for ML tagging.
        </p>

        <button className={styles.button} onClick={handleSearchQueryClick}>
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
      </div>
    </div>
  );
}

export default Home;