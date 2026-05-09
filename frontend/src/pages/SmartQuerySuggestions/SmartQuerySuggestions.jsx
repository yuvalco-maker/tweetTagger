import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./SmartQuerySuggestions.module.css";

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

function isSameSelectedQuery(selectedQuery, query) {
  if (!selectedQuery || !query) return false;
  return selectedQuery.sourceQueryId === query.query_id;
}

export default function SmartQuerySuggestions() {
  const navigate = useNavigate();

  const [keywordsText, setKeywordsText] = useState("");
  const [language, setLanguage] = useState("en");
  const [maxItems, setMaxItems] = useState(20);
  const [startDate, setStartDate] = useState(getDateDaysAgo(30));
  const [endDate, setEndDate] = useState(getTodayDate());

  const [recommendations, setRecommendations] = useState([]);
  const [selectedQuery, setSelectedQuery] = useState(null);

  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [runningFetch, setRunningFetch] = useState(false);
  const [message, setMessage] = useState("");

  function getTokenOrRedirect() {
    const token = localStorage.getItem("token");

    if (!token) {
      setMessage("You are not logged in.");
      navigate("/login");
      return null;
    }

    return token;
  }

  function buildKeywordsFromText(text) {
    return text
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);
  }

  async function handleGetSuggestions(e) {
    e.preventDefault();
    setMessage("");
    setRecommendations([]);
    setSelectedQuery(null);

    const token = getTokenOrRedirect();
    if (!token) return;

    const keywords = buildKeywordsFromText(keywordsText);

    if (keywords.length === 0) {
      setMessage("Please enter at least one keyword.");
      return;
    }

    if (startDate > endDate) {
      setMessage("Start date cannot be after end date.");
      return;
    }

    const body = {
      keywords,
      language,
      start_date: startDate,
      end_date: endDate,
      max_items: Number(maxItems),
    };

    setLoadingSuggestions(true);

    try {
      const response = await fetch(
        `${SERVER_URL}/tweet-fetch/smart-query-suggestions?limit=8`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data?.detail || "Failed to get smart suggestions.");
        return;
      }

      setRecommendations(data.recommendations || []);

      if (!data.recommendations || data.recommendations.length === 0) {
        setMessage("No similar successful queries found yet.");
      }
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function handleChooseRecommendation(query) {
    setSelectedQuery({
      sourceQueryId: query.query_id,
      keywordsText: (query.keywords || []).join(", "),
      language: query.language || language,
      startDate: query.start_date || startDate,
      endDate: query.end_date || endDate,
      maxItems: query.max_items || maxItems,
    });

    setTimeout(() => {
      document
        .getElementById("selected-query-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function handleRunSelectedQuery(e) {
    e.preventDefault();
    setMessage("");

    if (!selectedQuery) {
      setMessage("Please choose a suggested query first.");
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) return;

    const keywords = buildKeywordsFromText(selectedQuery.keywordsText);

    if (keywords.length === 0) {
      setMessage("Selected query must contain at least one keyword.");
      return;
    }

    if (selectedQuery.startDate > selectedQuery.endDate) {
      setMessage("Start date cannot be after end date.");
      return;
    }

    const body = {
      keywords,
      language: selectedQuery.language,
      start_date: selectedQuery.startDate,
      end_date: selectedQuery.endDate,
      max_items: Number(selectedQuery.maxItems),
    };

    setRunningFetch(true);

    try {
      const response = await fetch(`${SERVER_URL}/tweet-fetch/fetch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data?.detail || "Failed to run selected query.");
        return;
      }

      navigate(`/query-results/${data.query_id}`);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setRunningFetch(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button
          className={styles.backButton}
          onClick={() => navigate("/search-query")}
        >
          ← Back to Search Query
        </button>

        <h1 className={styles.title}>Smart Query Suggestions</h1>

        <p className={styles.subtitle}>
          Enter a query idea. The system compares only the meaning of the keywords
          using AI embeddings, then recommends similar past queries that performed well.
          Dates are used later when you run the selected query.
        </p>

        <form className={styles.form} onSubmit={handleGetSuggestions}>
          <section className={styles.section}>
            <label className={styles.label}>Query idea keywords</label>
            <textarea
              className={styles.textarea}
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="Example: Bazan refinery, Haifa smoke, oil fire"
              disabled={loadingSuggestions || runningFetch}
            />
            <p className={styles.hint}>Separate keywords with commas.</p>
          </section>

          <section className={styles.grid}>
            <div>
              <label className={styles.label}>Language</label>
              <select
                className={styles.input}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={loadingSuggestions || runningFetch}
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
                disabled={loadingSuggestions || runningFetch}
              />
            </div>
          </section>

          <section className={styles.grid}>
            <div>
              <label className={styles.label}>Start date</label>
              <input
                className={styles.input}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loadingSuggestions || runningFetch}
              />
            </div>

            <div>
              <label className={styles.label}>End date</label>
              <input
                className={styles.input}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loadingSuggestions || runningFetch}
              />
            </div>
          </section>

          <button
            className={styles.submitButton}
            type="submit"
            disabled={loadingSuggestions || runningFetch}
          >
            {loadingSuggestions ? "Finding suggestions..." : "Find smart suggestions"}
          </button>
        </form>

        {recommendations.length > 0 && (
          <section className={styles.results}>
            <h2 className={styles.sectionTitle}>Recommended queries</h2>
            <p className={styles.sectionDescription}>
              Click one recommendation. It will be copied into the highlighted editor below,
              where you can change the keywords, dates, language, and max tweets before running.
            </p>

            <div className={styles.recommendationList}>
              {recommendations.map((query) => {
                const selected = isSameSelectedQuery(selectedQuery, query);

                return (
                  <button
                    key={query.query_id}
                    type="button"
                    className={`${styles.recommendationCard} ${
                      selected ? styles.selectedCard : ""
                    }`}
                    onClick={() => handleChooseRecommendation(query)}
                    disabled={runningFetch}
                  >
                    <div className={styles.recommendationHeader}>
                      <strong>{(query.keywords || []).join(", ")}</strong>
                      <span className={styles.scoreBadge}>
                        Score {Math.round((query.final_score || 0) * 100)}%
                      </span>
                    </div>

                    <div className={styles.metaRow}>
                      <span>
                        Similarity: {Math.round((query.similarity || 0) * 100)}%
                      </span>
                      <span>Dangerous: {query.dangerous_percentage || 0}%</span>
                      <span>ML processed: {query.ml_processed_count || 0}</span>
                    </div>

                    <div className={styles.cardActionHint}>
                      {selected
                        ? "✓ Loaded into editor below"
                        : "Click to load this query into the editor"}
                    </div>

                    <div className={styles.categoryRow}>
                      {Object.entries(query.categories_total || {}).map(
                        ([category, count]) => (
                          <span key={category} className={styles.categoryBadge}>
                            {category}: {count}
                          </span>
                        )
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {selectedQuery && (
          <section className={styles.editor} id="selected-query-editor">
            <h2 className={styles.sectionTitle}>Selected query to run</h2>
            <p className={styles.sectionDescription}>
              This is the recommendation you clicked. Edit it if needed, then run it.
            </p>

            <form className={styles.form} onSubmit={handleRunSelectedQuery}>
              <label className={styles.label}>Keywords</label>
              <textarea
                className={styles.textarea}
                value={selectedQuery.keywordsText}
                onChange={(e) =>
                  setSelectedQuery({
                    ...selectedQuery,
                    keywordsText: e.target.value,
                  })
                }
                disabled={runningFetch}
              />

              <section className={styles.grid}>
                <div>
                  <label className={styles.label}>Language</label>
                  <select
                    className={styles.input}
                    value={selectedQuery.language}
                    onChange={(e) =>
                      setSelectedQuery({
                        ...selectedQuery,
                        language: e.target.value,
                      })
                    }
                    disabled={runningFetch}
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
                    value={selectedQuery.maxItems}
                    onChange={(e) =>
                      setSelectedQuery({
                        ...selectedQuery,
                        maxItems: e.target.value,
                      })
                    }
                    disabled={runningFetch}
                  />
                </div>
              </section>

              <section className={styles.grid}>
                <div>
                  <label className={styles.label}>Start date</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={selectedQuery.startDate}
                    onChange={(e) =>
                      setSelectedQuery({
                        ...selectedQuery,
                        startDate: e.target.value,
                      })
                    }
                    disabled={runningFetch}
                  />
                </div>

                <div>
                  <label className={styles.label}>End date</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={selectedQuery.endDate}
                    onChange={(e) =>
                      setSelectedQuery({
                        ...selectedQuery,
                        endDate: e.target.value,
                      })
                    }
                    disabled={runningFetch}
                  />
                </div>
              </section>

              <button
                className={styles.runButton}
                type="submit"
                disabled={runningFetch}
              >
                {runningFetch ? "Running query..." : "Run selected query"}
              </button>
            </form>
          </section>
        )}

        {message && <p className={styles.message}>{message}</p>}
      </div>
    </div>
  );
}