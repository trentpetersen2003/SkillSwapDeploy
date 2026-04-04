// client/src/pages/Calendar.js
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import ReactCalendar from "react-calendar";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
import LoadingState from "../components/LoadingState";
import { withMinimumDelay } from "../utils/loading";
import "react-calendar/dist/Calendar.css";
import "../pages/Calendar.css";

function CalendarPage() {
  const location = useLocation();
  const focusSwapId = location.state?.focusSwapId || "";
  const focusView = location.state?.focusView || "list";
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = currentUser.id || currentUser._id || "";
  const [swaps, setSwaps] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState("list"); 
  const [highlightedSwapId, setHighlightedSwapId] = useState("");
  const [reviewDraftsBySwapId, setReviewDraftsBySwapId] = useState({});
  const [submittingReviewForSwapId, setSubmittingReviewForSwapId] = useState("");
  const [reviewPromptSwap, setReviewPromptSwap] = useState(null);

  useEffect(() => {
    loadSwaps();
  }, []);

  useEffect(() => {
    if (!focusSwapId) {
      return;
    }

    setView(focusView);
  }, [focusSwapId, focusView]);

  async function loadSwaps() {
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("Please log in");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const data = await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + "/api/swaps", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to load swaps");
        }

        return res.json();
      });

      setSwaps(data);
      setMessage("");
    } catch (err) {
      console.error("Error loading swaps:", err);
      setLoadError(err.message || "Something went wrong loading swaps.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(swapId, newStatus) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetchWithAuth(API_URL + `/api/swaps/${swapId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const updatedSwap = await res.json();
        maybePromptForReview(updatedSwap);
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
      const res = await fetchWithAuth(API_URL + `/api/swaps/${swapId}`, {
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

  async function handleConfirmSession(swapId) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetchWithAuth(API_URL + `/api/swaps/${swapId}/confirm-session`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const updatedSwap = await res.json();
        maybePromptForReview(updatedSwap);
        loadSwaps();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to confirm session");
      }
    } catch (err) {
      console.error("Error confirming session:", err);
      alert("Something went wrong");
    }
  }

  function handleReviewChange(swapId, field, value) {
    setReviewDraftsBySwapId((prev) => ({
      ...prev,
      [swapId]: {
        rating: prev[swapId]?.rating || "5",
        comment: prev[swapId]?.comment || "",
        [field]: value,
      },
    }));
  }

  function maybePromptForReview(updatedSwap) {
    if (!updatedSwap || !currentUserId) {
      return;
    }

    const reviewField = updatedSwap.requester?._id === currentUserId ? "requesterReview" : "recipientReview";
    if (updatedSwap.reviews?.[reviewField]) {
      return;
    }

    const hasCurrentUserConfirmed =
      updatedSwap.requester?._id === currentUserId
        ? Boolean(updatedSwap.requesterConfirmedAt)
        : Boolean(updatedSwap.recipientConfirmedAt);

    if (updatedSwap.status !== "completed" && !(updatedSwap.status === "confirmed" && hasCurrentUserConfirmed)) {
      return;
    }

    setReviewDraftsBySwapId((prev) => ({
      ...prev,
      [updatedSwap._id]: prev[updatedSwap._id] || { rating: "5", comment: "" },
    }));
    setReviewPromptSwap(updatedSwap);
  }

  async function handleSubmitReview(swapId) {
    const token = localStorage.getItem("token");
    const draft = reviewDraftsBySwapId[swapId] || { rating: "5", comment: "" };

    setSubmittingReviewForSwapId(swapId);
    try {
      const res = await fetchWithAuth(API_URL + `/api/swaps/${swapId}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: parseInt(draft.rating, 10),
          comment: draft.comment || "",
        }),
      });

      if (res.ok) {
        setReviewDraftsBySwapId((prev) => {
          const next = { ...prev };
          delete next[swapId];
          return next;
        });
        if (reviewPromptSwap?._id === swapId) {
          setReviewPromptSwap(null);
        }
        loadSwaps();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to submit review");
      }
    } catch (err) {
      console.error("Error submitting review:", err);
      alert("Something went wrong");
    } finally {
      setSubmittingReviewForSwapId("");
    }
  }

  async function handleMilestoneComplete(swapId, milestoneId) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetchWithAuth(
        API_URL + `/api/swaps/${swapId}/milestones/${milestoneId}/complete`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        loadSwaps();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to update milestone");
      }
    } catch (err) {
      console.error("Error updating milestone:", err);
      alert("Something went wrong");
    }
  }

  // Get swaps for a specific date (excluding cancelled swaps from calendar view)
  function getSwapsForDate(date) {
    return swaps.filter((swap) => {
      const swapDate = new Date(swap.scheduledDate);
      return (
        swap.status !== "cancelled" &&
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

  const HISTORY_STATUSES = ["completed", "cancelled"];

  // Get upcoming swaps that still require action
  const actionableUpcomingSwaps = swaps
    .filter(
      (swap) =>
        !HISTORY_STATUSES.includes(swap.status) &&
        new Date(swap.scheduledDate) >= new Date()
    )
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

  // Organize upcoming swaps by status
  const pendingRequests = actionableUpcomingSwaps.filter(
    (swap) => swap.status === "pending"
  );
  const activeSwaps = actionableUpcomingSwaps.filter(
    (swap) => swap.status === "confirmed"
  );

  // Keep completed/cancelled items visible as history even after refresh
  const swapHistory = swaps
    .filter((swap) => HISTORY_STATUSES.includes(swap.status))
    .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));

  // Get swaps for selected date
  const selectedDateSwaps = getSwapsForDate(selectedDate);

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

  useEffect(() => {
    if (!focusSwapId || swaps.length === 0) {
      return;
    }

    const targetSwap = swaps.find((swap) => swap._id === focusSwapId);
    if (!targetSwap) {
      return;
    }

    setHighlightedSwapId(focusSwapId);
    setSelectedDate(new Date(targetSwap.scheduledDate));

    const frame = window.requestAnimationFrame(() => {
      const targetElement = document.querySelector(`[data-swap-id="${focusSwapId}"]`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    const timeout = window.setTimeout(() => {
      setHighlightedSwapId("");
    }, 3000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [focusSwapId, swaps, view]);

  if (loading) {
    return <LoadingState message="Loading calendar..." />;
  }

  if (loadError) {
    return <LoadingState message={loadError} onRetry={loadSwaps} />;
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

      {reviewPromptSwap && (
        <ReviewPromptModal
          swap={reviewPromptSwap}
          currentUserId={currentUserId}
          reviewDraft={reviewDraftsBySwapId[reviewPromptSwap._id]}
          isSubmittingReview={submittingReviewForSwapId === reviewPromptSwap._id}
          onClose={() => setReviewPromptSwap(null)}
          onReviewChange={handleReviewChange}
          onSubmitReview={handleSubmitReview}
          formatDate={formatDate}
          formatTime={formatTime}
        />
      )}

      {view === "calendar" ? (
        <div className="calendar-view">
          <div className="calendar-view__calendar">
            <ReactCalendar
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
                    onMilestoneComplete={handleMilestoneComplete}
                    onConfirmSession={handleConfirmSession}
                    onReviewChange={handleReviewChange}
                    onSubmitReview={handleSubmitReview}
                    reviewDraft={reviewDraftsBySwapId[swap._id]}
                    isSubmittingReview={submittingReviewForSwapId === swap._id}
                    reviewPromptSwapId={reviewPromptSwap?._id || ""}
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
              Pending Requests ({pendingRequests.length})
            </h2>
            {pendingRequests.length === 0 ? (
              <p className="section-empty">
                No pending requests.
              </p>
            ) : (
              <div className="swaps-list">
                {pendingRequests.map((swap) => (
                  <SwapCard
                    key={swap._id}
                    swap={swap}
                    currentUser={currentUser}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteSwap}
                    onMilestoneComplete={handleMilestoneComplete}
                    onConfirmSession={handleConfirmSession}
                    onReviewChange={handleReviewChange}
                    onSubmitReview={handleSubmitReview}
                    reviewDraft={reviewDraftsBySwapId[swap._id]}
                    isSubmittingReview={submittingReviewForSwapId === swap._id}
                    reviewPromptSwapId={reviewPromptSwap?._id || ""}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    isHighlighted={swap._id === highlightedSwapId}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="list-view__section">
            <h2 className="section-title">
              Active Swaps ({activeSwaps.length})
            </h2>
            {activeSwaps.length === 0 ? (
              <p className="section-empty">
                No active swaps. Visit the "For You" page to schedule one!
              </p>
            ) : (
              <div className="swaps-list">
                {activeSwaps.map((swap) => (
                  <SwapCard
                    key={swap._id}
                    swap={swap}
                    currentUser={currentUser}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteSwap}
                    onMilestoneComplete={handleMilestoneComplete}
                    onConfirmSession={handleConfirmSession}
                    onReviewChange={handleReviewChange}
                    onSubmitReview={handleSubmitReview}
                    reviewDraft={reviewDraftsBySwapId[swap._id]}
                    isSubmittingReview={submittingReviewForSwapId === swap._id}
                    reviewPromptSwapId={reviewPromptSwap?._id || ""}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    isHighlighted={swap._id === highlightedSwapId}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="list-view__section">
            <h2 className="section-title">Swap History ({swapHistory.length})</h2>
            {swapHistory.length === 0 ? (
              <p className="section-empty">
                No completed or cancelled swaps yet.
              </p>
            ) : (
              <div className="swaps-list">
                {swapHistory.map((swap) => (
                  <SwapCard
                    key={swap._id}
                    swap={swap}
                    currentUser={currentUser}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteSwap}
                    onMilestoneComplete={handleMilestoneComplete}
                    onConfirmSession={handleConfirmSession}
                    onReviewChange={handleReviewChange}
                    onSubmitReview={handleSubmitReview}
                    reviewDraft={reviewDraftsBySwapId[swap._id]}
                    isSubmittingReview={submittingReviewForSwapId === swap._id}
                    reviewPromptSwapId={reviewPromptSwap?._id || ""}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    isHistory={true}
                    isHighlighted={swap._id === highlightedSwapId}
                  />
                ))}
              </div>
            )}
          </section>
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
  onMilestoneComplete,
  onConfirmSession,
  onReviewChange,
  onSubmitReview,
  reviewDraft,
  isSubmittingReview,
  reviewPromptSwapId,
  formatDate,
  formatTime,
  getStatusColor,
  isPast = false,
  isHistory = false,
  isHighlighted = false,
}) {
  const currentUserId = currentUser.id || currentUser._id;
  const isRequester = swap.requester._id === currentUserId;
  const otherUser = isRequester ? swap.recipient : swap.requester;
  const milestones = Array.isArray(swap.milestones) ? swap.milestones : [];
  const completedMilestoneCount = milestones.filter((milestone) => milestone.completed).length;
  const isReviewPromptOpen = reviewPromptSwapId === swap._id;
  const hasConfirmed = Boolean(
    isRequester ? swap.requesterConfirmedAt : swap.recipientConfirmedAt
  );
  const hasReviewed = Boolean(
    isRequester ? swap.reviews?.requesterReview : swap.reviews?.recipientReview
  );

  return (
    <div
      className={`swap-card ${isHighlighted ? "swap-card--highlighted" : ""}`}
      style={{ borderLeftColor: getStatusColor(swap.status) }}
      data-swap-id={swap._id}
    >
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

      {isHistory && (
        <div className="swap-card__history-skill">
          <span className="history-skill-label">Skill exchanged:</span>
          <span className="history-skill-value">
            {swap.skillOffered} {" <-> "} {swap.skillWanted}
          </span>
        </div>
      )}

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

      {milestones.length > 0 && (
        <div className="swap-card__milestones">
          <div className="milestones-header">
            <strong>Session goals</strong>
            <span>
              {completedMilestoneCount}/{milestones.length} complete
            </span>
          </div>
          <ul className="milestones-list">
            {milestones.map((milestone, index) => (
              <li key={milestone._id || `${swap._id}-milestone-${index}`}>
                <span
                  className={`milestone-title ${milestone.completed ? "is-complete" : ""}`}
                >
                  {milestone.title}
                </span>
                {!isHistory && !milestone.completed && swap.status === "confirmed" && (
                  <button
                    className="action-btn milestone-btn"
                    onClick={() => onMilestoneComplete(swap._id, milestone._id)}
                  >
                    Complete Goal
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {swap.status === "confirmed" && (
        <div className="swap-card__confirmation">
          {hasConfirmed ? (
            <span className="confirmation-note">Session confirmed by you. Waiting for partner.</span>
          ) : (
            <button className="action-btn confirm-btn" onClick={() => onConfirmSession(swap._id)}>
              Confirm Session Done
            </button>
          )}
        </div>
      )}

      {swap.status === "completed" && !hasReviewed && !isReviewPromptOpen && (
        <div className="swap-card__review">
          <strong>Rate this swap</strong>
          <div className="swap-card__review-controls">
            <select
              value={reviewDraft?.rating || "5"}
              onChange={(event) => onReviewChange(swap._id, "rating", event.target.value)}
            >
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Very poor</option>
            </select>
            <input
              type="text"
              placeholder="Optional feedback"
              value={reviewDraft?.comment || ""}
              onChange={(event) => onReviewChange(swap._id, "comment", event.target.value)}
            />
            <button
              className="action-btn complete-btn"
              onClick={() => onSubmitReview(swap._id)}
              disabled={isSubmittingReview}
            >
              {isSubmittingReview ? "Submitting..." : "Submit Review"}
            </button>
          </div>
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
                Accept
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
            <>
              <button
                className="action-btn cancel-btn"
                onClick={() => {
                  if (window.confirm("Are you sure you want to end this active swap?")) {
                    onStatusChange(swap._id, "cancelled");
                  }
                }}
              >
                End Swap
              </button>
            </>
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

function ReviewPromptModal({
  swap,
  currentUserId,
  reviewDraft,
  isSubmittingReview,
  onClose,
  onReviewChange,
  onSubmitReview,
  formatDate,
  formatTime,
}) {
  const isRequester = swap.requester._id === currentUserId;
  const otherUser = isRequester ? swap.recipient : swap.requester;

  return (
    <div
      className="review-prompt-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`review-prompt-title-${swap._id}`}
    >
      <div className="review-prompt-modal">
        <button
          type="button"
          className="review-prompt-modal__close"
          aria-label="Close review prompt"
          onClick={onClose}
        >
          ×
        </button>
        <p className="review-prompt-modal__eyebrow">Swap completed</p>
        <h2 id={`review-prompt-title-${swap._id}`} className="review-prompt-modal__title">
          {swap.status === "completed"
            ? `Rate your swap with ${otherUser?.name || "your partner"}`
            : `Leave your review for ${otherUser?.name || "your partner"}`}
        </h2>
        <p className="review-prompt-modal__copy">
          {swap.status === "completed"
            ? "Add a quick rating and optional note before you move on."
            : "You can leave your rating now while you wait for the other person to confirm."}
        </p>
        <div className="review-prompt-modal__meta">
          <span>
            {swap.skillOffered} ↔ {swap.skillWanted}
          </span>
          <span>{formatDate(swap.scheduledDate)}</span>
          <span>{formatTime(swap.scheduledDate)}</span>
        </div>
        <div className="swap-card__review-controls swap-card__review-controls--prompt">
          <select
            value={reviewDraft?.rating || "5"}
            onChange={(event) => onReviewChange(swap._id, "rating", event.target.value)}
          >
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Okay</option>
            <option value="2">2 - Poor</option>
            <option value="1">1 - Very poor</option>
          </select>
          <input
            type="text"
            placeholder="Optional feedback"
            value={reviewDraft?.comment || ""}
            onChange={(event) => onReviewChange(swap._id, "comment", event.target.value)}
          />
          <button
            type="button"
            className="action-btn complete-btn"
            onClick={() => onSubmitReview(swap._id)}
            disabled={isSubmittingReview}
          >
            {isSubmittingReview ? "Submitting..." : "Submit Review"}
          </button>
        </div>
        <div className="review-prompt-modal__actions">
          <button type="button" className="action-btn cancel-btn" onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

export default CalendarPage;
