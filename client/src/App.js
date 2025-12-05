// client/src/App.js
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import ForYou from "./components/ForYou";
import Browse from "./components/Browse";
import Calendar from "./components/Calendar";
import Profile from "./components/Profile";
import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!nameInput.trim() || !emailInput.trim() || !passwordInput.trim()) return;

    const newUser = {
      name: nameInput.trim(),
      email: emailInput.trim(),
      password: passwordInput.trim(),
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      const savedUser = await res.json();
      if (res.ok) {
        setIsLoggedIn(true);
      } else {
        console.error("Failed to save user:", savedUser);
      }
    } catch (err) {
      console.error("Failed to save user:", err);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="App">
        <div className="login-page">
          <h1>SkillSwap</h1>

          <form onSubmit={handleSubmit} className="form">
            <input
              placeholder="Name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <input
              placeholder="Email"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
            <input
              placeholder="Password"
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <NavBar />
        <Routes>
          <Route path="/" element={<Navigate to="/for-you" replace />} />
          <Route path="/for-you" element={<ForYou />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;