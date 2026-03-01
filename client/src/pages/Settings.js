// client/src/pages/Settings.js
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import LoadingState, { BlockingLoader, InlineLoading } from "../components/LoadingState";
import { withMinimumDelay } from "../utils/loading";
import "./Settings.css";

function Settings({ onLogout }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actions, setActions] = useState({
    savingUsername: false,
    loggingOut: false,
    deletingAccount: false,
  });
  const [message, setMessage] = useState("");

  const loadSettings = useCallback(async () => {
    setMessage("");
    setLoadError("");
    setLoadingSettings(true);

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    try {
      const data = await withMinimumDelay(async () => {
        const res = await fetch(API_URL + "/api/users/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error("Failed to load settings");
        }

        return res.json();
      });

      setUsername(data.username || "");
    } catch (e) {
      setLoadError(e.message || "Error loading settings.");
    } finally {
      setLoadingSettings(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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

    setActions((prev) => ({ ...prev, savingUsername: true }));
    try {
      const data = await withMinimumDelay(async () => {
        const res = await fetch(API_URL + "/api/users/username", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username: username.trim() }),
        });

        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || "Failed to update username");
        return payload;
      });

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
      setActions((prev) => ({ ...prev, savingUsername: false }));
    }
  }

  async function handleLogoutClick() {
    setActions((prev) => ({ ...prev, loggingOut: true }));
    setMessage("");

    try {
      await withMinimumDelay(async () => {
        onLogout();
      });

      navigate("/");
    } finally {
      setActions((prev) => ({ ...prev, loggingOut: false }));
    }
  }

  async function handleDeleteAccount() {
    const savedUser = localStorage.getItem("user");
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    const userId = parsedUser?.id || parsedUser?._id;

    if (!userId) {
      setMessage("Unable to identify account to delete.");
      return;
    }

    if (!window.confirm("Delete your account permanently? This cannot be undone.")) {
      return;
    }

    setMessage("");
    setActions((prev) => ({ ...prev, deletingAccount: true }));

    try {
      const token = localStorage.getItem("token");

      await withMinimumDelay(async () => {
        const res = await fetch(API_URL + `/api/users/${userId}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Failed to delete account");
        }
      });

      onLogout();
      navigate("/");
    } catch (e) {
      setMessage(e.message || "Error deleting account.");
    } finally {
      setActions((prev) => ({ ...prev, deletingAccount: false }));
    }
  }

  const isAnyBlockingAction = actions.savingUsername || actions.loggingOut || actions.deletingAccount;
  const blockingMessage = actions.deletingAccount
    ? "Deleting account..."
    : actions.loggingOut
      ? "Logging out..."
      : "Saving settings...";

  if (loadingSettings) {
    return <LoadingState message="Loading settings..." />;
  }

  if (loadError) {
    return <LoadingState message={loadError} onRetry={loadSettings} />;
  }

  return (
    <>
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
                  disabled={actions.savingUsername || actions.loggingOut}
                />
              </div>

              <button
                className="settings-btn-primary"
                onClick={handleSaveUsername}
                disabled={isAnyBlockingAction}
              >
                {actions.savingUsername ? "Saving..." : "Save Username"}
              </button>
            </div>

            {message && <div className="settings-message">{message}</div>}
            {actions.savingUsername && (
              <div className="settings-inline-loading">
                <InlineLoading message="Saving settings..." />
              </div>
            )}
          </div>
          <button
            className="settings-logout"
            onClick={handleLogoutClick}
            disabled={isAnyBlockingAction}
          >
            {actions.loggingOut ? "Logging out..." : "Log out"}
          </button>

          <button
            className="settings-delete"
            onClick={handleDeleteAccount}
            disabled={isAnyBlockingAction}
          >
            {actions.deletingAccount ? "Deleting account..." : "Delete account"}
          </button>

        </div>
      </div>

      {isAnyBlockingAction && <BlockingLoader message={blockingMessage} />}
    </>
  );
}

export default Settings;