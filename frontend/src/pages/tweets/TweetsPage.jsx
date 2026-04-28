import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Tweet from "../../components/Tweet/Tweet.jsx";
import Header from "../../components/Header/Header.jsx";
import Button from "../../components/Button/Button.jsx";
import ErrorModal from "../../components/ErrorModal/ErrorModal.jsx";
import styles from "./TweetsPage.module.css";

const TIMEOUT_MSG =
  "You ran out of time to tag this one. Go back home or press X to tag a new one.";

export default function TweetsPage() {
  const navigate = useNavigate();

  const [errorMsg, setErrorMsg] = useState(null);
  const [tweetId, setTweetId] = useState(null);
  const [tweet, setTweet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [isDangerous, setIsDangerous] = useState(null);
  const [category, setCategory] = useState(null);

  // timer anchor
  const [receivedAt, setReceivedAt] = useState(null);

  const serverUrl = import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

  const token = localStorage.getItem("token");

  // ✅ release lock helper
  const releaseLock = useCallback(
    async (id) => {
      if (!id) return;
      try {
        await fetch(`${serverUrl}/release_tweet_lock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ tweet_id: id, locked_at: new Date().toISOString() }),
        });
      } catch (e) {
        console.warn("releaseLock failed:", e);
      }
    },
    [serverUrl]
  );

  const resetTagState = () => {
    setIsDangerous(null);
    setCategory(null);
  };

  const fetchSingleTweet = useCallback(async () => {
    setLoading(true);
    setError("");
    setErrorMsg(null);

    if (!token) {
      navigate("/login");
      return;
    }

    if (tweetId) {
      await releaseLock(tweetId);
    }

    try {
      const res = await fetch(`${serverUrl}/claim_tweet`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 404) {
          setTweet(null);
          setTweetId(null);
          resetTagState();
          setReceivedAt(null);
          setError(""); // לא error אדום
          setErrorMsg(data?.detail || "No tweet available for tagging");
          return;
        }

        throw new Error(data?.detail || "Failed to fetch tweet");
      }

      const id = data?._id || data?.id;
      setTweet(data);
      setTweetId(id || null);
      resetTagState();

      // ✅ Start timer only when tweet exists
      setReceivedAt(Date.now());
    } catch (err) {
      setError(err?.message || "Unknown error");
      setTweet(null);
      setTweetId(null);
      setReceivedAt(null);
    } finally {
      setLoading(false);
    }
  }, [navigate, serverUrl, token, tweetId, releaseLock]);

  useEffect(() => {
    fetchSingleTweet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ release lock on unmount
  useEffect(() => {
    return () => {
      if (tweetId) releaseLock(tweetId);
    };
  }, [tweetId, releaseLock]);

  // Timer logic
  useEffect(() => {
    if (!receivedAt || errorMsg || !tweetId) return;

    const timerInterval = setInterval(() => {
      const elapsedSeconds = (Date.now() - receivedAt) / 1000;

      if (elapsedSeconds > 600) {
        setReceivedAt(null);
        setErrorMsg(TIMEOUT_MSG);
        clearInterval(timerInterval);
      }
    }, 2000);

    return () => clearInterval(timerInterval);
  }, [receivedAt, errorMsg, tweetId]);

  const handleCloseModal = () => {
    if (errorMsg === TIMEOUT_MSG) {
      fetchSingleTweet();
    } else {
      setErrorMsg(null);
    }
  };

  const setDanger = (bool) =>
    setIsDangerous((prev) => (prev === bool ? null : bool));
  const handleCategory = (cat) =>
    setCategory((prev) => (prev === cat ? null : cat));

  const submit = async () => {
    if (!tweet || !tweetId) {
      setErrorMsg("No tweet loaded");
      return false;
    }

    if (isDangerous === null || !category) {
      setErrorMsg("Tag the tweet first");
      return false;
    }

    if (isDangerous === true && category === "Unrelated") {
      setErrorMsg(
        "A tweet can't be tagged as dangerous and Unrelated at the same time"
      );
      return false;
    }

    try {
      const response = await fetch(`${serverUrl}/submit_tagged_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          tweet_id: tweetId,
          locked_at: tweet.locked_at, 
          category,
          is_dangerous: isDangerous,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMsg(data?.detail || "Request failed");
        return false;
      }

      // אחרי submit מוצלח, הנעילה כבר לא רלוונטית (הציוץ מועבר/נמחק)
      setTweet(null);
      setTweetId(null);
      setReceivedAt(null);

      return true;
    } catch (err) {
      setErrorMsg(err?.message || "Request failed");
      return false;
    }
  };

  const submitAndHome = async () => {
  if (await submit()) {
    const isAdmin = localStorage.getItem("isADMIN") === "true";
    navigate(isAdmin ? "/home" : "/home-user");
  }
};

  const submitAndNext = async () => {
    if (await submit()) fetchSingleTweet();
  };

  const escalate = async () => {
    if (!tweet || !tweetId) return;

    try {
      const response = await fetch(`${serverUrl}/escalate_tweet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ tweet_id: tweetId, locked_at: tweet.locked_at }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setTweet(null);
        setTweetId(null);
        setReceivedAt(null);
        fetchSingleTweet();
      } else {
        setErrorMsg(data?.detail || "Escalation failed");
      }
    } catch (err) {
      setErrorMsg(err?.message || "Escalation failed");
    }
  };

  const handleBack = async () => {
  if (tweetId) {
    await releaseLock(tweetId);
  }

  const isAdmin = localStorage.getItem("isADMIN") === "true";

  navigate(isAdmin ? "/home" : "/home-user");
};

  if (loading) return <div className={styles.center}>Loading...</div>;

  return (
    <div className={styles.page}>
      <Header />
      {errorMsg && <ErrorModal message={errorMsg} onClose={handleCloseModal} />}

      <div className={styles.mainWrapper}>
        <div className={styles.container}>
          <div className={styles.scrollableContent}>
            {error ? (
              <div className={styles.error}>{error}</div>
            ) : tweet ? (
              <Tweet tweet={tweet} />
            ) : (
              <p>No tweet</p>
            )}
          </div>

          <div className={styles.controls}>
            <div className={styles.sectionHeader}>Risk Assessment</div>
            <div className={styles.riskActions}>
              <Button
                className={`${styles.riskBtn} ${
                  isDangerous === false ? styles.active : styles.safe
                }`}
                onClick={() => setDanger(false)}
                disabled={!tweet}
              >
                Safe
              </Button>

              <Button
                className={`${styles.riskBtn} ${
                  isDangerous === true ? styles.active : styles.danger
                }`}
                onClick={() => setDanger(true)}
                disabled={!tweet}
              >
                Danger
              </Button>

              <Button
                className={`${styles.riskBtn} ${styles.escalate}`}
                onClick={escalate}
                disabled={!tweet}
              >
                Move to expert
              </Button>
            </div>

            <div className={styles.sectionHeader}>Category</div>
            <div className={styles.categoryGrid}>
              {["Oil", "Electricity", "Gas", "Unrelated"].map((cat) => (
                <button
                  key={cat}
                  className={`${styles.catCard} ${
                    category === cat ? styles.active : ""
                  }`}
                  onClick={() => handleCategory(cat)}
                  disabled={!tweet}
                  type="button"
                >
                  {cat === "Electricity"
                    ? "Electric"
                    : cat === "Unrelated"
                    ? "Other"
                    : cat}
                </button>
              ))}
            </div>

            <div className={styles.navActions}>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button variant="primary" onClick={submitAndHome} disabled={!tweet}>
                Submit & Home
              </Button>
              <Button variant="primary" onClick={submitAndNext} disabled={!tweet}>
                Submit & Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}