import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle/ThemeToggle.jsx";
import styles from "./ResetPasswordPage.module.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const serverUrl =
      import.meta.env.VITE_SERVER_URL ||
      "https://em5epzymak.eu-west-3.awsapprunner.com";


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("No reset token received.");
      return;
    }

    if (!newPassword.trim()) {
      setError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${serverUrl}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to reset password");
      }

      setMessage(data.message || "Password changed successfully");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 2000 }}>
        <ThemeToggle />
      </div>

      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Reset Password</h1>
          <p className={styles.subtitle}>
            Enter your new password below to secure your account.
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                className={styles.input}
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                className={styles.input}
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {message && <div className={styles.message}>{message}</div>}

            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate("/login")}
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}