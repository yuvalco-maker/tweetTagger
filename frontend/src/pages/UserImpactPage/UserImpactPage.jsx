import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import styles from "./UserImpactPage.module.css";

const serverUrl =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

function CategoryList({ categories }) {
  const entries = useMemo(
    () => Object.entries(categories || {}).sort((a, b) => b[1] - a[1]),
    [categories]
  );

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

function ImpactBucket({ title, count, categories, variant }) {
  return (
    <section
      className={`${styles.bucketCard} ${
        variant === "dangerous" ? styles.dangerCard : styles.safeCard
      }`}
    >
      <div className={styles.bucketHeader}>
        <div>
          <h2 className={styles.bucketTitle}>{title}</h2>
          <p className={styles.bucketSubtitle}>Category breakdown</p>
        </div>

        <div className={styles.bucketCount}>{count ?? 0}</div>
      </div>

      <CategoryList categories={categories} />
    </section>
  );
}

function UserImpactPage() {
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchImpact = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const response = await fetch(`${serverUrl}/get_my_impact_stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch user impact stats");
        }

        const data = await response.json();
        setImpact(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load your impact stats.");
      } finally {
        setLoading(false);
      }
    };

    fetchImpact();
  }, [navigate]);

  const hasData =
    (impact?.total_tagged ?? 0) > 0 ||
    (impact?.dangerous?.count ?? 0) > 0 ||
    (impact?.safe?.count ?? 0) > 0 ||
    Object.keys(impact?.dangerous?.categories || {}).length > 0 ||
    Object.keys(impact?.safe?.categories || {}).length > 0;

  const totalTagged = impact?.total_tagged || 0;
  const dangerousCount = impact?.dangerous?.count || 0;
  const safeCount = impact?.safe?.count || 0;

  const dangerousPercent =
    totalTagged > 0 ? ((dangerousCount / totalTagged) * 100).toFixed(1) : "0.0";

  const safePercent =
    totalTagged > 0 ? ((safeCount / totalTagged) * 100).toFixed(1) : "0.0";

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.mainWrapper}>
        <div className={styles.topRow}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Your Impact</h1>
            <p className={styles.subtitle}>
              See what you tagged and how your work is distributed
            </p>
          </div>

          <button
            className={styles.backBtn}
            type="button"
            onClick={() => {
              const isAdmin = localStorage.getItem("isADMIN") === "true";
              navigate(isAdmin ? "/home" : "/home-user");
            }}
          >
            Back
          </button>
        </div>

        {loading && <div className={styles.stateBox}>Loading...</div>}

        {!loading && error && <div className={styles.stateBox}>{error}</div>}

        {!loading && !error && !hasData && (
          <div className={styles.stateBox}>No data yet</div>
        )}

        {!loading && !error && hasData && (
          <>
            <section className={styles.summaryCard}>
              <h2 className={styles.sectionTitle}>Overview</h2>

              <div className={styles.summaryGrid}>
                <div className={styles.summaryStat}>
                  <span className={styles.summaryLabel}>Total Tagged</span>
                  <span className={styles.summaryValue}>{totalTagged}</span>
                  <span className={styles.summarySubText}>
                    Total labeled tweets
                  </span>
                </div>

                <div className={styles.summaryStat}>
                  <span className={styles.summaryLabel}>Dangerous</span>
                  <span className={styles.summaryValueDanger}>
                    {dangerousPercent}%
                  </span>
                  <span className={styles.summarySubText}>
                    {dangerousCount} dangerous tweets
                  </span>
                </div>

                <div className={styles.summaryStat}>
                  <span className={styles.summaryLabel}>Safe</span>
                  <span className={styles.summaryValueSafe}>
                    {safePercent}%
                  </span>
                  <span className={styles.summarySubText}>
                    {safeCount} safe tweets
                  </span>
                </div>
              </div>
            </section>

            <div className={styles.bucketGrid}>
              <ImpactBucket
                title="Dangerous"
                count={dangerousCount}
                categories={impact?.dangerous?.categories || {}}
                variant="dangerous"
              />

              <ImpactBucket
                title="Safe"
                count={safeCount}
                categories={impact?.safe?.categories || {}}
                variant="safe"
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default UserImpactPage;