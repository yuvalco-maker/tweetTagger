import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import styles from "./AdminTaggingDistributionPage.module.css";

const serverUrl =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

function CategoryList({ categories }) {
  const entries = Object.entries(categories || {}).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return <p className={styles.emptyMiniText}>No categories yet</p>;
  }

  return (
    <div className={styles.categoryList}>
      {entries.map(([name, count]) => (
        <div key={name} className={styles.categoryPill}>
          <span className={styles.categoryName}>{name}</span>
          <span className={styles.categoryCount}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function StatsBucket({ title, bucket, variant }) {
  return (
    <div
      className={`${styles.bucketCard} ${
        variant === "dangerous" ? styles.dangerCard : styles.safeCard
      }`}
    >
      <div className={styles.bucketHeader}>
        <h3 className={styles.bucketTitle}>{title}</h3>
        <div className={styles.bucketCount}>{bucket?.count ?? 0}</div>
      </div>

      <div className={styles.bucketBody}>
        <p className={styles.bucketSubtitle}>Categories</p>
        <CategoryList categories={bucket?.categories || {}} />
      </div>
    </div>
  );
}

function AdminTaggingDistributionPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDistributionStats = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const response = await fetch(
          `${serverUrl}/get_tagging_distribution_stats`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (response.status === 403) {
          setError("Access denied. Admins only.");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch tagging distribution stats");
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load tagging distribution stats.");
      } finally {
        setLoading(false);
      }
    };

    fetchDistributionStats();
  }, [navigate]);

  const sortedDays = useMemo(() => {
    const byDay = stats?.by_day || {};
    return Object.keys(byDay).sort((a, b) => b.localeCompare(a));
  }, [stats]);

  const hasTotalData =
    (stats?.total?.dangerous?.count ?? 0) > 0 ||
    (stats?.total?.safe?.count ?? 0) > 0 ||
    Object.keys(stats?.total?.dangerous?.categories || {}).length > 0 ||
    Object.keys(stats?.total?.safe?.categories || {}).length > 0;

  const hasDayData = sortedDays.length > 0;

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.mainWrapper}>
        <div className={styles.topRow}>
          <div>
            <h1 className={styles.title}>Tagging Distribution</h1>
            <p className={styles.subtitle}>
              Dangerous and safe tagging breakdown by day and category
            </p>
          </div>

          <button
            className={styles.backButton}
            onClick={() => navigate("/home")}
            type="button"
          >
            Back
          </button>
        </div>

        {loading && (
          <div className={styles.stateBox}>
            <p>Loading data...</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.stateBox}>
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {!loading && !error && !hasTotalData && !hasDayData && (
          <div className={styles.stateBox}>
            <p>No tagging distribution data available yet.</p>
          </div>
        )}

        {!loading && !error && (hasTotalData || hasDayData) && (
          <>
            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Overall Summary</h2>
              </div>

              <div className={styles.summaryGrid}>
                <StatsBucket
                  title="Dangerous"
                  bucket={stats?.total?.dangerous}
                  variant="dangerous"
                />
                <StatsBucket
                  title="Safe"
                  bucket={stats?.total?.safe}
                  variant="safe"
                />
              </div>
            </section>

            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Daily Breakdown</h2>
              </div>

              {sortedDays.length === 0 ? (
                <div className={styles.innerEmptyBox}>
                  <p>No daily data available yet.</p>
                </div>
              ) : (
                <div className={styles.daysContainer}>
                  {sortedDays.map((day) => {
                    const dayStats = stats.by_day[day] || {};

                    return (
                      <article key={day} className={styles.dayCard}>
                        <div className={styles.dayHeader}>
                          <h3 className={styles.dayTitle}>{day}</h3>
                        </div>

                        <div className={styles.summaryGrid}>
                          <StatsBucket
                            title="Dangerous"
                            bucket={dayStats.dangerous}
                            variant="dangerous"
                          />
                          <StatsBucket
                            title="Safe"
                            bucket={dayStats.safe}
                            variant="safe"
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default AdminTaggingDistributionPage;