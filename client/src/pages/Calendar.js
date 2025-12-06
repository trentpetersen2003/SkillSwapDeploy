// client/src/pages/Calendar.js
import React, { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../Calendar.css";

function CalendarPage() {
  const [swaps, setSwaps] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [view, setView] = useState("list"); // 'list' or 'calendar'

  useEffect(() => {
    loadSwaps();
  }, []);

  async function loadSwaps() {
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("Please log in");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/swaps", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.message || "Failed to load swaps");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setSwaps(data);
    } catch (err) {
      console.error("Error loading swaps:", err);
      setMessage("Something went wrong loading swaps.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(swapId, newStatus) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/swaps/${swapId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        // Reload swaps
        loadSwaps();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to update swap");
      }
    } catch (err) {
      console.error("Error updating swap:", err);
      alert("Something went wrong");
    }
  }

  async function handleDeleteSwap(swapId) {
    if (!window.confirm("Are you sure you want to delete this swap?")) {
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/swaps/${swapId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        loadSwaps();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete swap");
      }
    } catch (err) {
      console.error("Error deleting swap:", err);
      alert("Something went wrong");
    }
  }

  // Get swaps for a specific date
  function getSwapsForDate(date) {
    return swaps.filter((swap) => {
      const swapDate = new Date(swap.scheduledDate);
      return (
        swapDate.getDate() === date.getDate() &&
        swapDate.getMonth() === date.getMonth() &&
        swapDate.getFullYear() === date.getFullYear()
      );
    });
  }

  // Mark dates that have swaps
  function tileContent({ date, view }) {
    if (view === "month") {
      const daySwaps = getSwapsForDate(date);
      if (daySwaps.length > 0) {
        return (
          <div className="calendar-tile-badge">
            {daySwaps.length}
          </div>
        );
      }
    }
    return null;
  }

  // Get upcoming swaps (future dates only)
  const upcomingSwaps = swaps
    .filter((swap) => new Date(swap.scheduledDate) >= new Date())
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

  // Get past swaps
  const pastSwaps = swaps
    .filter((swap) => new Date(swap.scheduledDate) < new Date())
    .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));

  // Get swaps for selected date
  const selectedDateSwaps = getSwapsForDate(selectedDate);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function getStatusColor(status) {
    switch (status) {
      case "confirmed":
        return "#10b981";
      case "pending":
        return "#f59e0b";
      case "completed":
        return "#6366f1";
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  }

  if (loading) {
    return <div className="calendar-page__loading">Loading calendar...</div>;
  }

  return (
    <div className="calendar-page">
      <div className="calendar-page__header">
        <h1 className="calendar-page__title">Calendar</h1>
        <div className="calendar-page__view-toggle">
          <button
            className={`view-toggle-btn ${view === "list" ? "active" : ""}`}
            onClick={() => setView("list")}
          >
            List View
          </button>
          <button
            className={`view-toggle-btn ${view === "calendar" ? "active" : ""}`}
            onClick={() => setView("calendar")}
          >
            Calendar View
          </button>
        </div>
      </div>

      {message && <p className="calendar-page__message">{message}</p>}

      {view === "calendar" ? (
        <div className="calendar-view">
          <div className="calendar-view__calendar">
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              tileContent={tileContent}
              className="custom-calendar"
            />
          </div>

          <div className="calendar-view__details">
            <h3 className="details-title">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h3>

            {selectedDateSwaps.length === 0 ? (
              <p className="details-empty">No swaps scheduled for this day.</p>
            ) : (
              <div className="details-swaps">
                {selectedDateSwaps.map((swap) => (
                  <SwapCard
                    key={swap._id}
                    swap={swap}
                    currentUser={currentUser}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteSwap}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="list-view">
          <section className="list-view__section">
            <h2 className="section-title">
              Upcoming Swaps ({upcomingSwaps.length})
            </h2>
            {upcomingSwaps.length === 0 ? (
              <p className="section-empty">
                No upcoming swaps. Visit the "For You" page to schedule one!
              </p>
            ) : (
              <div className="swaps-list">
                {upcomingSwaps.map((swap) => (
                  <SwapCard
                    key={swap._id}
                    swap={swap}
                    currentUser={currentUser}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteSwap}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </div>
            )}
          </section>

          {pastSwaps.length > 0 && (
            <section className="list-view__section">
              <h2 className="section-title">Past Swaps ({pastSwaps.length})</h2>
              <div className="swaps-list">
                {pastSwaps.map((swap) => (
                  <SwapCard
                    key={swap._id}
                    swap={swap}
                    currentUser={currentUser}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteSwap}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    isPast={true}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SwapCard({
  swap,
  currentUser,
  onStatusChange,
  onDelete,
  formatDate,
  formatTime,
  getStatusColor,
  isPast = false,
}) {
  const isRequester = swap.requester._id === currentUser.id;
  const otherUser = isRequester ? swap.recipient : swap.requester;

  return (
    <div className="swap-card" style={{ borderLeftColor: getStatusColor(swap.status) }}>
      <div className="swap-card__header">
        <div className="swap-card__user-info">
          <span className="user-label">{isRequester ? "With:" : "From:"}</span>
          <span className="user-name">{otherUser.name}</span>
          <span className="user-username">@{otherUser.username}</span>
        </div>
        <span
          className="swap-card__status"
          style={{ backgroundColor: getStatusColor(swap.status) }}
        >
          {swap.status}
        </span>
      </div>

      <div className="swap-card__skills">
        <div className="skill-item">
          <span className="skill-label">
            {isRequester ? "You teach:" : "You learn:"}
          </span>
          <span className="skill-value">{swap.skillOffered}</span>
        </div>
        <div className="skill-item">
          <span className="skill-label">
            {isRequester ? "You learn:" : "They teach:"}
          </span>
          <span className="skill-value">{swap.skillWanted}</span>
        </div>
      </div>

      <div className="swap-card__details">
        {formatDate && (
          <div className="detail-item">
            <span className="detail-icon">📅</span>
            <span>{formatDate(swap.scheduledDate)}</span>
          </div>
        )}
        <div className="detail-item">
          <span className="detail-icon">🕒</span>
          <span>{formatTime(swap.scheduledDate)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-icon">⏱️</span>
          <span>{swap.duration} min</span>
        </div>
        {swap.location && (
          <div className="detail-item">
            <span className="detail-icon">📍</span>
            <span>{swap.location}</span>
          </div>
        )}
      </div>

      {swap.notes && (
        <div className="swap-card__notes">
          <strong>Notes:</strong> {swap.notes}
        </div>
      )}

      {!isPast && (
        <div className="swap-card__actions">
          {!isRequester && swap.status === "pending" && (
            <>
              <button
                className="action-btn confirm-btn"
                onClick={() => onStatusChange(swap._id, "confirmed")}
              >
                Confirm
              </button>
              <button
                className="action-btn cancel-btn"
                onClick={() => onStatusChange(swap._id, "cancelled")}
              >
                Decline
              </button>
            </>
          )}

          {swap.status === "confirmed" && (
            <button
              className="action-btn complete-btn"
              onClick={() => onStatusChange(swap._id, "completed")}
            >
              Mark Complete
            </button>
          )}

          {isRequester && swap.status === "pending" && (
            <button
              className="action-btn delete-btn"
              onClick={() => onDelete(swap._id)}
            >
              Cancel Request
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default CalendarPage;
