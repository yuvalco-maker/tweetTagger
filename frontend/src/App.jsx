import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Stats from "./pages/Stats/Stats.jsx";
import QueryResults from "./pages/QueryResults/QueryResults.jsx";
import Login from "./pages/login/login.jsx";
import RegisterPage from "./pages/register/register.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage/ResetPasswordPage.jsx";
import Home from "./pages/Home/Home.jsx";
import SearchQuery from "./pages/SearchQuery/SearchQuery.jsx";
import QueryHistory from "./pages/QueryHistory/QueryHistory.jsx";
function App() {
  return (
    <Router>
      <div className="app-wraper">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/home" element={<Home />} />
          <Route path="/home-user" element={<Home />} />

          <Route path="/search-query" element={<SearchQuery />} />

          {/* */}
          <Route path="/query-results/:queryId" element={<QueryResults />} />
          <Route path="/query-history" element={<QueryHistory />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;