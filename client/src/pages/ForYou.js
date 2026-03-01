// client/src/pages/ForYou.js
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SwapRequestModal from "../components/SwapRequestModal";
import LoadingState from "../components/LoadingState";
import API_URL from "../config";
import { withMinimumDelay } from "../utils/loading";
import "./Foryou.css";
import "../SwapRequestModal.css";


function ForYouPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedUser, setExpandedUser] = useState(null);
  const [selectedUserForSwap, setSelectedUserForSwap] = useState(null);
  const [blockingUserId, setBlockingUserId] = useState("");
  const navigate = useNavigate();

  const loadUsers = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const data = await withMinimumDelay(async () => {
        const res = await fetch(API_URL + "/api/for-you", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to load users");
        }

        return res.json();
      });

      setUsers(data);
    } catch (err) {
      console.error("Error loading users:", err);
      setLoadError(err.message || "Something went wrong loading users.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function toggleExpand(userId) {
    setExpandedUser(expandedUser === userId ? null : userId);
  }

  function handleSwapRequest(user) {
    setSelectedUserForSwap(user);
  }

  function handleCloseModal() {
    setSelectedUserForSwap(null);
  }

  function handleSwapSuccess(swap) {
    setMessage(`Swap request sent to ${selectedUserForSwap.name}!`);
    setSelectedUserForSwap(null);
    setTimeout(() => {
      navigate("/calendar");
    }, 2000);
  }

  async function handleBlockUser(user) {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setMessage("");
    setBlockingUserId(user._id);

    try {
      await withMinimumDelay(async () => {
        const res = await fetch(API_URL + "/api/users/blocked", {
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
    } catch (err) {
      console.error("Error blocking user:", err);
      setMessage(err.message || "Unable to block user.");
    } finally {
      setBlockingUserId("");
    }
  }

  if (loading) {
    return <LoadingState message="Loading users..." />;
  }

  if (loadError) {
    return <LoadingState message={loadError} onRetry={loadUsers} />;
  }

  return (
    <div className="for-you">
      <div className="for-you-header">
        <h1 className="for-you-title">For You</h1>
        <p className="for-you-subtitle">
          Connect with people and exchange skills
        </p>
      </div>

      {message && <p className="for-you-message">{message}</p>}

      {users.length === 0 ? (
        <div className="for-you-empty">
          <p>No other users yet. Invite your friends to join SkillSwap!</p>
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
        </div>
        <div className="user-location">
          <span className="location-icon">📍</span>
          <span className="location-text">
            {user.locationVisibility === "hidden"
              ? "Location hidden"
              : user.city || "Location not set"}
          </span>
        </div>
      </div>

      {/* Quick Preview of Skills */}
      <div className="user-card-preview">
        {skillsOffered.length > 0 && (
          <div className="skill-preview">
            <span className="skill-label">Offers:</span>
            <span className="skill-value">
              {skillsOffered.slice(0, 2).join(", ")}
              {skillsOffered.length > 2 && " ..."}
            </span>
          </div>
        )}
        {skillsWanted.length > 0 && (
          <div className="skill-preview">
            <span className="skill-label">Wants:</span>
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

      {/* Expanded Details */}
      {isExpanded && (
        <div className="user-card-details">
          {user.bio && (
            <div className="detail-section">
              <h4 className="detail-title">About</h4>
              <p className="detail-text">{user.bio}</p>
            </div>
          )}

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
              <p className="detail-text">{user.timeZone}</p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
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