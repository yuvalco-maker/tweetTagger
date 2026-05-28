import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./MABSuggestions.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const ARM_URLS = {
  arm_1_historical_dangerous_queries: "/mab/arms/1/historical-dangerous-queries?limit=5",
  arm_2_infrastructure_keywords: "/mab/arms/2/infrastructure-keywords?limit=5",
  arm_3_location_hotspots: "/mab/arms/3/location-hotspots?limit=5",
  arm_5_recent_category_trends: "/mab/arms/5/recent-category-trends?limit=5",
};

export default function MABSuggestions() {
  const navigate = useNavigate();

  const [armScores, setArmScores] = useState([]);
  const [recommendedArmId, setRecommendedArmId] = useState(null);
  const [selectedArmId, setSelectedArmId] = useState(null);
  const [loadingScores, setLoadingScores] = useState(true);

  const [seedTopic, setSeedTopic] = useState("");

  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const [selectedRec, setSelectedRec] = useState(null);

  const [language, setLanguage] = useState("en");
  const [maxItems, setMaxItems] = useState(10);
  const [rangeMode, setRangeMode] = useState("week");
  const [startDate, setStartDate] = useState(getDateDaysAgo(7));
  const [endDate, setEndDate] = useState(getTodayDate());
  const [runningQuery, setRunningQuery] = useState(false);

  const [message, setMessage] = useState("");

  function getToken() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return null;
    }
    return token;
  }

  useEffect(() => {
    async function loadScores() {
      const token = getToken();
      if (!token) return;

      setLoadingScores(true);
      try {
        const [scoresRes, selectRes] = await Promise.all([
          fetch(`${SERVER_URL}/mab/ucb1/scores`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${SERVER_URL}/mab/ucb1/select`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const scoresData = await scoresRes.json().catch(() => []);
        const selectData = await selectRes.json().catch(() => null);

        setArmScores(Array.isArray(scoresData) ? scoresData : []);

        if (selectData?.arm_id) {
          setRecommendedArmId(selectData.arm_id);
          setSelectedArmId(selectData.arm_id);
        }
      } catch {
        setMessage("Could not load arm scores.");
      } finally {
        setLoadingScores(false);
      }
    }

    loadScores();
  }, []);

  function handleSelectArm(armId) {
    setSelectedArmId(armId);
    setRecommendations([]);
    setSelectedRec(null);
    setMessage("");
  }

  async function handleGetSuggestions() {
    if (!selectedArmId) return;

    const token = getToken();
    if (!token) return;

    if (
      selectedArmId === "arm_4_ai_query_expansion" &&
      !seedTopic.trim()
    ) {
      setMessage("Please enter a seed topic for AI query expansion.");
      return;
    }

    setMessage("");
    setRecommendations([]);
    setSelectedRec(null);
    setLoadingRecs(true);

    try {
      let url;
      if (selectedArmId === "arm_4_ai_query_expansion") {
        url = `${SERVER_URL}/mab/arms/4/ai-query-expansion?seed_topic=${encodeURIComponent(
          seedTopic.trim()
        )}&limit=5`;
      } else {
        url = `${SERVER_URL}${ARM_URLS[selectedArmId]}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data?.detail || "Failed to get suggestions from this arm.");
        return;
      }

      const recs = data.recommendations || [];
      setRecommendations(recs);

      if (recs.length === 0) {
        setMessage("No suggestions available from this arm yet.");
      }
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setLoadingRecs(false);
    }
  }

  function handleSelectRec(rec) {
    setSelectedRec(rec);

    if (rec.start_date) {
      setStartDate(rec.start_date);
      setRangeMode("custom");
    }
    if (rec.end_date) {
      setEndDate(rec.end_date);
      setRangeMode("custom");
    }

    setTimeout(() => {
      document
        .getElementById("run-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function handleRangeChange(value) {
    setRangeMode(value);
    const today = getTodayDate();
    if (value === "week") {
      setStartDate(getDateDaysAgo(7));
      setEndDate(today);
    } else if (value === "month") {
      setStartDate(getDateDaysAgo(30));
      setEndDate(today);
    } else if (value === "threeMonths") {
      setStartDate(getDateDaysAgo(90));
      setEndDate(today);
    }
  }

  async function handleRunQuery(e) {
    e.preventDefault();
    if (!selectedRec) return;

    const token = getToken();
    if (!token) return;

    const keywords = (selectedRec.keywords || []).filter(Boolean);
    if (keywords.length === 0) {
      setMessage("Selected suggestion has no keywords.");
      return;
    }

    if (startDate > endDate) {
      setMessage("Start date cannot be after end date.");
      return;
    }

    setMessage("");
    setRunningQuery(true);

    try {
      const response = await fetch(`${SERVER_URL}/tweet-fetch/fetch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          keywords,
          language,
          start_date: startDate,
          end_date: endDate,
          max_items: Number(maxItems),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data?.detail || "Failed to run query.");
        return;
      }

      // Record a neutral reward so UCB1 counts this arm run
      if (selectedArmId) {
        fetch(`${SERVER_URL}/mab/ucb1/reward`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ arm_id: selectedArmId, reward: 0.5 }),
        }).catch(() => {});
      }

      navigate(`/query-results/${data.query_id}`);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setRunningQuery(false);
    }
  }

  function formatScore(score) {
    if (score === null) return "∞";
    return score.toFixed(3);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button
          className={styles.backButton}
          onClick={() => navigate("/search-query")}
        >
          ← Back to Search
        </button>

        <h1 className={styles.title}>MAB Query Suggestions</h1>
        <p className={styles.subtitle}>
          The UCB1 algorithm selects the best search strategy based on past
          performance. Pick an arm, get keyword suggestions, choose a date
          range, and run the query just like a normal search.
        </p>

        {/* ── Step 1: Arm selection ───────────────────────────────── */}
        <section className={styles.stepSection}>
          <div className={styles.stepLabel}>
            <span className={styles.stepNumber}>1</span>
            Select a search arm
          </div>
          <p className={styles.hint}>
            The{" "}
            <strong className={styles.ucbHighlight}>UCB1 Best</strong> arm is
            highlighted — it balances high past reward with low exploration.
            Click any arm to switch.
          </p>

          {loadingScores ? (
            <p className={styles.loadingText}>Loading UCB1 scores…</p>
          ) : (
            <div className={styles.armGrid}>
              {armScores.map((arm) => {
                const isRec = arm.arm_id === recommendedArmId;
                const isSel = arm.arm_id === selectedArmId;

                return (
                  <button
                    key={arm.arm_id}
                    type="button"
                    className={[
                      styles.armCard,
                      isSel ? styles.armCardSelected : "",
                      isRec ? styles.armCardRecommended : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSelectArm(arm.arm_id)}
                  >
                    {isRec && (
                      <span className={styles.ucbBadge}>UCB1 Best</span>
                    )}
                    <div className={styles.armName}>{arm.arm_name}</div>
                    <div className={styles.armStats}>
                      <span>Runs: {arm.runs}</span>
                      <span>Avg reward: {arm.avg_reward.toFixed(3)}</span>
                      <span>Score: {formatScore(arm.ucb1_score)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── ARM 4 seed topic ────────────────────────────────────── */}
        {selectedArmId === "arm_4_ai_query_expansion" && (
          <section className={styles.seedSection}>
            <label className={styles.label}>Seed topic for AI expansion</label>
            <input
              className={styles.input}
              value={seedTopic}
              onChange={(e) => setSeedTopic(e.target.value)}
              placeholder="e.g. oil refinery attack, gas pipeline strike"
              disabled={loadingRecs}
            />
            <p className={styles.hint}>
              The AI will generate related search queries based on this topic.
            </p>
          </section>
        )}

        {/* ── Get suggestions button ───────────────────────────────── */}
        <button
          type="button"
          className={styles.fetchButton}
          onClick={handleGetSuggestions}
          disabled={!selectedArmId || loadingRecs || loadingScores}
        >
          {loadingRecs
            ? "Fetching suggestions…"
            : "Get suggestions from this arm →"}
        </button>

        {/* ── Step 2: Recommendation cards ────────────────────────── */}
        {recommendations.length > 0 && (
          <section className={styles.recsSection}>
            <div className={styles.stepLabel}>
              <span className={styles.stepNumber}>2</span>
              Choose a suggestion
            </div>
            <p className={styles.hint}>
              Click a suggestion to load it into the editor below.
            </p>

            <div className={styles.recsList}>
              {recommendations.map((rec, index) => {
                const isSel = selectedRec === rec;
                const meta = rec.metadata || {};

                return (
                  <button
                    key={index}
                    type="button"
                    className={[
                      styles.recCard,
                      isSel ? styles.recCardSelected : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSelectRec(rec)}
                    disabled={runningQuery}
                  >
                    <div className={styles.recHeader}>
                      <strong>{(rec.keywords || []).join(", ")}</strong>
                      <span className={styles.scoreBadge}>
                        {Math.round((rec.score || 0) * 100)}%
                      </span>
                    </div>

                    {rec.reason && (
                      <p className={styles.recReason}>{rec.reason}</p>
                    )}

                    {(meta.success_rate !== undefined ||
                      meta.hotspot_count !== undefined ||
                      meta.dangerous_count !== undefined) && (
                      <div className={styles.recMeta}>
                        {meta.success_rate !== undefined && (
                          <span>
                            Success rate:{" "}
                            {(meta.success_rate * 100).toFixed(1)}%
                          </span>
                        )}
                        {meta.dangerous_count !== undefined && (
                          <span>Dangerous: {meta.dangerous_count}</span>
                        )}
                        {meta.ml_processed_count !== undefined && (
                          <span>ML processed: {meta.ml_processed_count}</span>
                        )}
                        {meta.hotspot_count !== undefined && (
                          <span>Hotspot count: {meta.hotspot_count}</span>
                        )}
                        {meta.category !== undefined && (
                          <span>Category: {meta.category}</span>
                        )}
                      </div>
                    )}

                    <div className={styles.cardActionHint}>
                      {isSel
                        ? "✓ Loaded into editor below"
                        : "Click to use this suggestion"}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Step 3: Run editor ───────────────────────────────────── */}
        {selectedRec && (
          <section className={styles.editorSection} id="run-editor">
            <div className={styles.stepLabel}>
              <span className={styles.stepNumber}>3</span>
              Configure and run
            </div>

            <div className={styles.keywordsDisplay}>
              <span className={styles.label}>Keywords</span>
              <p className={styles.keywordsValue}>
                {(selectedRec.keywords || []).join(", ")}
              </p>
            </div>

            <form onSubmit={handleRunQuery} className={styles.form}>
              <div className={styles.grid}>
                <div>
                  <label className={styles.label}>Language</label>
                  <select
                    className={styles.input}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={runningQuery}
                  >
                    <option value="en">English</option>
                    <option value="he">Hebrew</option>
                    <option value="ar">Arabic</option>
                    <option value="fr">French</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>

                <div>
                  <label className={styles.label}>Max tweets</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    max="500"
                    value={maxItems}
                    onChange={(e) => setMaxItems(e.target.value)}
                    disabled={runningQuery}
                  />
                </div>
              </div>

              <div className={styles.section}>
                <label className={styles.label}>Time range</label>

                <div className={styles.rangeButtons}>
                  {[
                    { id: "week", label: "Last week" },
                    { id: "month", label: "Last month" },
                    { id: "threeMonths", label: "Last 3 months" },
                    { id: "custom", label: "Custom" },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={
                        rangeMode === id
                          ? styles.activeRangeButton
                          : styles.rangeButton
                      }
                      onClick={() => handleRangeChange(id)}
                      disabled={runningQuery}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className={styles.datesGrid}>
                  <div>
                    <label className={styles.label}>Start date</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setRangeMode("custom");
                        setStartDate(e.target.value);
                      }}
                      disabled={runningQuery}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>End date</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setRangeMode("custom");
                        setEndDate(e.target.value);
                      }}
                      disabled={runningQuery}
                    />
                  </div>
                </div>
              </div>

              <button
                className={styles.submitButton}
                type="submit"
                disabled={runningQuery}
              >
                {runningQuery ? "Fetching and running ML…" : "Fetch tweets"}
              </button>
            </form>
          </section>
        )}

        {message && <p className={styles.message}>{message}</p>}
      </div>
    </div>
  );
}
