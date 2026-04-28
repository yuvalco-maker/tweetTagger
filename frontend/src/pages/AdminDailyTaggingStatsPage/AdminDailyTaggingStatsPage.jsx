import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import styles from "./AdminDailyTaggingStatsPage.module.css";

function AdminDailyTaggingStatsPage() {
  const [statsByDate, setStatsByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const serverUrl =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const response = await fetch(`${serverUrl}/get_daily_tagging_stats`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (response.status === 403) {
          setError("גישה נדחתה. רק אדמין יכול לצפות בעמוד הזה.");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch daily tagging stats");
        }

        const data = await response.json();
        setStatsByDate(data || {});
      } catch (err) {
        console.error(err);
        setError("לא הצלחנו לטעון את נתוני ההספק.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [navigate]);

  const sortedDates = useMemo(() => {
    return Object.keys(statsByDate).sort((a, b) => b.localeCompare(a));
  }, [statsByDate]);

  const hasData = sortedDates.length > 0;

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.mainWrapper}>
        <div className={styles.topRow}>
          <div>
            <h1 className={styles.title}>Daily Tagging Performance</h1>
            <p className={styles.subtitle}>
             View tagging activity by date and user
            </p>
          </div>

          <button
            className={styles.backButton}
            onClick={() => navigate("/home")}
            type="button"
          >
            back
          </button>
        </div>

        {loading && (
          <div className={styles.stateBox}>
            <p>טוען נתונים...</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.stateBox}>
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {!loading && !error && !hasData && (
          <div className={styles.stateBox}>
            <p>עדיין אין נתוני תיוג להצגה.</p>
          </div>
        )}

        {!loading && !error && hasData && (
          <div className={styles.daysContainer}>
            {sortedDates.map((date) => {
              const users = Array.isArray(statsByDate[date]) ? [...statsByDate[date]] : [];

              users.sort((a, b) => b.count - a.count);

              const maxCount = Math.max(...users.map((u) => u.count), 1);

              return (
                <section key={date} className={styles.dayCard}>
                  <div className={styles.dayHeader}>
                    <h2 className={styles.dayTitle}>{date}</h2>
                    <span className={styles.dayMeta}>
                      {users.length} משתמשים תייגו
                    </span>
                  </div>

                  <div className={styles.chartArea}>
                    <div className={styles.chartGrid} />

                    <div className={styles.barsWrapper}>
                      {users.map((user) => {
                        const rawHeight = (user.count / maxCount) * 220;
                        const barHeight = user.count === 0 ? 8 : Math.max(rawHeight, 18);

                        return (
                          <div key={`${date}-${user.username}`} className={styles.barItem}>
                            <div className={styles.valueLabel}>{user.count}</div>

                            <div
                              className={styles.bar}
                              style={{ height: `${barHeight}px` }}
                              title={`${user.username}: ${user.count}`}
                            />

                            <div className={styles.usernameLabel} title={user.username}>
                              {user.username}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDailyTaggingStatsPage;