import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SwapRequestModal from "../components/SwapRequestModal";
import LoadingState from "../components/LoadingState";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
import { withMinimumDelay } from "../utils/loading";
import { formatTimeZoneLabel } from "../utils/timeZone";
import "./Foryou.css";
import "../SwapRequestModal.css";

// Get reliability tone class data.
function getReliabilityToneClass(score) {
  if (score === null || score === undefined) {
    return "reliability-pill--new";
  }
  if (score >= 85) return "reliability-pill--high";
  if (score >= 70) return "reliability-pill--good";
  if (score >= 50) return "reliability-pill--building";
  return "reliability-pill--low";
}

// Get match tone class data.
function getMatchToneClass(score) {
  if (score === null || score === undefined) {
    return "match-pill--unknown";
  }
  if (score >= 80) return "match-pill--excellent";
  if (score >= 65) return "match-pill--strong";
  if (score >= 45) return "match-pill--moderate";
  return "match-pill--weak";
}

// Run format user location logic.
function formatUserLocation(user) {
  if (user.locationVisibility === "hidden") {
    return "Location hidden";
  }

  const locationParts = [user.city, user.state].filter(Boolean);
  return locationParts.length > 0 ? locationParts.join(", ") : "Location not set";
}

// Run for you page logic.
function ForYouPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [showSwapSuccessPopup, setShowSwapSuccessPopup] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [selectedUserForSwap, setSelectedUserForSwap] = useState(null);
  const [blockingUserId, setBlockingUserId] = useState("");
  const [messageAction, setMessageAction] = useState(null);
  const navigate = useNavigate();

  const loadPageData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const usersData = await withMinimumDelay(async () => {
        const usersRes = await fetchWithAuth(API_URL + "/api/for-you", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!usersRes.ok) {
          const payload = await usersRes.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to load users");
        }

        return usersRes.json();
      });

      setUsers(usersData);
    } catch (err) {
      console.error("Error loading page data:", err);
      setLoadError(err.message || "Something went wrong loading page data.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  // Run toggle expand logic.
  function toggleExpand(userId) {
    setExpandedUser(expandedUser === userId ? null : userId);
  }

  // Handle swap request action.
  function handleSwapRequest(user) {
    setSelectedUserForSwap(user);
  }

  // Handle close modal action.
  function handleCloseModal() {
    setSelectedUserForSwap(null);
  }

  // Handle swap success action.
  function handleSwapSuccess() {
    setMessageAction(null);
    setSelectedUserForSwap(null);
    setShowSwapSuccessPopup(true);
  }

  // Handle close swap success popup action.
  function handleCloseSwapSuccessPopup() {
    setShowSwapSuccessPopup(false);
  }

  // Handle go to calendar action.
  function handleGoToCalendar() {
    setShowSwapSuccessPopup(false);
    navigate("/calendar");
  }

  // Handle manage blocked users action.
  function handleManageBlockedUsers() {
    navigate("/settings#blocked-users");
  }

  // Handle block user action.
  async function handleBlockUser(user) {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setMessage("");
    setMessageAction(null);
    setShowSwapSuccessPopup(false);
    setBlockingUserId(user._id);

    try {
      await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + "/api/users/blocked", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUserId: user._id }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.message || "Failed to block user");
        }
      });

      setUsers((prev) => prev.filter((existingUser) => existingUser._id !== user._id));
      setExpandedUser((prev) => (prev === user._id ? null : prev));
      setMessage(`Blocked @${user.username || "user"}.`);
      setMessageAction({
        type: "undo",
        label: "Undo block",
        userId: user._id,
        username: user.username || "user",
      });
    } catch (err) {
      console.error("Error blocking user:", err);
      setMessage(err.message || "Unable to block user.");
      if (/already blocked|blocked user/i.test(err.message || "")) {
        setMessageAction({
          type: "manage",
          label: "Manage blocked users",
        });
      }
    } finally {
      setBlockingUserId("");
    }
  }

  // Handle undo block action.
  async function handleUndoBlock() {
    const token = localStorage.getItem("token");
    if (!token || !messageAction?.userId) {
      return;
    }

    try {
      const res = await fetchWithAuth(
        `${API_URL}/api/users/blocked/${messageAction.userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to unblock user");
      }

      setMessage(`Unblocked @${messageAction.username}.`);
      setMessageAction({
        type: "manage",
        label: "Manage blocked users",
      });
      loadPageData();
    } catch (err) {
      console.error("Error unblocking user:", err);
      setMessage(err.message || "Unable to unblock user.");
      setMessageAction({
        type: "manage",
        label: "Manage blocked users",
      });
    }
  }

  if (loading) {
    return <LoadingState message="Loading users..." />;
  }

  if (loadError) {
    return <LoadingState message={loadError} onRetry={loadPageData} />;
  }

  return (
    <div className="for-you">
      <div className="for-you-header">
        <div className="for-you-header-row">
          <div>
            <h1 className="for-you-title">For You</h1>
            <p className="for-you-subtitle">
              Connect with people and exchange skills
            </p>
          </div>
        </div>
      </div>

      {showSwapSuccessPopup && (
        <div
          className="swap-success-popup"
          role="alertdialog"
          aria-labelledby="swap-success-title"
          aria-describedby="swap-success-description"
        >
          <button
            type="button"
            className="swap-success-popup__close"
            onClick={handleCloseSwapSuccessPopup}
            aria-label="Close notification"
          >
            ×
          </button>
          <p id="swap-success-title" className="swap-success-popup__title">
            Swap Request Sent
          </p>
          <p
            id="swap-success-description"
            className="swap-success-popup__description"
          >
            Your request has been sent successfully.
          </p>
          <button
            type="button"
            className="swap-success-popup__action"
            onClick={handleGoToCalendar}
          >
            Go to Calendar
          </button>
        </div>
      )}

      {message && (
        <p className="for-you-message">
          <span>{message}</span>
          {messageAction && (
            <button
              type="button"
              className="for-you-message-action"
              onClick={messageAction.type === "undo" ? handleUndoBlock : handleManageBlockedUsers}
            >
              {messageAction.label}
            </button>
          )}
        </p>
      )}

      {users.length === 0 ? (
        <div className="for-you-empty">
          <p>No ready-to-schedule matches yet. Try broadening your availability or check back later.</p>
        </div>
      ) : (
        <div className="for-you-grid">
          {users.map((user) => (
            <UserCard
              key={user._id}
              user={user}
              isExpanded={expandedUser === user._id}
              onToggleExpand={() => toggleExpand(user._id)}
              onRequestSwap={() => handleSwapRequest(user)}
              onBlockUser={() => handleBlockUser(user)}
              isBlocking={blockingUserId === user._id}
              disableActions={Boolean(blockingUserId)}
            />
          ))}
        </div>
      )}

      {selectedUserForSwap && (
        <SwapRequestModal
          user={selectedUserForSwap}
          onClose={handleCloseModal}
          onSuccess={handleSwapSuccess}
        />
      )}
    </div>
  );
}

// Run user card logic.
function UserCard({ user, isExpanded, onToggleExpand, onRequestSwap, onBlockUser, isBlocking, disableActions }) {
  const skillsOffered =
    user.skills && user.skills.length > 0
      ? user.skills.map((s) => s.skillName || s).filter(Boolean)
      : [];

  const skillsWanted =
    user.skillsWanted && user.skillsWanted.length > 0
      ? user.skillsWanted.map((s) => s.skillName || s).filter(Boolean)
      : [];

  const hasSkills = skillsOffered.length > 0 || skillsWanted.length > 0;

  return (
    <div className="user-card">
      <div className="user-card-header">
        <div className="user-info">
          <h3 className="user-name">{user.name}</h3>
          <p className="user-username">@{user.username}</p>
          <div className={`reliability-pill ${getReliabilityToneClass(user.reliability?.score)}`}>
            <strong>{user.reliability?.tier || "New"}</strong>
            <span>
              {user.reliability?.score === null || user.reliability?.score === undefined
                ? "No completed swaps yet"
                : `Score ${user.reliability.score} • ${user.reliability.completedSwaps}/${user.reliability.totalSwaps} completed`}
            </span>
            {user.reliability?.averageRating ? (
              <span>{`Avg rating ${user.reliability.averageRating}/5 (${user.reliability.ratingsReceivedCount})`}</span>
            ) : null}
          </div>
          <div className={`match-pill ${getMatchToneClass(user.matchScore)}`}>
            <strong>
              {user.matchScore === null || user.matchScore === undefined
                ? "Match pending"
                : `Match ${user.matchScore}%`}
            </strong>
            {Array.isArray(user.matchReasons) && user.matchReasons.length > 0 ? (
              <span>{user.matchReasons[0]}</span>
            ) : (
              <span>Complete profile details to improve matching</span>
            )}
          </div>
        </div>
        <div className="user-location">
          <span className="location-icon">📍</span>
          <span className="location-text">
            {formatUserLocation(user)}
          </span>
        </div>
      </div>

      <div className="user-card-preview">
        {skillsOffered.length > 0 && (
          <div className="skill-preview">
            <span className="skill-label">Offers:</span>{" "}
            <span className="skill-value">
              {skillsOffered.slice(0, 2).join(", ")}
              {skillsOffered.length > 2 && " ..."}
            </span>
          </div>
        )}
        {skillsWanted.length > 0 && (
          <div className="skill-preview">
            <span className="skill-label">Wants:</span>{" "}
            <span className="skill-value">
              {skillsWanted.slice(0, 2).join(", ")}
              {skillsWanted.length > 2 && " ..."}
            </span>
          </div>
        )}
        {!hasSkills && (
          <p className="no-skills">No skills listed yet</p>
        )}
      </div>

      {isExpanded && (
        <div className="user-card-details">
          {skillsOffered.length > 0 && (
            <div className="detail-section">
              <h4 className="detail-title">Skills Offered</h4>
              <div className="skill-tags">
                {skillsOffered.map((skill, idx) => (
                  <span key={idx} className="skill-tag skill-offered">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {skillsWanted.length > 0 && (
            <div className="detail-section">
              <h4 className="detail-title">Skills Wanted</h4>
              <div className="skill-tags">
                {skillsWanted.map((skill, idx) => (
                  <span key={idx} className="skill-tag skill-wanted">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {user.availability && (
            <div className="detail-section">
              <h4 className="detail-title">Availability</h4>
              <p className="detail-text">
                {Array.isArray(user.availability)
                  ? user.availability
                      .map((slot) => `${slot.day}: ${slot.timeRange}`)
                      .join(", ")
                  : user.availability}
              </p>
            </div>
          )}

          {user.timeZone && (
            <div className="detail-section">
              <h4 className="detail-title">Time Zone</h4>
              <p className="detail-text">{formatTimeZoneLabel(user.timeZone)}</p>
            </div>
          )}
        </div>
      )}

      <div className="user-card-actions">
        <button
          className="btn-secondary"
          onClick={onToggleExpand}
          disabled={disableActions}
        >
          {isExpanded ? "Show Less" : "View Details"}
        </button>
        <button
          className="btn-primary"
          onClick={onRequestSwap}
          disabled={disableActions}
        >
          Request Swap
        </button>
        <button
          className="btn-secondary"
          onClick={onBlockUser}
          disabled={disableActions}
        >
          {isBlocking ? "Blocking..." : "Block User"}
        </button>
      </div>
    </div>
  );
}

export default ForYouPage;