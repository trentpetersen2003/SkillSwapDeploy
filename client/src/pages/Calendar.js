// client/src/pages/Calendar.js
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import ReactCalendar from "react-calendar";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
import LoadingState from "../components/LoadingState";
import ErrorModal from "../components/ErrorModal";
import { withMinimumDelay } from "../utils/loading";
import "react-calendar/dist/Calendar.css";
import "../pages/Calendar.css";

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

// Shift a date into the requested timezone.
function getTimezoneAdjustedDate(dateValue, timeZone) {
  const offsetMinutes = parseUtcOffsetToMinutes(timeZone);
  const date = new Date(dateValue);

  if (offsetMinutes === null || Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getTime() + offsetMinutes * 60 * 1000);
}

// Run calendar page logic.
function CalendarPage() {
  const location = useLocation();
  const focusSwapId = location.state?.focusSwapId || "";
  const focusView = location.state?.focusView || "list";
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = currentUser.id || currentUser._id || "";
  const currentUserTimeZone = currentUser.timeZone || "";
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
  const [errorModal, setErrorModal] = useState(null);

  useEffect(() => {
    loadSwaps();
  }, []);

  useEffect(() => {
    if (!focusSwapId) {
      return;
    }

    setView(focusView);
  }, [focusSwapId, focusView]);

  // Load swaps data.
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
        const swapRes = await fetchWithAuth(API_URL + "/api/swaps", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!swapRes.ok) {
          const payload = await swapRes.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to load swaps");
        }

        return swapRes.json();
      });

      setSwaps(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (err) {
      console.error("Error loading swaps:", err);
      setLoadError(err.message || "Something went wrong loading swaps.");
    } finally {
      setLoading(false);
    }
  }

  // Handle status change action.
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

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const updatedSwap = data;
        maybePromptForReview(updatedSwap);
        loadSwaps();
        return;
      }

      if (res.status === 409) {
        setErrorModal({
          title: "Swap Updated",
          message: data.message || "This swap changed before your action could be completed. Reloading your calendar.",
        });
        loadSwaps();
        return;
      }

      setErrorModal({
        title: "Unable to Update Swap",
        message: data.message || "The swap could not be updated. Please try again.",
      });
    } catch (err) {
      console.error("Error updating swap:", err);
      setErrorModal({
        title: "Connection Error",
        message: "Something went wrong while updating the swap. Please check your connection and try again.",
      });
    }
  }

  // Handle delete swap action.
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

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        loadSwaps();
        return;
      }

      if (res.status === 409) {
        setErrorModal({
          title: "Swap Already Accepted",
          message: data.message || "This swap has already been accepted. Reloading your calendar.",
        });
        loadSwaps();
        return;
      }

      setErrorModal({
        title: "Unable to Delete Swap",
        message: data.message || "The swap could not be deleted. Please try again.",
      });
    } catch (err) {
      console.error("Error deleting swap:", err);
      setErrorModal({
        title: "Connection Error",
        message: "Something went wrong while deleting the swap. Please check your connection and try again.",
      });
    }
  }

  // Handle confirm session action.
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
        setErrorModal({
          title: "Unable to Confirm Session",
          message: data.message || "Please ensure all session goals are completed before confirming the session. Return to the swap and mark all goals as complete."
        });
      }
    } catch (err) {
      console.error("Error confirming session:", err);
      setErrorModal({
        title: "Connection Error",
        message: "Something went wrong while confirming the session. Please check your connection and try again."
      });
    }
  }

  // Handle review change action.
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

  // Run maybe prompt for review logic.
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

  // Handle submit review action.
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
        setErrorModal({
          title: "Unable to Submit Review",
          message: data.message || "Your review could not be submitted. Please try again."
        });
      }
    } catch (err) {
      console.error("Error submitting review:", err);
      setErrorModal({
        title: "Connection Error",
        message: "Something went wrong while submitting your review. Please check your connection and try again."
      });
    } finally {
      setSubmittingReviewForSwapId("");
    }
  }

  // Handle milestone complete action.
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
        setErrorModal({
          title: "Unable to Complete Goal",
          message: data.message || "The goal could not be marked as complete. Please try again."
        });
      }
    } catch (err) {
      console.error("Error updating milestone:", err);
      setErrorModal({
        title: "Connection Error",
        message: "Something went wrong while updating the goal. Please check your connection and try again."
      });
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

  // Run format date logic.
  function formatDate(dateString) {
    const adjustedDate = getTimezoneAdjustedDate(dateString, currentUserTimeZone);

    if (!adjustedDate) {
      return new Date(dateString).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    return adjustedDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  // Run format time logic.
  function formatTime(dateString) {
    const adjustedDate = getTimezoneAdjustedDate(dateString, currentUserTimeZone);

    if (!adjustedDate) {
      return new Date(dateString).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    return adjustedDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  }

  // Get status color data.
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

      {errorModal && (
        <ErrorModal
          title={errorModal.title}
          message={errorModal.message}
          onClose={() => setErrorModal(null)}
        />
      )}

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
              {formatDate(selectedDate.toISOString())}
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

// Run swap card logic.
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
  const [templateMessage, setTemplateMessage] = useState("");
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

  // Convert date values to a calendar URL token format.
  function toCalendarDateToken(value) {
    return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  // Build reusable metadata for calendar template actions.
  function buildTemplateMetadata() {
    const startDate = new Date(swap.scheduledDate);
    const endDate = new Date(startDate.getTime() + Number(swap.duration || 60) * 60 * 1000);
    const partnerLabel = otherUser?.username ? `@${otherUser.username}` : otherUser?.name || "Swap partner";
    const summary = `SkillSwap: ${swap.skillOffered} ↔ ${swap.skillWanted}`;
    const locationText = swap.meetingType === "virtual"
      ? swap.meetingLink || swap.location || "Online"
      : swap.meetingAddress || swap.location || "In person";
    const details = [
      `Swap with ${partnerLabel}`,
      `You teach: ${swap.skillOffered}`,
      `You learn: ${swap.skillWanted}`,
      `Status: ${swap.status}`,
      swap.notes ? `Notes: ${swap.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      startDate,
      endDate,
      partnerLabel,
      summary,
      locationText,
      details,
    };
  }

  // Open a prefilled calendar template in a new browser tab.
  function handleOpenGoogleTemplate() {
    const template = buildTemplateMetadata();
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: template.summary,
      dates: `${toCalendarDateToken(template.startDate)}/${toCalendarDateToken(template.endDate)}`,
      details: template.details,
      location: template.locationText,
    });

    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener,noreferrer");
    setTemplateMessage("Opened a prefilled calendar template.");
  }

  // Copy a ready-to-use manual removal template to clipboard.
  async function handleCopyRemoveTemplate() {
    const template = buildTemplateMetadata();
    const removalText = [
      "Calendar removal template",
      `Event title: ${template.summary}`,
      `Date: ${formatDate ? formatDate(swap.scheduledDate) : new Date(swap.scheduledDate).toLocaleDateString("en-US")}`,
      `Time: ${formatTime(swap.scheduledDate)}`,
      `Partner: ${template.partnerLabel}`,
      "Action: Delete this event manually from your calendar.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(removalText);
      setTemplateMessage("Copied remove-from-calendar template.");
    } catch (_error) {
      setTemplateMessage("Unable to copy automatically. Please copy the event details manually.");
    }
  }

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

      <div className="swap-card__calendar-tools">
        <button
          type="button"
          className="action-btn template-btn"
          onClick={handleOpenGoogleTemplate}
        >
          Add to Calendar (Template)
        </button>
        <button
          type="button"
          className="action-btn remove-template-btn"
          onClick={handleCopyRemoveTemplate}
        >
          Copy Remove Template
        </button>
      </div>

      {templateMessage && <div className="swap-card__template-message">{templateMessage}</div>}

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

// Run review prompt modal logic.
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
