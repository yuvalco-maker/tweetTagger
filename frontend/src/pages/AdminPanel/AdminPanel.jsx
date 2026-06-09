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

function UserRow({ user, onPromote, promoting }) {
  const initials = user.username?.slice(0, 2).toUpperCase() || "??";
  return (
    <div className={styles.userRow}>
      <div className={styles.userLeft}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.userDetails}>
          <span className={styles.username}>{user.username}</span>
          <span className={styles.email}>{user.email}</span>
        </div>
      </div>
      <div className={styles.userRight}>
        <span className={`${styles.providerTag} ${user.provider === "google" ? styles.google : ""}`}>
          {user.provider || "local"}
        </span>
        {user.isADMIN ? (
          <span className={styles.adminBadge}>Admin</span>
        ) : (
          <button
            className={styles.promoteBtn}
            onClick={() => onPromote(user._id, user.username)}
            disabled={promoting === user._id}
          >
            {promoting === user._id ? "Promoting…" : "Make admin"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

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
      if (!res.ok) { setMessage(data?.detail || "Failed to promote user."); return; }
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isADMIN: true } : u));
      setMessage(`${username} is now an admin.`);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setPromoting(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const admins = filtered.filter((u) => u.isADMIN);
  const regular = filtered.filter((u) => !u.isADMIN);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Loading users…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate("/home")}>
          ← Back
        </button>
        <div className={styles.topBarRight}>
          <button className={styles.activityBtn} onClick={() => navigate("/user-progress")}>
            User Progress →
          </button>
          <button className={styles.activityBtn} onClick={() => navigate("/user-activity")}>
            User Activity →
          </button>
        </div>
      </div>

      {/* ── Hero header ── */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <h1 className={styles.heroTitle}>Admin Panel</h1>
          <p className={styles.heroSub}>{users.length} registered users · {admins.length + (search ? admins.length : users.filter(u => u.isADMIN).length)} admins</p>
        </div>
      </div>

      {/* ── Stat chips ── */}
      <div className={styles.chips}>
        <div className={styles.chip}>
          <span className={styles.chipNum}>{users.length}</span>
          <span className={styles.chipLabel}>Total users</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipNum}>{users.filter(u => u.isADMIN).length}</span>
          <span className={styles.chipLabel}>Admins</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipNum}>{users.filter(u => u.provider === "google").length}</span>
          <span className={styles.chipLabel}>Google sign-in</span>
        </div>
        <div className={styles.chip}>
          <span className={styles.chipNum}>{users.filter(u => !u.isADMIN).length}</span>
          <span className={styles.chipLabel}>Regular users</span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className={styles.searchInput}
          placeholder="Filter by username or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {message && <p className={styles.feedback}>{message}</p>}

      {/* ── User list ── */}
      <div className={styles.lists}>
        {admins.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Admins</h2>
            <div className={styles.userList}>
              {admins.map((u) => (
                <UserRow key={u._id} user={u} onPromote={handlePromote} promoting={promoting} />
              ))}
            </div>
          </section>
        )}

        {regular.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Users</h2>
            <div className={styles.userList}>
              {regular.map((u) => (
                <UserRow key={u._id} user={u} onPromote={handlePromote} promoting={promoting} />
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <p className={styles.empty}>No users match &ldquo;{search}&rdquo;</p>
        )}
      </div>
    </div>
  );
}
