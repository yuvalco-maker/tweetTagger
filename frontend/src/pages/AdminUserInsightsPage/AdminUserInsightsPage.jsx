import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import styles from "./AdminUserInsightsPage.module.css";

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

function ImpactBucket({ title, bucket, variant }) {
  return (
    <section
      className={`${styles.impactBucket} ${
        variant === "dangerous" ? styles.dangerCard : styles.safeCard
      }`}
    >
      <div className={styles.bucketHeader}>
        <div>
          <h3 className={styles.bucketTitle}>{title}</h3>
          <p className={styles.bucketSubtitle}>Category breakdown</p>
        </div>
        <div className={styles.bucketCount}>{bucket?.count ?? 0}</div>
      </div>

      <CategoryList categories={bucket?.categories || {}} />
    </section>
  );
}

function DailyBars({ rows }) {
  if (!rows?.length) {
    return <div className={styles.emptyInnerBox}>No daily stats yet.</div>;
  }

  const maxValue = Math.max(...rows.map((r) => r.total_tagged), 1);

  const formatShortDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  };

  const formatFullDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className={styles.dailyChartWrap}>
      <div className={styles.dailyBars}>
        {rows.map((row) => {
          const height = Math.max((row.total_tagged / maxValue) * 180, 16);

          return (
            <div key={row.date} className={styles.barItem}>
              <div className={styles.barValue}>{row.total_tagged}</div>
              <div
                className={styles.bar}
                style={{ height: `${height}px` }}
                title={`${formatFullDate(row.date)}: ${row.total_tagged}`}
              />
              <div className={styles.barLabel}>{formatShortDate(row.date)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TweetCard({ tweet, username }) {
  const createdAt = tweet?.created_at
    ? new Date(tweet.created_at).toLocaleString()
    : "";

  return (
    <article className={styles.tweetCard}>
      <div className={styles.tweetMetaRow}>
        <span className={styles.tweetDate}>{createdAt}</span>
        <span className={styles.tweetTagger}>{username || "Unknown"}</span>
      </div>

      <p className={styles.tweetContent}>{tweet?.content || ""}</p>

      <div className={styles.tweetBadges}>
        <span className={styles.badge}>
          {tweet?.is_dangerous === true
            ? "Dangerous"
            : tweet?.is_dangerous === false
            ? "Safe"
            : "Unknown"}
        </span>
        <span className={styles.badge}>{tweet?.category || "No Category"}</span>
      </div>
    </article>
  );
}

export default function AdminUserInsightsPage() {
  const navigate = useNavigate();
  const searchWrapRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [impact, setImpact] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [tweetsData, setTweetsData] = useState(null);

  const [page, setPage] = useState(1);

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    if (!query.trim() || !isSuggestionOpen) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const token = localStorage.getItem("token");

        const res = await fetch(
          `${serverUrl}/search_users_for_admin?q=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.status === 401) {
          navigate("/login");
          return;
        }

        if (res.status === 403) {
          setError("Access denied. Admins only.");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to search users");
        }

        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query, isSuggestionOpen, navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(event.target)
      ) {
        setIsSuggestionOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!selectedUser?.id) return;

    const fetchAll = async () => {
      try {
        setLoadingDetails(true);
        setError("");

        const token = localStorage.getItem("token");

        const [impactRes, dailyRes, tweetsRes] = await Promise.all([
          fetch(
            `${serverUrl}/get_user_impact_stats_admin?target_user_id=${selectedUser.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          ),
          fetch(
            `${serverUrl}/get_user_daily_tagging_stats_admin?target_user_id=${selectedUser.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          ),
          fetch(
            `${serverUrl}/get_user_tagged_tweets_for_admin?target_user_id=${selectedUser.id}&page=${page}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          ),
        ]);

        if ([impactRes, dailyRes, tweetsRes].some((r) => r.status === 401)) {
          navigate("/login");
          return;
        }

        if ([impactRes, dailyRes, tweetsRes].some((r) => r.status === 403)) {
          setError("Access denied. Admins only.");
          return;
        }

        if (!impactRes.ok || !dailyRes.ok || !tweetsRes.ok) {
          throw new Error("Failed to load user insights");
        }

        const impactData = await impactRes.json();
        const dailyData = await dailyRes.json();
        const tweetsJson = await tweetsRes.json();

        setImpact(impactData);
        setDailyStats(Array.isArray(dailyData) ? dailyData : []);
        setTweetsData(tweetsJson);
      } catch (err) {
        console.error(err);
        setError("Failed to load user insights.");
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchAll();
  }, [selectedUser, page, navigate]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setQuery(user.username);
    setSuggestions([]);
    setIsSuggestionOpen(false);
    setPage(1);
  };

  const tweets = tweetsData?.items || [];

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
          <div>
            <h1 className={styles.title}>User Insights</h1>
            <p className={styles.subtitle}>
              Search a user and review their activity, impact, and tagged tweets
            </p>
          </div>

          <button
            className={styles.backBtn}
            type="button"
            onClick={() => navigate("/home")}
          >
            Back
          </button>
        </div>

        <section className={styles.searchCard}>
          <label className={styles.searchLabel} htmlFor="user-search">
            Search user
          </label>

          <div className={styles.searchBoxWrap} ref={searchWrapRef}>
            <input
              id="user-search"
              className={styles.searchInput}
              type="text"
              value={query}
              placeholder="Type username or email..."
              autoComplete="off"
              onFocus={() => {
                if (query.trim()) setIsSuggestionOpen(true);
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsSuggestionOpen(true);
              }}
            />

            {searchLoading && isSuggestionOpen && (
              <div className={styles.searchHint}>Searching...</div>
            )}

            {!searchLoading && isSuggestionOpen && suggestions.length > 0 && (
              <div className={styles.suggestionsBox}>
                {suggestions.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={styles.suggestionItem}
                    onClick={() => handleSelectUser(user)}
                  >
                    <span className={styles.suggestionUsername}>
                      {user.username}
                    </span>
                    <span className={styles.suggestionEmail}>
                      {user.email}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUser && (
            <div className={styles.selectedUserBox}>
              <span className={styles.selectedUserTitle}>Selected user:</span>
              <span className={styles.selectedUserValue}>
                {selectedUser.username}
              </span>
              <span className={styles.selectedUserEmail}>
                {selectedUser.email}
              </span>
            </div>
          )}
        </section>

        {error && <div className={styles.stateBox}>{error}</div>}

        {!selectedUser && !error && (
          <div className={styles.stateBox}>
            Search for a user to view insights.
          </div>
        )}

        {selectedUser && loadingDetails && (
          <div className={styles.stateBox}>Loading user insights...</div>
        )}

        {selectedUser && !loadingDetails && !error && (
          <>
            <section className={styles.sectionCard}>
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

            <section className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>Impact Breakdown</h2>

              <div className={styles.impactGrid}>
                <ImpactBucket
                  title="Dangerous"
                  bucket={impact?.dangerous}
                  variant="dangerous"
                />
                <ImpactBucket
                  title="Safe"
                  bucket={impact?.safe}
                  variant="safe"
                />
              </div>
            </section>

            <section className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>Daily Activity</h2>
              <DailyBars rows={dailyStats} />
            </section>

            <section className={styles.sectionCard}>
              <div className={styles.sectionHeaderRow}>
                <h2 className={styles.sectionTitle}>Tagged Tweets</h2>
                <div className={styles.paginationInfo}>
                  Page {tweetsData?.page ?? 1} of {tweetsData?.totalPages ?? 1}
                </div>
              </div>

              {tweets.length === 0 ? (
                <div className={styles.emptyInnerBox}>No tagged tweets found.</div>
              ) : (
                <div className={styles.tweetsList}>
                  {tweets.map(([tweet, username], index) => (
                    <TweetCard
                      key={tweet?._id || tweet?.id || index}
                      tweet={tweet}
                      username={username}
                    />
                  ))}
                </div>
              )}

              <div className={styles.paginationRow}>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={(tweetsData?.page ?? 1) <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={
                    (tweetsData?.page ?? 1) >= (tweetsData?.totalPages ?? 1)
                  }
                  onClick={() =>
                    setPage((p) =>
                      Math.min(tweetsData?.totalPages ?? 1, p + 1)
                    )
                  }
                >
                  Next
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}