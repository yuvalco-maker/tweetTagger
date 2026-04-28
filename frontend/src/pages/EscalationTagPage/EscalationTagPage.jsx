import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../../components/Header/Header.jsx";
import Button from "../../components/Button/Button.jsx";
import ErrorModal from "../../components/ErrorModal/ErrorModal.jsx";
import styles from "./EscalationTagPage.module.css";

const TIMEOUT_MSG =
  "You ran out of time to tag this one. Go back or press X to claim again.";

function toText(content) {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;

  if (typeof content === "object") {
    const maybe =
      content.full_text || content.text || content.content || content.message;
    return maybe ? String(maybe) : JSON.stringify(content, null, 2);
  }

  return String(content);
}

function EscalationTweet({ tweet }) {
  const date = tweet?.created_at ? new Date(tweet.created_at).toLocaleString() : "";
  const raw = tweet?.content;
  const text = toText(raw);

  return (
    <div className={styles.tweetCard}>
      <div className={styles.tweetDate}>{date}</div>
      <div className={styles.tweetScroll}>
        {typeof raw === "object" ? (
          <pre className={styles.tweetText}>{text}</pre>
        ) : (
          <div className={styles.tweetText }dir="auto">{text}</div>
        )}
      </div>
    </div>
  );
}

export default function EscalationTagPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const passedTweet = location.state?.tweet || null;

  const [errorMsg, setErrorMsg] = useState(null);
  const [tweet, setTweet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [isDangerous, setIsDangerous] = useState(null);
  const [category, setCategory] = useState(null);

  const [receivedAt, setReceivedAt] = useState(null);

  const serverUrl =
    import.meta.env.VITE_SERVER_URL ||
    "https://em5epzymak.eu-west-3.awsapprunner.com";

  const tweetIdRef = useRef(null);
  const lockedAtRef = useRef(null);
  const isReleasingRef = useRef(false);
  const initialClaimDoneRef = useRef(false);

  const releaseEscalationLock = useCallback(async () => {
    const id = tweetIdRef.current;
    if (!id) return;

    if (isReleasingRef.current) return;
    isReleasingRef.current = true;

    try {
      const payload = { tweet_id: id };

      if (lockedAtRef.current) payload.locked_at = lockedAtRef.current;

      const res = await fetch(`${serverUrl}/release_escalated_lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn("releaseEscalationLock:", res.status, data?.detail || "failed");
      }
    } catch (e) {
      console.warn("releaseEscalationLock failed:", e);
    } finally {
      isReleasingRef.current = false;
    }
  }, [serverUrl]);

  const claimEscalated = useCallback(
    async (id) => {
      setLoading(true);
      setError("");
      setErrorMsg(null);

      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const res = await fetch(
          `${serverUrl}/claim_escalated_tweet?tweet_id=${encodeURIComponent(id)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.detail || "Failed to claim tweet");

        setTweet(data);

        tweetIdRef.current = data._id || data.id || null;
        lockedAtRef.current = data.locked_at || null;

        setIsDangerous(null);
        setCategory(null);
        setReceivedAt(Date.now());
      } catch (err) {
        setError(err?.message || "Unknown error");
        setTweet(null);
        tweetIdRef.current = null;
        lockedAtRef.current = null;
        setReceivedAt(null);
      } finally {
        setLoading(false);
      }
    },
    [navigate, serverUrl]
  );

  useEffect(() => {
    const id = passedTweet?._id || passedTweet?.id;
    if (!id) {
      navigate("/escalation");
      return;
    }
    if (initialClaimDoneRef.current) return;
    initialClaimDoneRef.current = true;

    claimEscalated(id);
  }, [passedTweet, claimEscalated, navigate]);

  useEffect(() => {
    return () => {
      if (tweetIdRef.current) releaseEscalationLock();
    };
  }, [releaseEscalationLock]);

  useEffect(() => {
    if (!receivedAt || errorMsg) return;

    const timerInterval = setInterval(async () => {
      const elapsedSeconds = (Date.now() - receivedAt) / 1000;
      if (elapsedSeconds > 600) {
        setReceivedAt(null);

        await releaseEscalationLock();

        setTweet(null);
        tweetIdRef.current = null;
        lockedAtRef.current = null;

        setErrorMsg(TIMEOUT_MSG);
        clearInterval(timerInterval);
      }
    }, 2000);

    return () => clearInterval(timerInterval);
  }, [receivedAt, errorMsg, releaseEscalationLock]);

  const handleCloseModal = async () => {
    if (errorMsg === TIMEOUT_MSG) {
      const id = passedTweet?._id || passedTweet?.id;
      if (id) {
        initialClaimDoneRef.current = false;
        claimEscalated(id);
      } else {
        navigate("/escalation");
      }
    } else {
      setErrorMsg(null);
    }
  };

  const setDanger = (bool) =>
    setIsDangerous((prev) => (prev === bool ? null : bool));

  const handleCategory = (cat) =>
    setCategory((prev) => (prev === cat ? null : cat));

  const submit = async () => {
    const tweetId = tweetIdRef.current;

    if (!tweet || !tweetId) {
      setErrorMsg("No tweet loaded");
      return false;
    }

    if (isDangerous === null || !category) {
      setErrorMsg("Tag the tweet first");
      return false;
    }

    if (isDangerous === true && category === "Unrelated") {
      setErrorMsg("A tweet can't be tagged as dangerous and Unrelated at the same time");
      return false;
    }

    try {
      const response = await fetch(`${serverUrl}/submit_escalated_tagged_tweet`, {
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

      setTweet(null);
      setReceivedAt(null);
      tweetIdRef.current = null;
      lockedAtRef.current = null;

      return true;
    } catch (err) {
      setErrorMsg(err?.message || "Request failed");
      return false;
    }
  };

  const submitAndBack = async () => {
    if (await submit()) navigate("/escalation");
  };

  const submitAndHome = async () => {
    if (await submit()) navigate("/home");
  };

  const handleBack = async () => {
    await releaseEscalationLock();
    setTweet(null);
    setReceivedAt(null);
    tweetIdRef.current = null;
    lockedAtRef.current = null;
    navigate("/escalation");
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
              <EscalationTweet tweet={tweet} />
            ) : (
              <p>No tweet</p>
            )}
          </div>

          <div className={styles.controls}>
            <div className={styles.sectionHeader}>Risk Assessment</div>
            <div className={styles.riskActions}>
            <Button
  className={`${styles.riskBtn} ${styles.safe} ${
    isDangerous === false ? styles.riskActive : ""
  }`}
  onClick={() => setDanger(false)}
  disabled={!tweet}
>
  Safe
</Button>

<Button
  className={`${styles.riskBtn} ${styles.danger} ${
    isDangerous === true ? styles.riskActive : ""
  }`}
  onClick={() => setDanger(true)}
  disabled={!tweet}
>
  Danger
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
              <Button variant="primary" onClick={submitAndBack} disabled={!tweet}>
                Submit & Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}