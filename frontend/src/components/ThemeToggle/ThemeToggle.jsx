import React, { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('user-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    document.body.style.colorScheme = theme;
    localStorage.setItem('user-theme', theme);
  }, [isDark]);

  return (
    <button 
      className={styles.toggleBtn} 
      onClick={() => setIsDark(!isDark)}
      type="button"
    >
      {isDark ? '☀️ Day' : '🌙 Night'}
    </button>
  );
}