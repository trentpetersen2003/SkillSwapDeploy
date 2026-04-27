import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
import { formatTimeZoneLabel } from "../utils/timeZone";
import "./NavBar.css";

const UNREAD_POLLING_INTERVAL_MS = 10000;
const MUTED_CONVERSATIONS_STORAGE_KEY = "chat-muted-conversations";

const TIME_ZONE_ABBREVIATION_OFFSETS = {
  UTC: 0,
  GMT: 0,
  EST: -5 * 60,
  EDT: -4 * 60,
  CST: -6 * 60,
  CDT: -5 * 60,
  MST: -7 * 60,
  MDT: -6 * 60,
  PST: -8 * 60,
  PDT: -7 * 60,
  AKST: -9 * 60,
  AKDT: -8 * 60,
  HST: -10 * 60,
};

// Parse timezone text into offset minutes.
function parseUtcOffsetToMinutes(timeZone) {
  if (typeof timeZone !== "string") return null;

  const normalized = timeZone.trim().toUpperCase();

  if (Object.prototype.hasOwnProperty.call(TIME_ZONE_ABBREVIATION_OFFSETS, normalized)) {
    return TIME_ZONE_ABBREVIATION_OFFSETS[normalized];
  }

  const match = normalized.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || "0");

  if (hours > 14 || minutes > 59) return null;

  return sign * (hours * 60 + minutes);
}

// Format a notification timestamp using the chosen timezone.
function formatNotificationTimestamp(dateValue, timeZone) {
  const offsetMinutes = parseUtcOffsetToMinutes(timeZone);
  const date = new Date(dateValue);

  if (offsetMinutes === null || Number.isNaN(date.getTime())) {
    return Number.isNaN(date.getTime())
      ? "an upcoming session"
      : date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
  }

  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const label = formatTimeZoneLabel(timeZone);

  return `${shifted.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })}${label ? ` (${label})` : ""}`;
}

// Get stored dismissed notifications data.
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

