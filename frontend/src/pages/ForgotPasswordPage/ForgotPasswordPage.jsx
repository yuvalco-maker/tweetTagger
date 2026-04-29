import React, { useState } from "react";
import { Link } from "react-router-dom";
import Input from "../../components/Input/Input.jsx";
import Button from "../../components/Button/Button.jsx";
import ThemeToggle from "../../components/ThemeToggle/ThemeToggle.jsx";
import styles from "./ForgotPasswordPage.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const serverUrl =
    import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) return setError("Please enter your email address.");

    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.detail || "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 2000 }}>
        <ThemeToggle />
      </div>

      <div className={styles["forgot-card"]}>
        <div className={styles["logo-mark"]} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="white" width="26" height="26">
            <path d="M23.954 4.569a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.691 8.094 4.066 6.13 1.64 3.161a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.061a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.937 4.937 0 004.604 3.417 9.868 9.868 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.054 0 13.999-7.496 13.999-13.986 0-.209 0-.42-.015-.63a9.936 9.936 0 002.46-2.548l-.047-.02z" />
          </svg>
        </div>

        {submitted ? (
          <div className={styles["success-state"]}>
            <h1 className={styles["forgot-header"]}>Check your email</h1>
            <p className={styles["forgot-subtitle"]}>
              If an account with <strong>{email}</strong> exists, we've sent a password reset link. Check your inbox.
            </p>
          </div>
        ) : (
          <>
            <h1 className={styles["forgot-header"]}>Forgot password?</h1>
            <p className={styles["forgot-subtitle"]}>
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit}>
              <div className={styles["fields"]}>
                <Input
                  name="email"
                  type="email"
                  value={email}
                  placeholder="Email address"
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {error && <div className={styles["error-banner"]}>{error}</div>}

              <Button
                className={styles["btn-submit"]}
                type="submit"
                variant="primary"
                disabled={loading}
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}

        <p className={styles["back-link"]}>
          <Link to="/login" className={styles["link"]}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
