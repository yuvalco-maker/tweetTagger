import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from './pages/login/login.jsx'

function App() {
  return (
    <Router>
      <div className="app-wraper">
        <Routes>
          {/* This line forces the app to go to /login when you open the site */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          <Route path="/login" element={<Login />} />
          
          {/* Add these as placeholders so navigate() doesn't crash on success */}
          <Route path="/home" element={<div>Admin Home</div>} />
          <Route path="/home-user" element={<div>User Home</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;