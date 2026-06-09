import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TaggedTweetCard from "../../components/TaggedTweetCard/TaggedTweetCard.jsx";
import styles from "./AllTweets.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "https://em5epzymak.eu-west-3.awsapprunner.com";

const PAGE_SIZE = 50;

export default function AllTweets() {
  const navigate = useNavigate();

  const [tweets, setTweets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem("scroll_alltweets");
    return saved ? (JSON.parse(saved).page ?? 1) : 1;
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchPage = useCallback(async (p) => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    setLoading(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/tweet-fetch/all-processed?skip=${(p - 1) * PAGE_SIZE}&limit=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage(data?.detail || "Failed to load tweets.");
        return;
      }

      setTotal(data.total);
      setTweets(data.tweets);

    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchPage(page); }, [page, fetchPage]);

  // Restore scroll after data renders
  useEffect(() => {
    if (loading || tweets.length === 0) return;
    const saved = sessionStorage.getItem("scroll_alltweets");
    if (saved) {
      const { scrollY } = JSON.parse(saved);
      sessionStorage.removeItem("scroll_alltweets");
      if (scrollY) window.scrollTo(0, scrollY);
    }
  }, [loading, tweets]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const goTo = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageNumbers = () => {
    const pages = [];
    const delta = 2;
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
      pages.push(i);
    }
    return pages;
  };

  if (loading) return <div className={styles.page}>Loading tweets…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back
        </button>
        <h1>All Tagged Tweets</h1>
        <p>Page {page} of {totalPages} — {total} tweets total</p>
      </div>

      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.list}>
        {tweets.map((tweet) => (
          <TaggedTweetCard
            key={tweet._id}
            tweet={tweet}
            onClick={
              tweet.tweet_id
                ? () => {
                    sessionStorage.setItem("scroll_alltweets", JSON.stringify({ page, scrollY: window.scrollY }));
                    navigate(`/tweet-detail/${tweet.tweet_id}`);
                  }
                : undefined
            }
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => goTo(page - 1)} disabled={page === 1}>
            ←
          </button>

          {page > 3 && (
            <>
              <button className={styles.pageBtn} onClick={() => goTo(1)}>1</button>
              {page > 4 && <span className={styles.ellipsis}>…</span>}
            </>
          )}

          {pageNumbers().map((n) => (
            <button
              key={n}
              className={n === page ? styles.pageBtnActive : styles.pageBtn}
              onClick={() => goTo(n)}
            >
              {n}
            </button>
          ))}

          {page < totalPages - 2 && (
            <>
              {page < totalPages - 3 && <span className={styles.ellipsis}>…</span>}
              <button className={styles.pageBtn} onClick={() => goTo(totalPages)}>{totalPages}</button>
            </>
          )}

          <button className={styles.pageBtn} onClick={() => goTo(page + 1)} disabled={page === totalPages}>
            →
          </button>
        </div>
      )}
    </div>
  );
}