// Build notifications payload.
function buildNotifications(swaps, currentUserId, timeZone = "") {
  if (!currentUserId) {
    return [];
  }

  return swaps
    .flatMap((swap) => {
      const requesterId = swap.requester?._id || swap.requester;
      const recipientId = swap.recipient?._id || swap.recipient;
      const isRequester = String(requesterId) === String(currentUserId);
      const isRecipient = String(recipientId) === String(currentUserId);

      if (!isRequester && !isRecipient) {
        return [];
      }

      const formattedDate = formatNotificationTimestamp(swap.scheduledDate, timeZone);

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

// Run nav bar logic.
function NavBar({
  isProfileComplete = true,
  onRequireProfileSetup,
  onBeforeNavigate,
}) {
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    []
  );
  const currentUserId = String(currentUser.id || currentUser._id || "");
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [swaps, setSwaps] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState(() =>
    getStoredDismissedNotifications(currentUserId)
  );
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => localStorage.getItem("token"), []);

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

  useEffect(() => {
    if (!token || !isProfileComplete) {
      setChatUnreadCount(0);
      setSwaps([]);
      return;
    }

    let intervalId = null;

    // Run fetch unread count logic.
    async function fetchUnreadCount() {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/messages/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json().catch(() => []);

        if (!res.ok) {
          return;
        }

        let mutedIds = [];
        try {
          const rawMuted = localStorage.getItem(MUTED_CONVERSATIONS_STORAGE_KEY);
          const parsedMuted = rawMuted ? JSON.parse(rawMuted) : [];
          mutedIds = Array.isArray(parsedMuted)
            ? parsedMuted.map((id) => String(id))
            : [];
        } catch (_error) {
          mutedIds = [];
        }

        const totalUnread = Array.isArray(data)
          ? data.reduce((sum, conversation) => {
              const conversationUserId = String(conversation?.user?._id || "");
              if (mutedIds.includes(conversationUserId)) {
                return sum;
              }
              return sum + Number(conversation?.unreadCount || 0);
            }, 0)
          : 0;

        setChatUnreadCount(totalUnread);
      } catch (_error) {
        // Keep existing count; avoid noisy UI updates if polling fails.
      }
    }

    async function fetchSwaps() {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/swaps`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json().catch(() => []);

        if (!res.ok) {
          return;
        }

        setSwaps(Array.isArray(data) ? data : []);
      } catch (_error) {
        // Keep existing swaps if polling fails.
      }
    }

    fetchUnreadCount();
    fetchSwaps();

    intervalId = setInterval(() => {
      fetchUnreadCount();
      fetchSwaps();
    }, UNREAD_POLLING_INTERVAL_MS);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isProfileComplete, token]);

  const notifications = buildNotifications(swaps, currentUserId, currentUser.timeZone || "").filter(
    (notification) => !dismissedNotifications.includes(notification.id)
  );

  // Handle restricted navigation action.
  function handleRestrictedNavigation(pathname, actionLabel) {
    if (isProfileComplete) {
      if (onBeforeNavigate) {
        onBeforeNavigate(pathname);
        return;
      }
      navigate(pathname);
      return;
    }

    onRequireProfileSetup?.(actionLabel);
  }

  // Handle nav click action.
  function handleNavClick(event, pathname) {
    if (!onBeforeNavigate) {
      return;
    }

    event.preventDefault();
    onBeforeNavigate(pathname);
  }

  // Get restricted nav class data.
  function getRestrictedNavClass(pathname) {
    return location.pathname === pathname ? "nav-link active" : "nav-link";
  }

  // Handle toggle notifications action.
  function handleToggleNotifications() {
    setShowNotifications((prev) => !prev);
  }

  // Handle dismiss notification action.
  function handleDismissNotification(notificationId) {
    setDismissedNotifications((prev) =>
      prev.includes(notificationId) ? prev : [...prev, notificationId]
    );
  }

  // Handle clear all notifications action.
  function handleClearAllNotifications() {
    setDismissedNotifications((prev) => [
      ...new Set([...prev, ...notifications.map((notification) => notification.id)]),
    ]);
  }

  // Handle notification click action.
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

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <NavLink
            to={isProfileComplete ? "/foryou" : "/browse"}
            className="navbar-brand"
            onClick={(event) =>
              handleNavClick(event, isProfileComplete ? "/foryou" : "/browse")
            }
          >
            <img
              className="navbar-brand-logo"
              src={`${process.env.PUBLIC_URL}/skillswap-logo.png`}
              alt="SkillSwap logo"
            />
            <span className="navbar-brand-text">SkillSwap</span>
          </NavLink>

          <div className="navbar-links">
            <button
              type="button"
              className={getRestrictedNavClass("/foryou")}
              onClick={() => handleRestrictedNavigation("/foryou", "open For You")}
            >
              For You
            </button>
            <NavLink
              to="/browse"
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              onClick={(event) => handleNavClick(event, "/browse")}
            >
              Browse
            </NavLink>
            <button
              type="button"
              className={getRestrictedNavClass("/calendar")}
              onClick={() => handleRestrictedNavigation("/calendar", "open your swaps")}
            >
              Calendar
            </button>
            <button
              type="button"
              className={getRestrictedNavClass("/chat")}
              onClick={() => handleRestrictedNavigation("/chat", "open chat")}
            >
              Chat
              {isProfileComplete && chatUnreadCount > 0 && (
                <span className="nav-link__badge" aria-label={`${chatUnreadCount} unread chat messages`}>
                  {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                </span>
              )}
            </button>
            <NavLink
              to="/profile"
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              onClick={(event) => handleNavClick(event, "/profile")}
            >
              Profile
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              onClick={(event) => handleNavClick(event, "/settings")}
            >
              Settings
            </NavLink>

            <div className="navbar-notification-wrap">
              <button
                type="button"
                className="navbar-notification-bell"
                onClick={handleToggleNotifications}
                aria-label="Open notifications"
                aria-expanded={showNotifications}
              >
                <span className="navbar-notification-bell__icon" aria-hidden="true">
                  &#128276;
                </span>
                {notifications.length > 0 && (
                  <span className="navbar-notification-badge">
                    {notifications.length > 99 ? "99+" : notifications.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {showNotifications && (
        <>
          <button
            type="button"
            className="navbar-notifications-backdrop"
            onClick={handleToggleNotifications}
            aria-label="Close notifications"
          />
          <div className="navbar-notifications-menu" role="dialog" aria-label="Notifications">
            <div className="navbar-notifications-menu__header">
              <h2 className="navbar-notifications-menu__title">Notifications</h2>
              <button
                type="button"
                className="navbar-notifications-menu__close"
                onClick={handleToggleNotifications}
                aria-label="Close notifications menu"
              >
                ×
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="navbar-notifications-menu__empty">
                No notifications right now.
              </p>
            ) : (
              <>
                <div className="navbar-notifications-menu__list">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`navbar-notification-item ${
                        notification.actionable
                          ? "navbar-notification-item--actionable"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="navbar-notification-item__content"
                        onClick={() => handleNotificationClick(notification)}
                        disabled={!notification.actionable}
                        aria-label={
                          notification.actionable
                            ? `Open ${notification.title}`
                            : undefined
                        }
                      >
                        <p className="navbar-notification-item__title">
                          {notification.title}
                        </p>
                        <p className="navbar-notification-item__message">
                          {notification.message}
                        </p>
                        {notification.actionable && (
                          <span className="navbar-notification-item__hint">
                            View on Calendar
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="navbar-notification-item__dismiss"
                        onClick={() => handleDismissNotification(notification.id)}
                        aria-label={`Dismiss ${notification.title}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="navbar-notifications-menu__footer">
                  <button
                    type="button"
                    className="navbar-notifications-menu__clear"
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
    </>
  );
}

export default NavBar;