import React, { useState, useEffect, useRef } from "react";
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
  const googleBtnRef = useRef(null);

  const triggerError = (msg) => {
    setErrorMessage(msg);
    setShowError(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const saveUserAndGoHome = (data, fallbackUsername = "") => {
    if (data?.access_token) {
      localStorage.setItem("token", data.access_token);
    }

    localStorage.setItem("username", data?.username || fallbackUsername);
    localStorage.setItem("isADMIN", String(toBoolean(data?.isADMIN)));

    navigate("/home");
  };

  const handleGoogleCredential = async (googleResponse) => {
    const serverUrl =
      import.meta.env.VITE_SERVER_URL ||
      "https://em5epzymak.eu-west-3.awsapprunner.com";

    setLoading(true);

    try {
      const response = await fetch(`${serverUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: googleResponse.credential }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        saveUserAndGoHome(data);
      } else {
        const msg = Array.isArray(data?.detail)
          ? data.detail?.[0]?.msg || "Google login failed."
          : data?.detail || "Google login failed.";
        triggerError(msg);
      }
    } catch {
      triggerError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const init = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
      });

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: googleBtnRef.current.offsetWidth || 340,
          shape: "rectangular",
        });
      }
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      window.onGoogleLibraryLoad = init;
    }

    return () => {
      if (window.onGoogleLibraryLoad === init) {
        window.onGoogleLibraryLoad = undefined;
      }
    };
  }, []);

  const handleAction = async () => {
    if (loading) return;

    const username = (formData.username || "").trim();
    const password = formData.password || "";

    if (!username) return triggerError("Please fill in your username");
    if (!password) return triggerError("Please fill in your password");

    const serverUrl =
      import.meta.env.VITE_SERVER_URL ||
      "https://em5epzymak.eu-west-3.awsapprunner.com";

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
        saveUserAndGoHome(data, username);
      } else {
        const errorMsg = Array.isArray(data?.detail)
          ? data.detail?.[0]?.msg || "Login failed."
          : data?.detail || "Login failed.";
        triggerError(errorMsg);
      }
    } catch {
      triggerError(`Could not connect to the server (${url}).`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 2000 }}>
        <ThemeToggle />
      </div>

      <div className={styles["login-card"]}>
        <div className={styles["logo-mark"]} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="white" width="26" height="26">
            <path d="M23.954 4.569a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.691 8.094 4.066 6.13 1.64 3.161a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.061a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.937 4.937 0 004.604 3.417 9.868 9.868 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.054 0 13.999-7.496 13.999-13.986 0-.209 0-.42-.015-.63a9.936 9.936 0 002.46-2.548l-.047-.02z" />
          </svg>
        </div>

        <h1 className={styles["login-header"]}>Welcome back</h1>
        <p className={styles["login-subtitle"]}>Sign in to Tweet-Tagger</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAction();
          }}
        >
          <div className={styles["fields"]}>
            <Input
              name="username"
              value={formData.username}
              placeholder="Username"
              onChange={handleChange}
              autoComplete="username"
            />

            <Input
              name="password"
              type="password"
              value={formData.password}
              placeholder="Password"
              onChange={handleChange}
              autoComplete="current-password"
            />
          </div>

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
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className={styles["divider"]}>or</div>

        <div ref={googleBtnRef} className={styles["google-btn-container"]} />

        <p className={styles["reg-container"]}>
          Don't have an account?
          <Link to="/register" className={styles["signup-link"]}>
            Sign up
          </Link>
        </p>
      </div>

      {showError && (
        <ErrorModal message={errorMessage} onClose={() => setShowError(false)} />
      )}
    </div>
  );
}