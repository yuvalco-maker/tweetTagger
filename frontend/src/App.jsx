import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import EscalatedTweetsPage from "./pages/EscalatedTweetsPage/EscalatedTweetsPage";
import Login from "./pages/login/login";
import Register from "./pages/register/register";
import Home from "./pages/home/Home";
import HomeUser from "./pages/home/HomeUser";
import AdminTaggingDistributionPage from "./pages/AdminTaggingDistributionPage/AdminTaggingDistributionPage";
import TweetsPage from "./pages/tweets/TweetsPage";
import TaggedTweetsPage from "./pages/TaggedTweetsPage/TaggedTweetsPage"; 
import EscalationTagPage from "./pages/EscalationTagPage/EscalationTagPage";
import TaggingLeaderboardPage from "./pages/TaggingLeaderboardPage/TaggingLeaderboardPage"
import MyTaggedTweetsPage from "./pages/MyTaggedTweetsPage/MyTaggedTweetsPage"
import EditTweetPage from "./pages/EditTweetPage/EditTweetPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage/ResetPasswordPage.jsx";
import "./index.css";
import AdminDailyTaggingStatsPage from "./pages/AdminDailyTaggingStatsPage/AdminDailyTaggingStatsPage";
import UserImpactPage from "./pages/UserImpactPage/UserImpactPage";
import AdminUserInsightsPage from "./pages/AdminUserInsightsPage/AdminUserInsightsPage";
function App() {
  return (
    <Router>
      <div className="app-wraper">
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />

          <Route path="/login" element={<Login />} />
          <Route path="/Register" element={<Register />} />

          {}
          <Route path="/home" element={<Home />} />

          {}
          <Route path="/tweets" element={<TweetsPage />} />

          {}
          <Route path="/tagged-tweets" element={<TaggedTweetsPage />} />

          {}
          <Route path="*" element={<Navigate to="/login" />} />
          <Route path="/escalation" element={<EscalatedTweetsPage />} />
          <Route path="/escalation-tag" element={<EscalationTagPage />} />
           <Route path="/table" element={<TaggingLeaderboardPage />} />
            <Route path="/tags" element={<MyTaggedTweetsPage/>} />
            <Route path="/edit-tweet" element={<EditTweetPage />} />
                          <Route path="/home-user" element={<HomeUser />} />
                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                            <Route path="/reset-password" element={<ResetPasswordPage />} />
                            <Route path="/admin-daily-stats" element={<AdminDailyTaggingStatsPage />} />
                            <Route path="/admin-tagging-distribution" element={<AdminTaggingDistributionPage />} />
                            <Route path="/my-impact" element={<UserImpactPage />} />
                            <Route path="/admin-user-insights" element={<AdminUserInsightsPage />} />


            
    
        </Routes>
      </div>
    </Router>
  );
}

export default App;