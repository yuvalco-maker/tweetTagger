import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./AdminPanel.module.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";

function getIsAdmin() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return false;
    return !!JSON.parse(atob(token.split(".")[1])).isADMIN;
  } catch {
    return false;
  }
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!getIsAdmin()) { navigate("/home"); return; }

    const token = localStorage.getItem("token");
    fetch(`${SERVER_URL}/users/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json().catch(() => []))
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
        else setMessage(data?.detail || "Failed to load users.");
      })
      .catch(() => setMessage("Could not connect to the server."))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handlePromote = async (userId, username) => {
    const token = localStorage.getItem("token");
    setPromoting(userId);
    setMessage("");

    try {
      const res = await fetch(`${SERVER_URL}/users/${userId}/promote`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.detail || "Failed to promote user.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => u._id === userId ? { ...u, isADMIN: true } : u)
      );
      setMessage(`${username} is now an admin.`);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setPromoting(null);
    }
  };

  if (loading) return <div className={styles.page}>Loading users…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate("/home")}>
          ← Back
        </button>
        <h1>Admin Panel</h1>
        <p>{users.length} users</p>
      </div>

      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.list}>
        {users.map((user) => (
          <div key={user._id} className={styles.userCard}>
            <div className={styles.userInfo}>
              <div className={styles.avatar}>
                {user.username?.slice(0, 2).toUpperCase() || "??"}
              </div>
              <div className={styles.userDetails}>
                <span className={styles.username}>{user.username}</span>
                <span className={styles.email}>{user.email}</span>
                <span className={styles.provider}>{user.provider || "local"}</span>
              </div>
            </div>
            <div className={styles.userActions}>
              {user.isADMIN ? (
                <span className={styles.adminBadge}>Admin</span>
              ) : (
                <button
                  className={styles.promoteBtn}
                  onClick={() => handlePromote(user._id, user.username)}
                  disabled={promoting === user._id}
                >
                  {promoting === user._id ? "Promoting…" : "Make admin"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
