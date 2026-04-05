// client/src/pages/Settings.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
import LoadingState, { BlockingLoader, InlineLoading } from "../components/LoadingState";
import { withMinimumDelay } from "../utils/loading";
import "./Settings.css";

// Run settings logic.
function Settings({ onLogout, setupRequired = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
  const blockedSectionRef = useRef(null);
  const googleConnectButtonRef = useRef(null);
  const [username, setUsername] = useState("");
  const [locationVisibility, setLocationVisibility] = useState("visible");
  const [showOthersLocations, setShowOthersLocations] = useState(true);
  const [notificationPreferences, setNotificationPreferences] = useState({
    swapRequestEmail: true,
    swapConfirmedEmail: true,
    swapCancelledEmail: true,
    profileReminderEmail: true,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actions, setActions] = useState({
    savingUsername: false,
    savingVisibility: false,
    savingNotifications: false,
    changingPassword: false,
    connectingGoogleAccount: false,
    linkingGoogleAccount: false,
    unblockingUserId: "",
    loggingOut: false,
    deletingAccount: false,
  });
  const [message, setMessage] = useState("");
  const [showGoogleConnectButton, setShowGoogleConnectButton] = useState(false);
  const messageTimeoutRef = useRef(null);

  // Show a temporary status banner message.
  const showMessage = useCallback((text) => {
    // Clear any existing timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    
    // Show the message
    setMessage(text);
    
    // Auto-dismiss after 4 seconds
    messageTimeoutRef.current = setTimeout(() => {
      setMessage("");
    }, 4000);
  }, []);

  // Load account and privacy settings for the current user.
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
      const { profileData, blockedData } = await withMinimumDelay(async () => {
        const [profileRes, blockedRes] = await Promise.all([
          fetchWithAuth(API_URL + "/api/users/profile", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetchWithAuth(API_URL + "/api/users/blocked", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!profileRes.ok) {
          throw new Error("Failed to load settings");
        }

        if (!blockedRes.ok) {
          const payload = await blockedRes.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to load blocked users");
        }

        const [profilePayload, blockedPayload] = await Promise.all([
          profileRes.json(),
          blockedRes.json(),
        ]);

        return {
          profileData: profilePayload,
          blockedData: blockedPayload,
        };
      });

      setUsername(profileData.username || "");
      setLocationVisibility(profileData.locationVisibility || "visible");
      setShowOthersLocations(profileData.showOthersLocations !== false);
      setNotificationPreferences({
        swapRequestEmail: profileData.notificationPreferences?.swapRequestEmail ?? true,
        swapConfirmedEmail: profileData.notificationPreferences?.swapConfirmedEmail ?? true,
        swapCancelledEmail: profileData.notificationPreferences?.swapCancelledEmail ?? true,
        profileReminderEmail: profileData.notificationPreferences?.profileReminderEmail ?? true,
      });
      setBlockedUsers(Array.isArray(blockedData) ? blockedData : []);
    } catch (e) {
      setLoadError(e.message || "Error loading settings.");
    } finally {
      setLoadingSettings(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Scroll directly to blocked users when arriving with an anchor.
  useEffect(() => {
    if (location.hash !== "#blocked-users") {
      return;
    }

    blockedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, loadingSettings]);

  // Save username updates and keep local session data in sync.
  async function handleSaveUsername(e) {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    if (!username.trim()) {
      showMessage("Username is required.");
      return;
    }

    setActions((prev) => ({ ...prev, savingUsername: true }));
    try {
      const data = await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + "/api/users/username", {
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

      showMessage("Username updated.");
    } catch (e) {
      showMessage(e.message || "Error updating username.");
    } finally {
      setActions((prev) => ({ ...prev, savingUsername: false }));
    }
  }

  // End the current session and return to the login screen.
  async function handleLogoutClick() {
    setActions((prev) => ({ ...prev, loggingOut: true }));

    try {
      await withMinimumDelay(async () => {
        await onLogout();
      });

      navigate("/");
    } finally {
      setActions((prev) => ({ ...prev, loggingOut: false }));
    }
  }

  // Save privacy visibility controls for location display.
  async function handleSaveLocationVisibility() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setActions((prev) => ({ ...prev, savingVisibility: true }));
    try {
      await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + "/api/users/location-visibility", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ locationVisibility, showOthersLocations }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.message || "Failed to update location visibility");
        }
      });

      showMessage("Location privacy settings updated.");
    } catch (e) {
      showMessage(e.message || "Error updating location privacy settings.");
    } finally {
      setActions((prev) => ({ ...prev, savingVisibility: false }));
    }
  }

  // Remove a blocked user relationship.
  async function handleUnblockUser(blockedUserId) {

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setActions((prev) => ({
      ...prev,
      unblockingUserId: blockedUserId,
    }));

    try {
      await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + `/api/users/blocked/${blockedUserId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.message || "Failed to unblock user");
        }
      });

      setBlockedUsers((prev) => prev.filter((user) => user._id !== blockedUserId));
      showMessage("User unblocked.");
    } catch (e) {
      showMessage(e.message || "Error unblocking user.");
    } finally {
      setActions((prev) => ({ ...prev, unblockingUserId: "" }));
    }
  }

  // Persist notification preference changes.
  async function handleSaveNotificationPreferences() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setActions((prev) => ({ ...prev, savingNotifications: true }));

    try {
      await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + "/api/users/notifications", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notificationPreferences }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.message || "Failed to update notification preferences");
        }
      });

      showMessage("Notification preferences updated.");
    } catch (e) {
      showMessage(e.message || "Error updating notification preferences.");
    } finally {
      setActions((prev) => ({ ...prev, savingNotifications: false }));
    }
  }

  // Load the Google Identity script if needed.
  async function ensureGoogleIdentityScript() {
    if (window.google?.accounts?.id) {
      return;
    }

    await new Promise((resolve, reject) => {
      const existingScript = document.getElementById("google-identity-services");
      if (existingScript) {
        // Run check ready logic.
        const checkReady = () => {
          if (window.google?.accounts?.id) {
            resolve();
            return;
          }

          window.setTimeout(checkReady, 100);
        };

        checkReady();
        return;
      }

      const script = document.createElement("script");
      script.id = "google-identity-services";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load Google sign-in script."));
      document.body.appendChild(script);
    });
  }

  // Connect the current SkillSwap account to Google using the existing OAuth endpoint.
  async function handleConnectGoogleAccount() {
    if (!googleClientId) {
      showMessage("Google OAuth is not configured for this client.");
      return;
    }

    setActions((prev) => ({ ...prev, connectingGoogleAccount: true }));
    setShowGoogleConnectButton(true);

    try {
      await ensureGoogleIdentityScript();

      if (!window.google?.accounts?.id) {
        throw new Error("Google sign-in is not available right now.");
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response?.credential) {
            return;
          }

          setActions((prev) => ({ ...prev, linkingGoogleAccount: true }));
          try {
            const apiResponse = await fetch(API_URL + "/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: response.credential }),
            });
            const payload = await apiResponse.json().catch(() => ({}));

            if (!apiResponse.ok) {
              throw new Error(payload.message || "Failed to connect Google account");
            }

            const existingUser = JSON.parse(localStorage.getItem("user") || "{}");
            const existingUserId = existingUser.id || existingUser._id || "";
            const linkedUserId = payload?.user?.id || payload?.user?._id || "";

            if (existingUserId && linkedUserId && existingUserId !== linkedUserId) {
              throw new Error("This Google account belongs to a different SkillSwap account.");
            }

            if (payload.token && payload.user) {
              localStorage.setItem("token", payload.token);
              localStorage.setItem("user", JSON.stringify(payload.user));
              setUsername(payload.user.username || username);
            }

            showMessage("Google account connected.");
          } catch (error) {
            showMessage(error.message || "Unable to connect Google account.");
          } finally {
            setActions((prev) => ({ ...prev, linkingGoogleAccount: false }));
          }
        },
      });

      if (googleConnectButtonRef.current) {
        googleConnectButtonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleConnectButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 320,
        });
      }

      showMessage("Use the Google button below to finish connecting your account.");
    } catch (error) {
      showMessage(error.message || "Unable to prepare Google account connection.");
    } finally {
      setActions((prev) => ({ ...prev, connectingGoogleAccount: false }));
    }
  }

  // Update the account password after basic client-side validation.
  async function handleChangePassword() {

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showMessage("Please complete all password fields.");
      return;
    }

    setActions((prev) => ({ ...prev, changingPassword: true }));

    try {
      await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + "/api/users/password", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(passwordForm),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.message || "Failed to update password");
        }
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      showMessage("Password updated.");
    } catch (e) {
      showMessage(e.message || "Error updating password.");
    } finally {
      setActions((prev) => ({ ...prev, changingPassword: false }));
    }
  }

  // Permanently delete the signed-in account after username confirmation.
  async function handleDeleteAccount() {
    const savedUser = localStorage.getItem("user");
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    const userId = parsedUser?.id || parsedUser?._id;

    if (!userId) {
      showMessage("Unable to identify account to delete.");
      return;
    }

    if (deleteConfirmation.trim() !== username.trim()) {
      showMessage("Type your username exactly to confirm account deletion.");
      return;
    }
    setActions((prev) => ({ ...prev, deletingAccount: true }));

    try {
      const token = localStorage.getItem("token");

      await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + `/api/users/${userId}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Failed to delete account");
        }
      });

      await onLogout();
      navigate("/");
    } catch (e) {
      showMessage(e.message || "Error deleting account.");
    } finally {
      setActions((prev) => ({ ...prev, deletingAccount: false }));
    }
  }

  const isAnyBlockingAction =
    actions.savingUsername ||
    actions.savingVisibility ||
    actions.savingNotifications ||
    actions.connectingGoogleAccount ||
    actions.linkingGoogleAccount ||
    actions.changingPassword ||
    actions.loggingOut ||
    actions.deletingAccount ||
    Boolean(actions.unblockingUserId);
  const blockingMessage = actions.deletingAccount
    ? "Deleting account..."
    : actions.loggingOut
      ? "Logging out..."
      : actions.unblockingUserId
        ? "Updating blocked users..."
        : actions.linkingGoogleAccount
          ? "Connecting Google account..."
          : actions.connectingGoogleAccount
            ? "Preparing Google connection..."
        : actions.changingPassword
          ? "Updating password..."
      : "Saving settings...";

  if (loadingSettings) {
    return <LoadingState message="Loading settings..." />;
  }

  if (loadError) {
    return <LoadingState message={loadError} onRetry={loadSettings} />;
  }

  return (
    <>
      {message && (
        <div className="settings-banner">
          {message}
        </div>
      )}
      <div className="settings-page">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Manage your account</p>
        <div className="settings-card">
          {setupRequired && (
            <div className="settings-section settings-section--setup">
              <h3>Finish Profile Setup</h3>
              <p className="settings-muted">
                Your account still needs profile details before swaps, chat, and calendar unlock.
              </p>
              <button
                className="settings-btn-primary"
                onClick={() => navigate("/profile?setup=1")}
                disabled={isAnyBlockingAction}
              >
                Open Profile Setup
              </button>
            </div>
          )}

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

            {actions.savingUsername && (
              <div className="settings-inline-loading">
                <InlineLoading message="Saving settings..." />
              </div>
            )}
          </div>

          <div className="settings-section" id="blocked-users" ref={blockedSectionRef}>
            <h3>Privacy &amp; Safety</h3>

            <div className="settings-row">
              <div className="settings-field">
                <div className="settings-label">Your location shown to others</div>
                <select
                  className="settings-input"
                  value={locationVisibility}
                  onChange={(e) => setLocationVisibility(e.target.value)}
                  disabled={isAnyBlockingAction}
                >
                  <option value="visible">Visible in Browse and For You</option>
                  <option value="hidden">Hidden in Browse and For You</option>
                </select>
              </div>

              <div className="settings-field">
                <div className="settings-label">See other users' locations</div>
                <select
                  className="settings-input"
                  value={showOthersLocations ? "visible" : "hidden"}
                  onChange={(e) => setShowOthersLocations(e.target.value === "visible")}
                  disabled={isAnyBlockingAction}
                >
                  <option value="visible">Show locations in Browse and For You</option>
                  <option value="hidden">Hide locations in Browse and For You</option>
                </select>
              </div>

              <button
                className="settings-btn-primary"
                onClick={handleSaveLocationVisibility}
                disabled={isAnyBlockingAction}
              >
                {actions.savingVisibility ? "Saving..." : "Save Privacy"}
              </button>
            </div>

            <div className="settings-blocked-list">
              <div className="settings-label">Blocked users</div>
              {blockedUsers.length === 0 ? (
                <div className="settings-muted">No blocked users.</div>
              ) : (
                blockedUsers.map((blockedUser) => (
                  <div key={blockedUser._id} className="settings-blocked-item">
                    <div className="settings-blocked-user">
                      {blockedUser.name || "Unnamed User"} (@{blockedUser.username || "unknown"})
                    </div>
                    <button
                      className="settings-logout"
                      onClick={() => handleUnblockUser(blockedUser._id)}
                      disabled={isAnyBlockingAction}
                    >
                      {actions.unblockingUserId === blockedUser._id ? "Unblocking..." : "Unblock"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="settings-section">
            <h3>Connected Accounts</h3>
            <button
              className="settings-btn-primary"
              onClick={handleConnectGoogleAccount}
              disabled={isAnyBlockingAction}
            >
              {actions.connectingGoogleAccount ? "Preparing..." : "Connect Google Account"}
            </button>
            {showGoogleConnectButton && (
              <div className="settings-inline-loading">
                <div ref={googleConnectButtonRef} />
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>Notifications</h3>

            <div className="settings-checkbox-list">
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={notificationPreferences.swapRequestEmail}
                  onChange={(e) => setNotificationPreferences((prev) => ({
                    ...prev,
                    swapRequestEmail: e.target.checked,
                  }))}
                  disabled={isAnyBlockingAction}
                />
                <span>Email me for new swap requests</span>
              </label>

              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={notificationPreferences.swapConfirmedEmail}
                  onChange={(e) => setNotificationPreferences((prev) => ({
                    ...prev,
                    swapConfirmedEmail: e.target.checked,
                  }))}
                  disabled={isAnyBlockingAction}
                />
                <span>Email me when swaps are confirmed</span>
              </label>

              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={notificationPreferences.swapCancelledEmail}
                  onChange={(e) => setNotificationPreferences((prev) => ({
                    ...prev,
                    swapCancelledEmail: e.target.checked,
                  }))}
                  disabled={isAnyBlockingAction}
                />
                <span>Email me when swaps are cancelled</span>
              </label>

              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={notificationPreferences.profileReminderEmail}
                  onChange={(e) => setNotificationPreferences((prev) => ({
                    ...prev,
                    profileReminderEmail: e.target.checked,
                  }))}
                  disabled={isAnyBlockingAction}
                />
                <span>Email me profile completion reminders</span>
              </label>
            </div>

            <button
              className="settings-btn-primary"
              onClick={handleSaveNotificationPreferences}
              disabled={isAnyBlockingAction}
            >
              {actions.savingNotifications ? "Saving..." : "Save Notifications"}
            </button>
          </div>

          <div className="settings-section">
            <h3>Security</h3>

            <div className="settings-password-grid">
              <input
                className="settings-input"
                type="password"
                placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                disabled={isAnyBlockingAction}
              />
              <input
                className="settings-input"
                type="password"
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                disabled={isAnyBlockingAction}
              />
              <input
                className="settings-input"
                type="password"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                disabled={isAnyBlockingAction}
              />
            </div>

            <button
              className="settings-btn-primary"
              onClick={handleChangePassword}
              disabled={isAnyBlockingAction}
            >
              {actions.changingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>

          <div className="settings-section">
            <h3>Danger Zone</h3>
            <p className="settings-muted">Type your username to confirm account deletion.</p>
            <div className="settings-row">
              <div className="settings-field">
                <div className="settings-label">Confirm username</div>
                <input
                  className="settings-input"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  disabled={isAnyBlockingAction}
                  placeholder={username || "username"}
                />
              </div>
            </div>
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
            disabled={isAnyBlockingAction || deleteConfirmation.trim() !== username.trim()}
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
