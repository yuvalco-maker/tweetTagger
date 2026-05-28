import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TweetMap from "../../components/TweetMap/TweetMap.jsx";
import styles from "./GlobalThreatMap.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

export default function GlobalThreatMap() {
  const navigate = useNavigate();
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tweetCount, setTweetCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    fetch(`${SERVER_URL}/tweet-fetch/dangerous-locations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) { navigate("/login"); return null; }
        return res.json().catch(() => []);
      })
      .then((data) => {
        if (!data) return;
        if (data.detail) { setMessage(data.detail); return; }

        setTweetCount(data.length);
        // Flatten all coordinates from all tweets
        const allCoords = data.flatMap((t) =>
          Array.isArray(t.coordinates)
            ? t.coordinates.map((c) => ({
                ...c,
                category: t.category || null,
                is_dangerous: t.is_dangerous ?? null,
              }))
            : []
        );
        setCoordinates(allCoords);
      })
      .catch(() => setMessage("Could not connect to the server."))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return <div className={styles.page}>Loading threat map…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back
        </button>
        <h1>Global Threat Map</h1>
        <p>
          {tweetCount} dangerous tweet{tweetCount !== 1 ? "s" : ""} with identified
          locations — {coordinates.length} location mention
          {coordinates.length !== 1 ? "s" : ""} total
        </p>
      </div>

      {message && <p className={styles.message}>{message}</p>}

      {coordinates.length === 0 && !message && (
        <p className={styles.message}>
          No dangerous tweets with coordinates found yet. Run a search query first.
        </p>
      )}

      <div className={styles.mapSection}>
        <TweetMap coordinates={coordinates} />
      </div>
    </div>
  );
}
