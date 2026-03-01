import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import API_URL from "../config";
import LoadingState from "../components/LoadingState";
import "./Chat.css";

function formatTimestamp(dateString) {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Chat() {
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [composerText, setComposerText] = useState("");
  const location = useLocation();

  const token = localStorage.getItem("token");
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    []
  );

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setThread([]);
      return;
    }
    fetchThread(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  async function fetchInitialData() {
    if (!token) {
      setLoadError("Please log in");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const [usersRes, conversationsRes] = await Promise.all([
        fetch(`${API_URL}/api/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${API_URL}/api/messages/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const usersData = await usersRes.json().catch(() => []);
      const conversationsData = await conversationsRes.json().catch(() => []);

      if (!usersRes.ok) {
        throw new Error(usersData.message || "Failed to load users");
      }
      if (!conversationsRes.ok) {
        throw new Error(conversationsData.message || "Failed to load conversations");
      }

      const otherUsers = Array.isArray(usersData)
        ? usersData.filter((user) => user._id !== currentUser.id)
        : [];
      const params = new URLSearchParams(location.search);
      const requestedUserId = params.get("userId");

      setUsers(otherUsers);
      setConversations(Array.isArray(conversationsData) ? conversationsData : []);

      if (
        requestedUserId &&
        otherUsers.some((user) => user._id === requestedUserId)
      ) {
        setSelectedUserId(requestedUserId);
      } else if (conversationsData.length > 0) {
        setSelectedUserId(conversationsData[0].user._id);
      } else if (otherUsers.length > 0) {
        setSelectedUserId(otherUsers[0]._id);
      }
    } catch (error) {
      console.error("Error loading chat data:", error);
      setLoadError(error.message || "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }

  async function fetchThread(userId) {
    if (!token) {
      return;
    }

    setThreadLoading(true);
    setMessageError("");

    try {
      const res = await fetch(`${API_URL}/api/messages/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        throw new Error(data.message || "Failed to load messages");
      }

      setThread(Array.isArray(data) ? data : []);
      refreshConversations();
    } catch (error) {
      console.error("Error loading message thread:", error);
      setMessageError(error.message || "Failed to load messages");
    } finally {
      setThreadLoading(false);
    }
  }

  async function refreshConversations() {
    if (!token) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/messages/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => []);
      if (res.ok) {
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error refreshing conversations:", error);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!token || !selectedUserId) {
      return;
    }

    const text = composerText.trim();
    if (!text) {
      return;
    }

    setMessageError("");

    try {
      const res = await fetch(`${API_URL}/api/messages/${selectedUserId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to send message");
      }

      setThread((prev) => [...prev, data]);
      setComposerText("");
      refreshConversations();
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageError(error.message || "Failed to send message");
    }
  }

  const selectedUser = users.find((user) => user._id === selectedUserId) || null;

  if (loading) {
    return <LoadingState message="Loading chat..." />;
  }

  if (loadError) {
    return <LoadingState message={loadError} onRetry={fetchInitialData} />;
  }

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <h2 className="chat-sidebar__title">Conversations</h2>
        {users.length === 0 ? (
          <p className="chat-sidebar__empty">No other users found.</p>
        ) : (
          <div className="chat-user-list">
            {users.map((user) => {
              const conversation = conversations.find(
                (item) => item?.user?._id === user._id
              );
              const unreadCount = conversation?.unreadCount || 0;
              return (
                <button
                  key={user._id}
                  type="button"
                  className={`chat-user-item ${
                    selectedUserId === user._id ? "active" : ""
                  }`}
                  onClick={() => setSelectedUserId(user._id)}
                >
                  <span className="chat-user-item__name">{user.name}</span>
                  <span className="chat-user-item__username">@{user.username}</span>
                  {conversation?.lastMessage?.text && (
                    <span className="chat-user-item__preview">
                      {conversation.lastMessage.text}
                    </span>
                  )}
                  {unreadCount > 0 && (
                    <span className="chat-user-item__unread">{unreadCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <section className="chat-thread">
        {selectedUser ? (
          <>
            <header className="chat-thread__header">
              <h1>Chat with {selectedUser.name}</h1>
              <p>@{selectedUser.username}</p>
            </header>

            {threadLoading ? (
              <LoadingState message="Loading messages..." />
            ) : (
              <div className="chat-messages">
                {thread.length === 0 ? (
                  <p className="chat-messages__empty">
                    No messages yet. Start the conversation.
                  </p>
                ) : (
                  thread.map((message) => {
                    const isMine =
                      String(message.sender?._id || message.sender) === currentUser.id;
                    return (
                      <div
                        key={message._id}
                        className={`chat-bubble ${isMine ? "mine" : "theirs"}`}
                      >
                        <p>{message.text}</p>
                        <span>{formatTimestamp(message.createdAt)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <form className="chat-composer" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="Type a message..."
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                maxLength={2000}
              />
              <button type="submit">Send</button>
            </form>
            {messageError && <p className="chat-error">{messageError}</p>}
          </>
        ) : (
          <div className="chat-thread__empty">
            <p>Select a user to start chatting.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Chat;
