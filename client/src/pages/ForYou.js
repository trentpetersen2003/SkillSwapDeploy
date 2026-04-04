// client/src/pages/ForYou.js
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SwapRequestModal from "../components/SwapRequestModal";
import LoadingState from "../components/LoadingState";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
import { withMinimumDelay } from "../utils/loading";
import "./Foryou.css";
import "../SwapRequestModal.css";

function getStoredDismissedNotifications(userId) {
  if (!userId) {
    return [];
  }

  try {
    const stored = localStorage.getItem(`dismissedNotifications:${userId}`);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to parse dismissed notifications:", error);
    return [];
  }
}

function buildNotifications(swaps, currentUserId) {
  if (!currentUserId) {
    return [];
  }

  return swaps
    .flatMap((swap) => {
      const requesterId = swap.requester?._id;
      const recipientId = swap.recipient?._id;
      const isRequester = requesterId === currentUserId;
      const isRecipient = recipientId === currentUserId;

      if (!isRequester && !isRecipient) {
        return [];
      }

      const scheduledDate = new Date(swap.scheduledDate);
      const formattedDate = Number.isNaN(scheduledDate.getTime())
        ? "an upcoming session"
        : scheduledDate.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });

      if (isRecipient && swap.status === "pending") {
        return [{
          id: `${swap._id}:incoming-request:${swap.status}`,
          title: "Incoming swap request",
          message: `${swap.requester?.name || "Another user"} requested a swap on ${formattedDate}.`,
          timestamp: swap.scheduledDate,
          actionable: true,
          swapId: swap._id,
        }];
      }

      if (isRequester && swap.status === "confirmed") {
        return [{
          id: `${swap._id}:outgoing-accepted:${swap.status}`,
          title: "Swap request accepted",
          message: `${swap.recipient?.name || "The other user"} accepted your swap request for ${formattedDate}.`,
          timestamp: swap.scheduledDate,
          actionable: false,
        }];
      }

      if (isRequester && swap.status === "cancelled") {
        return [{
          id: `${swap._id}:outgoing-declined:${swap.status}`,
          title: "Swap request declined",
          message: `${swap.recipient?.name || "The other user"} declined or cancelled your request for ${formattedDate}.`,
          timestamp: swap.scheduledDate,
          actionable: false,
        }];
      }

      if (isRecipient && swap.status === "cancelled") {
        return [{
          id: `${swap._id}:swap-cancelled:${swap.status}`,
          title: "Swap cancelled",
          message: `${swap.requester?.name || "The other user"} cancelled a swap scheduled for ${formattedDate}.`,
          timestamp: swap.scheduledDate,
          actionable: false,
        }];
      }

      return [];
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function getReliabilityToneClass(score) {
  if (score === null || score === undefined) {
    return "reliability-pill--new";
  }
  if (score >= 85) return "reliability-pill--high";
  if (score >= 70) return "reliability-pill--good";
  if (score >= 50) return "reliability-pill--building";
  return "reliability-pill--low";
}

function getMatchToneClass(score) {
  if (score === null || score === undefined) {
    return "match-pill--unknown";
  }
  if (score >= 80) return "match-pill--excellent";
  if (score >= 65) return "match-pill--strong";
  if (score >= 45) return "match-pill--moderate";
  return "match-pill--weak";
}

function formatUserLocation(user) {
  if (user.locationVisibility === "hidden") {
    return "Location hidden";
  }

  const locationParts = [user.city, user.state].filter(Boolean);
  return locationParts.length > 0 ? locationParts.join(", ") : "Location not set";
}

function ForYouPage() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = currentUser.id || currentUser._id || "";
  const [users, setUsers] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [showSwapSuccessPopup, setShowSwapSuccessPopup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState(() =>
    getStoredDismissedNotifications(currentUserId)
  );
  const [expandedUser, setExpandedUser] = useState(null);
  const [selectedUserForSwap, setSelectedUserForSwap] = useState(null);
  const [blockingUserId, setBlockingUserId] = useState("");
  const [messageAction, setMessageAction] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setDismissedNotifications(getStoredDismissedNotifications(currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    localStorage.setItem(
      `dismissedNotifications:${currentUserId}`,
      JSON.stringify(dismissedNotifications)
    );
  }, [currentUserId, dismissedNotifications]);

  const loadPageData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const { usersData, swapsData } = await withMinimumDelay(async () => {
        const [usersRes, swapsRes] = await Promise.all([
          fetchWithAuth(API_URL + "/api/for-you", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetchWithAuth(API_URL + "/api/swaps", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (!usersRes.ok) {
          const payload = await usersRes.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to load users");
        }

        if (!swapsRes.ok) {
          const payload = await swapsRes.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to load swaps");
        }

        const [usersPayload, swapsPayload] = await Promise.all([
          usersRes.json(),
          swapsRes.json(),
        ]);

        return {
          usersData: usersPayload,
          swapsData: swapsPayload,
        };
      });

      setUsers(usersData);
      setSwaps(swapsData);
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

  const notifications = buildNotifications(swaps, currentUserId).filter(
    (notification) => !dismissedNotifications.includes(notification.id)
  );

  function toggleExpand(userId) {
    setExpandedUser(expandedUser === userId ? null : userId);
  }

  function handleSwapRequest(user) {
    setSelectedUserForSwap(user);
  }

  function handleCloseModal() {
    setSelectedUserForSwap(null);
  }

  function handleSwapSuccess() {
    setMessageAction(null);
    setSelectedUserForSwap(null);
    setShowSwapSuccessPopup(true);
  }

  function handleCloseSwapSuccessPopup() {
    setShowSwapSuccessPopup(false);
  }

  function handleGoToCalendar() {
    setShowSwapSuccessPopup(false);
    navigate("/calendar");
  }

  function handleManageBlockedUsers() {
    navigate("/settings#blocked-users");
  }

  function handleToggleNotifications() {
    setShowNotifications((prev) => !prev);
  }

  function handleDismissNotification(notificationId) {
    setDismissedNotifications((prev) =>
      prev.includes(notificationId) ? prev : [...prev, notificationId]
    );
  }

  function handleClearAllNotifications() {
    setDismissedNotifications((prev) => [
      ...new Set([...prev, ...notifications.map((notification) => notification.id)]),
    ]);
  }

  function handleNotificationClick(notification) {
    if (!notification.actionable || !notification.swapId) {
      return;
    }

    setShowNotifications(false);
    navigate("/calendar", {
      state: {
        focusSwapId: notification.swapId,
        focusView: "list",
      },
    });
  }

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
          <div className="for-you-notifications">
            <button
              type="button"
              className="for-you-notification-bell"
              onClick={handleToggleNotifications}
              aria-label="Open notifications"
              aria-expanded={showNotifications}
            >
              <span className="for-you-notification-bell__icon" aria-hidden="true">
                &#128276;
              </span>
              {notifications.length > 0 && (
                <span className="for-you-notification-badge">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showNotifications && (
        <>
          <button
            type="button"
            className="for-you-notifications-backdrop"
            onClick={handleToggleNotifications}
            aria-label="Close notifications"
          />
          <div className="for-you-notifications-menu" role="dialog" aria-label="Notifications">
            <div className="for-you-notifications-menu__header">
              <h2 className="for-you-notifications-menu__title">Notifications</h2>
              <button
                type="button"
                className="for-you-notifications-menu__close"
                onClick={handleToggleNotifications}
                aria-label="Close notifications menu"
              >
                x
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="for-you-notifications-menu__empty">
                No notifications right now.
              </p>
            ) : (
              <>
                <div className="for-you-notifications-menu__list">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`for-you-notification-item ${
                        notification.actionable
                          ? "for-you-notification-item--actionable"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="for-you-notification-item__content"
                        onClick={() => handleNotificationClick(notification)}
                        disabled={!notification.actionable}
                        aria-label={
                          notification.actionable
                            ? `Open ${notification.title}`
                            : undefined
                        }
                      >
                        <p className="for-you-notification-item__title">
                          {notification.title}
                        </p>
                        <p className="for-you-notification-item__message">
                          {notification.message}
                        </p>
                        {notification.actionable && (
                          <span className="for-you-notification-item__hint">
                            View on Calendar
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="for-you-notification-item__dismiss"
                        onClick={() => handleDismissNotification(notification.id)}
                        aria-label={`Dismiss ${notification.title}`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
                <div className="for-you-notifications-menu__footer">
                  <button
                    type="button"
                    className="for-you-notifications-menu__clear"
                    onClick={handleClearAllNotifications}
                  >
                    Clear All
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

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
            x
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
