import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./TweetDetail.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

const CATEGORIES = ["Oil", "Electricity", "Gas", "Other"];

function dangerLabel(val) {
  if (val === true) return "Dangerous";
  if (val === false) return "Not dangerous";
  return "—";
}

export default function TweetDetail() {
  const { tweetId } = useParams();
  const navigate = useNavigate();

  const [tweet, setTweet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  const [category, setCategory] = useState("");
  const [isDangerous, setIsDangerous] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    fetch(`${SERVER_URL}/tweet-fetch/tweet/${tweetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) { navigate("/login"); return null; }
        return res.json().catch(() => null);
      })
      .then((data) => {
        if (!data) { setMessage("Tweet not found."); return; }
        if (data.detail) { setMessage(data.detail); return; }
        setTweet(data);
        setCategory(data.category || "");
        setIsDangerous(data.is_dangerous ?? null);
      })
      .catch(() => setMessage("Could not connect to the server."))
      .finally(() => setLoading(false));
  }, [tweetId, navigate]);

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    setSaving(true);
    setMessage("");
    setSaved(false);

    try {
      const res = await fetch(`${SERVER_URL}/tweet-fetch/tweet/${tweet._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...tweet, category, is_dangerous: isDangerous }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data?.detail || "Failed to save.");
        return;
      }

      setTweet(data);
      setCategory(data.category || "");
      setIsDangerous(data.is_dangerous ?? null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    tweet && (category !== tweet.category || isDangerous !== tweet.is_dangerous);

  const isInvalidCombo = isDangerous === true && category === "Other";

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>Loading tweet…</div>
      </div>
    );
  }

  if (!tweet) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>← Back</button>
          <p className={styles.errorMsg}>{message || "Tweet not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className={styles.tweetMeta}>
          <span className={styles.author}>@{tweet.username || "unknown"}</span>
          {tweet.created_at && (
            <span className={styles.date}>
              {new Date(tweet.created_at).toLocaleString()}
            </span>
          )}
          {tweet.edited && <span className={styles.editedBadge}>edited</span>}
        </div>

        <p className={styles.content} dir="auto">{tweet.content}</p>

        {tweet.url && (
          <a
            href={tweet.url}
            target="_blank"
            rel="noreferrer"
            className={styles.tweetLink}
          >
            View original tweet ↗
          </a>
        )}

        <div className={styles.divider} />

        <h2 className={styles.sectionTitle}>Tagging</h2>

        <div className={styles.field}>
          <span className={styles.label}>Category</span>
          <div className={styles.pills}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={category === cat ? styles.pillActive : styles.pill}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Danger level</span>
          <div className={styles.pills}>
            <button
              className={isDangerous === true ? styles.pillDanger : styles.pill}
              onClick={() => setIsDangerous(true)}
            >
              Dangerous
            </button>
            <button
              className={isDangerous === false ? styles.pillSafe : styles.pill}
              onClick={() => setIsDangerous(false)}
            >
              Not dangerous
            </button>
          </div>
        </div>

        {tweet.edited && (
          <div className={styles.originalSection}>
            <p className={styles.originalLabel}>Original ML tagging</p>
            <div className={styles.originalRow}>
              <div className={styles.originalItem}>
                <span className={styles.originalKey}>Category</span>
                <span className={styles.originalVal}>{tweet.original_category || "—"}</span>
              </div>
              <div className={styles.originalItem}>
                <span className={styles.originalKey}>Dangerous</span>
                <span className={styles.originalVal}>{dangerLabel(tweet.original_is_dangerous)}</span>
              </div>
            </div>
          </div>
        )}

        {message && <p className={styles.errorMsg}>{message}</p>}

        {isInvalidCombo && (
          <p className={styles.errorMsg}>
            "Other" category cannot be tagged as dangerous.
          </p>
        )}

        <button
          className={saved ? styles.saveButtonSaved : styles.saveButton}
          onClick={handleSave}
          disabled={saving || !hasChanges || isDangerous === null || !category || isInvalidCombo}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
