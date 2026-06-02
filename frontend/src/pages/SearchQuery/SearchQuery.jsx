import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./SearchQuery.module.css";

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

export default function SearchQuery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pre-fill from URL params (e.g. launched from Entity Explorer)
  const paramKeywords = searchParams.get("keywords");
  const paramStart    = searchParams.get("start_date");
  const paramEnd      = searchParams.get("end_date");

  const [keywords, setKeywords] = useState(
    paramKeywords ? paramKeywords.split(" ").filter(Boolean) : [""]
  );
  const [language, setLanguage] = useState("en");
  const [maxItems, setMaxItems] = useState(10);

  const [rangeMode, setRangeMode] = useState(paramStart ? "custom" : "week");
  const [startDate, setStartDate] = useState(paramStart || getDateDaysAgo(7));
  const [endDate, setEndDate]     = useState(paramEnd   || getTodayDate());

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleKeywordChange = (index, value) => {
    const updated = [...keywords];
    updated[index] = value;
    setKeywords(updated);
  };

  const addKeyword = () => {
    if (keywords.length >= 15) {
      setMessage("You can add up to 15 keywords only.");
      return;
    }

    setKeywords([...keywords, ""]);
  };

  const removeKeyword = (index) => {
    if (keywords.length === 1) return;
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleRangeChange = (value) => {
    setRangeMode(value);

    const today = getTodayDate();

    if (value === "week") {
      setStartDate(getDateDaysAgo(7));
      setEndDate(today);
    }

    if (value === "month") {
      setStartDate(getDateDaysAgo(30));
      setEndDate(today);
    }

    if (value === "threeMonths") {
      setStartDate(getDateDaysAgo(90));
      setEndDate(today);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const cleanKeywords = keywords
      .map((word) => word.trim())
      .filter(Boolean);

    if (cleanKeywords.length === 0) {
      setMessage("Please enter at least one keyword.");
      return;
    }

    if (cleanKeywords.length > 15) {
      setMessage("You can search with up to 15 keywords.");
      return;
    }

    if (!startDate || !endDate) {
      setMessage("Please choose start and end dates.");
      return;
    }

    if (startDate > endDate) {
      setMessage("Start date cannot be after end date.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setMessage("You are not logged in.");
      navigate("/login");
      return;
    }

    const body = {
      keywords: cleanKeywords,
      language,
      start_date: startDate,
      end_date: endDate,
      max_items: Number(maxItems),
    };

    setLoading(true);

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
        setMessage(data?.detail || "Failed to fetch tweets.");
        return;
      }

      navigate(`/query-results/${data.query_id}`);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back home
        </button>
        <div style={{ float: "right", display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={styles.smartButton}
            onClick={() => navigate("/smart-query-suggestions")}
          >
            ✨ Smart Suggestions
          </button>
          <button
            type="button"
            className={styles.mabButton}
            onClick={() => navigate("/mab-suggestions")}
          >
            🎯 MAB Suggestions
          </button>
        </div>

        <h1 className={styles.title}>Search Query</h1>
        <p className={styles.subtitle}>
          Choose keywords and a time range. The system will fetch tweets from
          Apify and run the random ML model automatically.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <section className={styles.section}>
            <label className={styles.label}>Indicative keywords</label>

            <div className={styles.keywordsList}>
              {keywords.map((keyword, index) => (
                <div className={styles.keywordRow} key={index}>
                  <input
                    className={styles.input}
                    value={keyword}
                    onChange={(e) =>
                      handleKeywordChange(index, e.target.value)
                    }
                    placeholder={`Keyword ${index + 1}`}
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeKeyword(index)}
                    disabled={keywords.length === 1 || loading}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={addKeyword}
              disabled={keywords.length >= 15 || loading}
            >
              + Add keyword
            </button>

            <p className={styles.hint}>{keywords.length}/15 keywords</p>
          </section>

          <section className={styles.grid}>
            <div>
              <label className={styles.label}>Language</label>
              <select
                className={styles.input}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={loading}
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
                disabled={loading}
              />
            </div>
          </section>

          <section className={styles.section}>
            <label className={styles.label}>Time range</label>

            <div className={styles.rangeButtons}>
              <button
                type="button"
                className={
                  rangeMode === "week"
                    ? styles.activeRangeButton
                    : styles.rangeButton
                }
                onClick={() => handleRangeChange("week")}
                disabled={loading}
              >
                Last week
              </button>

              <button
                type="button"
                className={
                  rangeMode === "month"
                    ? styles.activeRangeButton
                    : styles.rangeButton
                }
                onClick={() => handleRangeChange("month")}
                disabled={loading}
              >
                Last month
              </button>

              <button
                type="button"
                className={
                  rangeMode === "threeMonths"
                    ? styles.activeRangeButton
                    : styles.rangeButton
                }
                onClick={() => handleRangeChange("threeMonths")}
                disabled={loading}
              >
                Last 3 months
              </button>

              <button
                type="button"
                className={
                  rangeMode === "custom"
                    ? styles.activeRangeButton
                    : styles.rangeButton
                }
                onClick={() => setRangeMode("custom")}
                disabled={loading}
              >
                Custom
              </button>
            </div>

            <div className={styles.grid}>
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
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
            </div>
          </section>

          <button className={styles.submitButton} type="submit" disabled={loading}>
            {loading ? "Fetching and running ML..." : "Fetch tweets"}
          </button>
        </form>

        {message && <p className={styles.message}>{message}</p>}
      </div>
    </div>
  );
}