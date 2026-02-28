// client/src/pages/Settings.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import "./Settings.css";

function Settings({ onLogout }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Load current username from profile
  useEffect(() => {
    async function load() {
      setMessage("");
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/");
        return;
      }

      try {
        const res = await fetch(API_URL + "/api/users/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        setUsername(data.username || "");
      } catch (e) {
        setMessage("Error loading settings.");
      }
    }

    load();
  }, [navigate]);

  async function handleSaveUsername(e) {
    e.preventDefault();
    setMessage("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    if (!username.trim()) {
      setMessage("Username is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(API_URL + "/api/users/username", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update username");

      // Keep localStorage user in sync if you store it
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        localStorage.setItem("user", JSON.stringify({ ...parsed, username: data.username || username.trim() }));
      }

      setMessage("Username updated.");
    } catch (e) {
      setMessage(e.message || "Error updating username.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogoutClick() {
    onLogout();
    navigate("/");
  }

  return (
 <div className="settings-page">
  <h1 className="settings-title">Settings</h1>
   <p className="settings-subtitle">Manage your account</p>
  <div className="settings-card">
    <div className="settings-section">
      <h3>Account</h3>

      <div className="settings-row">
        <div className="settings-field">
          <div className="settings-label">Username</div>
          <input
            className="settings-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <button
          className="settings-btn-primary"
          onClick={handleSaveUsername}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Username"}
        </button>
      </div>

      {message && <div className="settings-message">{message}</div>}
    </div>
     <button className="settings-logout" onClick={handleLogoutClick}>
        Log out
        </button>


    {/* Later: Account deletion can go here */}
  </div>
</div>
);
}

export default Settings;