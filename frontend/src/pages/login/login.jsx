import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Input from "../../components/Input/Input.jsx";
import Button from "../../components/Button/Button.jsx";
import ErrorModal from "../../components/ErrorModal/ErrorModal.jsx";
import ThemeToggle from "../../components/ThemeToggle/ThemeToggle.jsx";
import styles from "./login.module.css";

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(v)) return true;
    if (["false", "0", "no", "n", ""].includes(v)) return false;
  }
  return false;
}

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ username: "", password: "" });
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const triggerError = (msg) => {
    setErrorMessage(msg);
    setShowError(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAction = async () => {
    if (loading) return;

    const username = (formData.username || "").trim();
    const password = formData.password || "";

    if (!username) return triggerError("Please fill in your username");
    if (!password) return triggerError("Please fill in your password");

    const serverUrl =
      import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";
    const url = `${serverUrl}/auth/login`;

    setLoading(true);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        // ✅ Save token
        if (data?.access_token) {
          localStorage.setItem("token", data.access_token);
        }

        // ✅ user object comes inside "user"
        const user = data?.user;

        // ✅ Save username for UI
        localStorage.setItem("username", user?.username || username);

        // ✅ Admin flag is inside user as "isADMIN"
        const isAdmin = toBoolean(user?.isADMIN);

        localStorage.setItem("isADMIN", String(isAdmin));

        // ✅ Conditional navigation
        navigate(isAdmin ? "/home" : "/home-user");
      } else {
        const errorMsg = Array.isArray(data?.detail)
          ? data.detail?.[0]?.msg || "Login failed."
          : data?.detail || "Login failed.";
        triggerError(errorMsg);
      }
    } catch (err) {
      triggerError(`Could not connect to the server (${url}).`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      {/* Floating Theme Toggle */}
      <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 2000 }}>
        <ThemeToggle />
      </div>

      <div className={styles["login-card"]}>
        <header className={styles["login-header"]}>Welcome to TweetTag</header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAction();
          }}
        >
          <Input
            className={styles["username-input"]}
            name="username"
            value={formData.username}
            placeholder="Username"
            onChange={handleChange}
            autoComplete="username"
          />

          <Input
            className={styles["password-input"]}
            name="password"
            type="password"
            value={formData.password}
            placeholder="Password"
            onChange={handleChange}
            autoComplete="current-password"
          />

          <div className={styles["reg-container"]}>
  <span>Don't have an account?</span>
  <Link to="/register" className={styles["signup-link"]}>
    Sign Up
  </Link>
</div>

{}
<div className={styles["forgot-container"]}>
  <Link to="/forgot-password" className={styles["forgot-link"]}>
    Forgot password?
  </Link>
</div>

          <Button
            className={styles["btn-sub"]}
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </div>

      {showError && (
        <ErrorModal message={errorMessage} onClose={() => setShowError(false)} />
      )}
    </div>
  );
}