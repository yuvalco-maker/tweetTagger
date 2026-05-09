import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Header from "./components/Header/Header.jsx";
import Login from "./pages/login/login.jsx";
import RegisterPage from "./pages/register/register.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage/ResetPasswordPage.jsx";
import Home from "./pages/Home/Home.jsx";
import SearchQuery from "./pages/SearchQuery/SearchQuery.jsx";
import ThreatThemes from "./pages/ThreatThemes/ThreatThemes.jsx";
import QueryResults from "./pages/QueryResults/QueryResults.jsx";
import QueryHistory from "./pages/QueryHistory/QueryHistory.jsx";
import Stats from "./pages/Stats/Stats.jsx";
import TweetDetail from "./pages/TweetDetail/TweetDetail.jsx";
import AISummaryPage from "./pages/AISummaryPage/AISummaryPage.jsx";
import SmartQuerySuggestions from "./pages/SmartQuerySuggestions/SmartQuerySuggestions";
function AppLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth pages — no header */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected pages — header included */}
        <Route element={<AppLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/home-user" element={<Home />} />
          <Route path="/search-query" element={<SearchQuery />} />
          <Route path="/query-results/:queryId" element={<QueryResults />} />
          <Route path="/query-history" element={<QueryHistory />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/tweet-detail/:tweetId" element={<TweetDetail />} />
          <Route path="/ai-summary/:queryId" element={<AISummaryPage />} />
          <Route path="/smart-query-suggestions" element={<SmartQuerySuggestions />} />
          <Route path="/threat-themes" element={<ThreatThemes />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
