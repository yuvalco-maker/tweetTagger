import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import TweetMap from "../../components/TweetMap/TweetMap.jsx";
import TaggedTweetCard from "../../components/TaggedTweetCard/TaggedTweetCard.jsx";
import styles from "./LocationTweets.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

export default function LocationTweets() {
  const { queryId } = useParams();           // present when coming from QueryResults
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const placeName = searchParams.get("place") || "";

  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    // Per-query mode: fetch tweets for that query only
    // Global mode (no queryId): fetch all dangerous tweets with coordinates
    const url = queryId
      ? `${SERVER_URL}/tweet-fetch/query/${queryId}/tweets`
      : `${SERVER_URL}/tweet-fetch/dangerous-locations`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401) { navigate("/login"); return null; }
        return res.json().catch(() => []);
      })
      .then((data) => {
        if (!data) return;
        if (data.detail) { setMessage(data.detail); return; }

        const filtered = data.filter(
          (t) =>
            t.is_dangerous !== false &&          // global endpoint only returns dangerous
            Array.isArray(t.coordinates) &&
            t.coordinates.some(
              (c) => c.place_name.toLowerCase() === placeName.toLowerCase()
            )
        );
        setTweets(filtered);
      })
      .catch(() => setMessage("Could not connect to the server."))
      .finally(() => setLoading(false));
  }, [queryId, placeName, navigate]);

  const locationCoords = tweets
    .flatMap((t) =>
      (t.coordinates || []).map((c) => ({
        ...c,
        category: t.category || null,
        is_dangerous: t.is_dangerous ?? null,
      }))
    )
    .filter((c) => c.place_name.toLowerCase() === placeName.toLowerCase())
    .slice(0, 1);

  const backPath = queryId ? `/query-results/${queryId}` : "/threat-map";

  if (loading) return <div className={styles.page}>Loading...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(backPath)}>
          ← Back
        </button>
        <h1>{placeName}</h1>
        <p>
          {tweets.length} dangerous tweet{tweets.length !== 1 ? "s" : ""} mentioning
          this location{queryId ? " in this query" : ""}
        </p>
      </div>

      {locationCoords.length > 0 && (
        <div className={styles.mapSection}>
          <TweetMap coordinates={locationCoords} />
        </div>
      )}

      {message && <p className={styles.message}>{message}</p>}

      {tweets.length === 0 && !message && (
        <p className={styles.message}>No dangerous tweets found for this location.</p>
      )}

      <div className={styles.list}>
        {tweets.map((tweet) => (
          <TaggedTweetCard
            key={tweet._id || tweet.tweet_id}
            tweet={tweet}
            onClick={tweet.tweet_id ? () => navigate(`/tweet-detail/${tweet.tweet_id}`) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
