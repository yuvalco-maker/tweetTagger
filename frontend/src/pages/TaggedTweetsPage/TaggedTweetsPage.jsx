import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header.jsx";
import TaggedTweetCard from "../../components/TaggedTweetCard/TaggedTweetCard.jsx";
import styles from "./TaggedTweetsPage.module.css";

function isTaggedTweet(t) {
  if (!t) return false;
  if (t.status === "tagged") return true;
  if (t.tagged_by) return true;
  if (t.is_dangerous === true || t.is_dangerous === false) return true;
  if (t.category) return true;
  return false;
}

// show a window of pages around current page
function getPageWindow(current, total, windowSize = 7) {
  if (!total || total <= 1) return [1];
  const half = Math.floor(windowSize / 2);

  let start = Math.max(1, current - half);
  let end = Math.min(total, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

export default function TaggedTweetsPage() {
  const navigate = useNavigate();

  const [rawItems, setRawItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const serverUrl = import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

  const handleEditClick = (tweet) => {
    if (tweet.status === "tagging") {
      alert("This tweet is currently being edited by another admin.");
      return;
    }
    navigate("/edit-tweet", { state: { tweet } });
  };

  const fetchPage = async (pageNum) => {
    setLoading(true);
    setError("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const res = await fetch(
        `${serverUrl}/get_tweets_for_display?page=${pageNum}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.detail || "Failed to fetch tweets";
        setError(msg);
        if (res.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        }
        return;
      }

      // ✅ expects { items, totalPages, ... }
      const items = Array.isArray(data?.items) ? data.items : [];
      setRawItems(items);

      const tp = Number.isFinite(data?.totalPages) ? data.totalPages : 1;
      setTotalPages(Math.max(1, tp));
    } catch (e) {
      setError("Network error while fetching tweets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(page);
  }, [page]);

  const taggedTweets = useMemo(() => {
    return rawItems
      .map((pair) => {
        if (Array.isArray(pair)) {
          const tweet = pair[0];
          const username = pair[1];
          return { ...tweet, tagged_by_username: username };
        }
        return pair;
      })
  }, [rawItems]);

  const pageNumbers = useMemo(
    () => getPageWindow(page, totalPages, 7),
    [page, totalPages]
  );

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.bg} />

      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>Tagged Tweets</h2>
          <div className={styles.actions}>
            <button
              className={`${styles.btn} ${styles.btnMid}`}
              onClick={() => navigate("/home")}
            >
              back
            </button>
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {loading ? (
          <div className={styles.infoBox}>Loading...</div>
        ) : taggedTweets.length === 0 ? (
          <div className={styles.infoBox}>No tagged tweets found.</div>
        ) : (
          <div className={styles.list}>
            {taggedTweets.map((tweet, idx) => {
              const isLocked = tweet.status === "tagging";

              return (
                <div
                  key={tweet?._id || tweet?.id || idx}
                  className={`${styles.item} ${
                    isLocked ? styles.lockedItem : ""
                  }`}
                  onClick={() => handleEditClick(tweet)}
                  style={{
                    cursor: isLocked ? "not-allowed" : "pointer",
                    position: "relative",
                  }}
                >
                  <TaggedTweetCard tweet={tweet} />
                  {isLocked && (
                    <div className={styles.lockOverlay}>
                      <span>🔒 Being Edited</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ✅ Pagination with numbers */}
        <div className={styles.pagination}>
          <button
            className={`${styles.btn} ${styles.btnLight}`}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            prev
          </button>

          <div className={styles.pageNumbers}>
            <button
              className={`${styles.pageBtn} ${
                page === 1 ? styles.activePage : ""
              }`}
              onClick={() => setPage(1)}
              disabled={loading}
            >
              1
            </button>

            {pageNumbers[0] > 2 && (
              <span className={styles.ellipsis}>…</span>
            )}

            {pageNumbers
              .filter((p) => p !== 1 && p !== totalPages)
              .map((p) => (
                <button
                  key={p}
                  className={`${styles.pageBtn} ${
                    page === p ? styles.activePage : ""
                  }`}
                  onClick={() => setPage(p)}
                  disabled={loading}
                >
                  {p}
                </button>
              ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
              <span className={styles.ellipsis}>…</span>
            )}

            {totalPages > 1 && (
              <button
                className={`${styles.pageBtn} ${
                  page === totalPages ? styles.activePage : ""
                }`}
                onClick={() => setPage(totalPages)}
                disabled={loading}
              >
                {totalPages}
              </button>
            )}
          </div>

          <button
            className={`${styles.btn} ${styles.btnLight}`}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={loading || page >= totalPages}
          >
            next
          </button>

          <span className={styles.pageLabel}>
            page {page} / {totalPages}
          </span>
        </div>
      </div>
    </div>
  );
}