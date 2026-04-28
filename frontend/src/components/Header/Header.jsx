import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle/ThemeToggle.jsx"
import styles from "./Header.module.css"; 

export default function Header() {
  const navigate = useNavigate();
  const [headerData, setHeaderData] = useState({ username: "Loading...", processed_count: 0 });

  useEffect(() => {
    const fetchHeaderData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const serverUrl = import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";
        const endpoint = "/get_header_data";
        
        const res = await fetch(`${serverUrl}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        
        if (res.ok) {
          setHeaderData(data);
        } else {
          console.error("Failed to fetch header data");
        }
      } catch (err) {
        console.error("Header fetch error:", err);
      }
    };

    fetchHeaderData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/login");
  };

  return (
    <header className={styles.mainHeader}>
      <div 
        className={styles.navLeft} 
        onClick={() => navigate("/")} 
        style={{cursor: 'pointer'}}
      >
        TweetTag #
      </div>

      <div className={styles.navRight}>
        <ThemeToggle /> {/* Inserted Button Here */}
        <span className={styles.countBadge}>✅tagged: {headerData.processed_count}</span>
        <span className={styles.username}>👤 {headerData.username}</span>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}