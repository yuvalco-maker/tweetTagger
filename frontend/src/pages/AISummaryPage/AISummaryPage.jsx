import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./AISummaryPage.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

function formatDanger(value) {
  if (value === true) return "Dangerous";
  if (value === false) return "Not dangerous";
  return "—";
}

function formatCategory(value) {
  return value || "Unknown";
}

function formatQuery(query) {
  if (!query) return "Search query";

  const keywords = query.keywords?.join(", ") || "Unknown keywords";
  const language = query.language || "Unknown language";
  const startDate = query.start_date || "Unknown start";
  const endDate = query.end_date || "Unknown end";

  return `${keywords} | ${language} | ${startDate} → ${endDate}`;
}

export default function AISummaryPage() {
  const { queryId } = useParams();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyingIndex, setApplyingIndex] = useState(null);
  const [appliedIndices, setAppliedIndices] = useState(new Set());

  const patchTweet = async (dbId, aiCategory, aiIsDangerous, token) => {
    const getRes = await fetch(`${SERVER_URL}/tweet-fetch/tweet/${dbId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!getRes.ok) return false;
    const full = await getRes.json();
    const patchRes = await fetch(`${SERVER_URL}/tweet-fetch/tweet/${dbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...full, category: aiCategory, is_dangerous: aiIsDangerous }),
    });
    return patchRes.ok;
  };

  const syncReviewToAI = (index) => {
    setSummary((prev) => {
      const reviews = [...prev.tweet_reviews];
      reviews[index] = {
        ...reviews[index],
        model_is_dangerous: reviews[index].ai_is_dangerous,
        model_category: reviews[index].ai_category,
        ai_agrees_with_model: true,
        disagreement_reason: null,
      };
      return { ...prev, tweet_reviews: reviews };
    });
  };

  const applyReview = async (review, index, e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!review.db_id) return;
    setApplyingIndex(index);
    try {
      const ok = await patchTweet(review.db_id, review.ai_category, review.ai_is_dangerous, token);
      if (ok) {
        setAppliedIndices((prev) => new Set(prev).add(index));
        syncReviewToAI(index);
      }
    } finally {
      setApplyingIndex(null);
    }
  };

  const applyAll = async () => {
    if (!summary?.tweet_reviews) return;
    setApplyingAll(true);
    const token = localStorage.getItem("token");
    const results = new Set(appliedIndices);
    await Promise.all(
      summary.tweet_reviews.map(async (review, index) => {
        if (!review.db_id) return;
        const ok = await patchTweet(review.db_id, review.ai_category, review.ai_is_dangerous, token);
        if (ok) {
          results.add(index);
          syncReviewToAI(index);
        }
      })
    );
    setAppliedIndices(results);
    setApplyingAll(false);
  };

  useEffect(() => {
    const fetchPageData = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const [summaryRes, queriesRes] = await Promise.all([
          fetch(`${SERVER_URL}/ai-summary/query/${queryId}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${SERVER_URL}/tweet-fetch/my-queries?limit=200`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const summaryData = await summaryRes.json().catch(() => null);
        const queriesData = await queriesRes.json().catch(() => []);

        if (!summaryRes.ok) {
          setMessage(summaryData?.detail || "Failed to load AI summary.");
          return;
        }

        setSummary(summaryData);

        if (queriesRes.ok && Array.isArray(queriesData)) {
          const foundQuery = queriesData.find(
            (item) => item._id === queryId || item.id === queryId
          );
          setQuery(foundQuery || null);
        }
      } catch {
        setMessage("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchPageData();
  }, [queryId, navigate]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingCard}>Loading AI summary...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => navigate(`/query-results/${queryId}`)}
        >
          ← Back to query results
        </button>

        <div className={styles.titleArea}>
          <h1>AI Summary</h1>
          <p>AI analysis for this search query</p>

          <div className={styles.queryBox}>
            <span className={styles.queryLabel}>Original query</span>
            <span className={styles.queryValue}>{formatQuery(query)}</span>
          </div>
        </div>
      </div>

      {message && <p className={styles.message}>{message}</p>}

      {summary && (
        <>
          <section className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span>Overall risk</span>
              <strong className={styles.riskText}>
                {summary.overall_risk_level}
              </strong>
            </div>

            <div className={styles.statCard}>
              <span>Tweets reviewed</span>
              <strong>{summary.tweets_reviewed_count}</strong>
            </div>

            <div className={styles.statCard}>
              <span>AI marked dangerous</span>
              <strong>{summary.dangerous_count_by_ai}</strong>
            </div>

            <div className={styles.statCard}>
              <span>Model disagreements</span>
              <strong>{summary.disagreements_count}</strong>
            </div>
          </section>

          <section className={styles.mainCard}>
            <h2>General summary</h2>
            <p>{summary.general_summary}</p>
          </section>

          <section className={styles.mainCard}>
            <h2>Main exposed weaknesses</h2>

            {summary.main_exposed_weaknesses?.length > 0 ? (
              <ul className={styles.weaknessList}>
                {summary.main_exposed_weaknesses.map((weakness, index) => (
                  <li key={index}>{weakness}</li>
                ))}
              </ul>
            ) : (
              <p>No major weaknesses found.</p>
            )}
          </section>

          <section className={styles.mainCard}>
            <h2>Recommended action</h2>
            <p>{summary.recommended_action}</p>
          </section>

          <section className={styles.reviewsSection}>
            <div className={styles.reviewsHeader}>
              <h2>Tweet reviews</h2>
              <button
                className={styles.applyAllButton}
                onClick={applyAll}
                disabled={applyingAll}
              >
                {applyingAll ? "Applying..." : "Apply all AI suggestions"}
              </button>
            </div>

            <div className={styles.reviewList}>
              {summary.tweet_reviews?.map((review, index) => (
                <article onClick={()=>review.tweet_id&& navigate(`/tweet-detail/${review.tweet_id}`)} key={index} className={styles.reviewCard}>
                  <div className={styles.reviewTop}>
                    <span
                      className={
                        review.ai_agrees_with_model
                          ? styles.agreeBadge
                          : styles.disagreeBadge
                      }
                    >
                      {review.ai_agrees_with_model
                        ? "AI agrees with model"
                        : "AI disagrees with model"}
                    </span>

                    <span
                      className={
                        review.ai_is_dangerous
                          ? styles.dangerBadge
                          : styles.safeBadge
                      }
                    >
                      {formatDanger(review.ai_is_dangerous)}
                    </span>
                    
                  </div>

                  <div className={styles.tweetBox}>
                    <div className={styles.tweetLabel}>Tweet content</div>
                    <p>{review.content}</p>
                  </div>

                  <div className={styles.compareGrid}>
                    <div className={styles.compareBox}>
                      <h3>Original model tagging</h3>
                      <p>
                        <b>Danger:</b>{" "}
                        {formatDanger(review.model_is_dangerous)}
                      </p>
                      <p>
                        <b>Category:</b>{" "}
                        {formatCategory(review.model_category)}
                      </p>
                    </div>

                    <div className={styles.compareBoxHighlight}>
                      <h3>AI opinion</h3>
                      <p>
                        <b>Danger:</b> {formatDanger(review.ai_is_dangerous)}
                      </p>
                      <p>
                        <b>Category:</b> {formatCategory(review.ai_category)}
                      </p>
                    </div>
                  </div>

                  <div className={styles.aiExplanation}>
                    <p>
                      <b>AI explanation:</b> {review.short_explanation}
                    </p>

                    {review.exposed_weakness && (
                      <p>
                        <b>Exposed weakness:</b> {review.exposed_weakness}
                      </p>
                    )}

                    {!review.ai_agrees_with_model &&
                      review.disagreement_reason && (
                        <p>
                          <b>Why AI disagrees:</b>{" "}
                          {review.disagreement_reason}
                        </p>
                      )}

                    <button
                      className={
                        appliedIndices.has(index)
                          ? styles.applyButtonDone
                          : styles.applyButton
                      }
                      onClick={(e) => applyReview(review, index, e)}
                      disabled={applyingIndex === index || appliedIndices.has(index)}
                    >
                      {applyingIndex === index
                        ? "Applying..."
                        : appliedIndices.has(index)
                        ? "Applied"
                        : "Apply AI suggestion"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}