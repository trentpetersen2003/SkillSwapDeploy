import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
import "./NavBar.css";

const UNREAD_POLLING_INTERVAL_MS = 10000;
const MUTED_CONVERSATIONS_STORAGE_KEY = "chat-muted-conversations";

function NavBar({
  isProfileComplete = true,
  onRequireProfileSetup,
  onBeforeNavigate,
}) {
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => localStorage.getItem("token"), []);

  useEffect(() => {
    if (!token || !isProfileComplete) {
      setChatUnreadCount(0);
      return;
    }

    let intervalId = null;

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

    fetchUnreadCount();
    intervalId = setInterval(fetchUnreadCount, UNREAD_POLLING_INTERVAL_MS);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isProfileComplete, token]);

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

  function handleNavClick(event, pathname) {
    if (!onBeforeNavigate) {
      return;
    }

    event.preventDefault();
    onBeforeNavigate(pathname);
  }

  function getRestrictedNavClass(pathname) {
    return location.pathname === pathname ? "nav-link active" : "nav-link";
  }

  return (
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
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
