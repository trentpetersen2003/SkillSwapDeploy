import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import API_URL from '../config';
import fetchWithAuth from '../utils/api';
import './NavBar.css';

const UNREAD_POLLING_INTERVAL_MS = 10000;
const MUTED_CONVERSATIONS_STORAGE_KEY = 'chat-muted-conversations';

function NavBar() {
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const token = useMemo(() => localStorage.getItem('token'), []);

  useEffect(() => {
    if (!token) {
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
              const conversationUserId = String(conversation?.user?._id || '');
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
  }, [token]);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <NavLink to="/foryou" className="navbar-brand">
          <img
            className="navbar-brand-logo"
            src={`${process.env.PUBLIC_URL}/skillswap-logo.png`}
            alt="SkillSwap logo"
          />
          <span className="navbar-brand-text">SkillSwap</span>
        </NavLink>

        <div className="navbar-links">
        <NavLink 
          to="/foryou" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          For You
        </NavLink>
        <NavLink 
          to="/browse" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Browse
        </NavLink>
        <NavLink 
          to="/calendar" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Calendar
        </NavLink>
        <NavLink
          to="/chat"
          className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
        >
          Chat
          {chatUnreadCount > 0 && (
            <span className="nav-link__badge" aria-label={`${chatUnreadCount} unread chat messages`}>
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          )}
        </NavLink>
        <NavLink 
          to="/profile" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Profile
        </NavLink>
        <NavLink 
          to="/settings" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Settings
        </NavLink>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
