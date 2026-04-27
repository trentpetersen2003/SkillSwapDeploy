// client/src/components/SwapRequestModal.js
import React, { useState, useEffect } from "react";
import API_URL from "../config";
import fetchWithAuth from "../utils/api";
import LoadingState from "./LoadingState";
import { withMinimumDelay } from "../utils/loading";
import { formatTimeZoneLabel } from "../utils/timeZone";

// Run swap request modal logic.
function SwapRequestModal({ user, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    skillOffered: "",
    skillWanted: "",
    scheduledDate: "",
    scheduledTime: "",
    duration: "60",
    totalSessions: "1",
    milestoneTitles: [""],
    meetingType: "virtual",
    meetingLink: "",
    meetingAddress: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUserSkills, setCurrentUserSkills] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState("");
  const [currentUserTimeZone, setCurrentUserTimeZone] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [suggestedSlots, setSuggestedSlots] = useState([]);
  const [currentUserAvailability, setCurrentUserAvailability] = useState([]);
  const [availabilityWarning, setAvailabilityWarning] = useState("");
  const [showAvailabilityConfirm, setShowAvailabilityConfirm] = useState(false);

  useEffect(() => {
    fetchCurrentUserProfile();
  }, []);

  // Run fetch current user profile logic.
  async function fetchCurrentUserProfile() {
    setDetailsLoading(true);
    setDetailsError("");

    const token = localStorage.getItem("token");
    try {
      if (!token) {
        throw new Error("Please log in to request a swap.");
      }

      const data = await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + "/api/users/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.message || "Failed to load swap details.");
        }

        return res.json();
      });

      setCurrentUserSkills(data.skills || []);
      setCurrentUserTimeZone(data.timeZone || "");
      setCurrentUserAvailability(data.availability || []);
    } catch (err) {
      console.error("Error fetching current user profile:", err);
      setDetailsError(err.message || "Failed to load swap details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  // Handle change action.
  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "totalSessions") {
      const parsed = parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
        return;
      }

      setFormData((prev) => {
        const nextMilestones = Array.from({ length: parsed }, (_, index) => {
          return prev.milestoneTitles[index] || "";
        });

        return {
          ...prev,
          totalSessions: String(parsed),
          milestoneTitles: nextMilestones,
        };
      });

      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  // Handle milestone change action.
  function handleMilestoneChange(index, value) {
    setFormData((prev) => {
      const nextMilestones = [...prev.milestoneTitles];
      nextMilestones[index] = value;
      return {
        ...prev,
        milestoneTitles: nextMilestones,
      };
    });
  }

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

  // Parse utc offset to minutes input.
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

  // Build iso from profile time zone payload.
  function buildIsoFromProfileTimeZone(dateStr, timeStr, timeZone) {
    const offsetMinutes = parseUtcOffsetToMinutes(timeZone);
    if (offsetMinutes === null) {
      throw new Error("Invalid profile time zone");
    }

    const [year, month, day] = dateStr.split("-").map(Number);
    const [hour, minute] = timeStr.split(":").map(Number);

    const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60 * 1000;

    return new Date(utcMillis).toISOString();
  }
  const DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  function to24HourMinutes(hourStr, minuteStr, period) {
    let hour = Number(hourStr);
    const minute = Number(minuteStr);

    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

    hour = hour % 12;
    if (String(period).toUpperCase() === "PM") {
      hour += 12;
    }

    return hour * 60 + minute;
  }

  function parseTimeRange(timeRange) {
    if (typeof timeRange !== "string") return null;

    const match = timeRange.match(
      /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );

    if (!match) return null;

    const start = to24HourMinutes(match[1], match[2], match[3]);
    const end = to24HourMinutes(match[4], match[5], match[6]);

    if (start === null || end === null) return null;

    return { start, end };
  }

  function getLocalDayAndMinutes(date, offsetMinutes) {
    const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);

    return {
      day: DAYS[shifted.getUTCDay()],
      minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    };
  }

  function formatMinutes(minutes) {
    const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;

    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;

    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  }

  function formatLocalSession(isoDate, timeZone, durationMinutes) {
    const offsetMinutes = parseUtcOffsetToMinutes(timeZone);
    const date = new Date(isoDate);

    if (offsetMinutes === null || Number.isNaN(date.getTime())) {
      return null;
    }

    const localStart = getLocalDayAndMinutes(date, offsetMinutes);
    const localEnd = localStart.minutes + durationMinutes;

    const zoneLabel = formatTimeZoneLabel(timeZone) || timeZone;

    return `${localStart.day} ${formatMinutes(localStart.minutes)} - ${formatMinutes(localEnd)} (${zoneLabel})`;
  }

  function validateUserAvailability(userAvailability, timeZone, scheduledDate, durationMinutes) {
    if (!timeZone || !Array.isArray(userAvailability) || userAvailability.length === 0) {
      return false;
    }

    const offsetMinutes = parseUtcOffsetToMinutes(timeZone);
    if (offsetMinutes === null) {
      return false;
    }

    const localStart = getLocalDayAndMinutes(scheduledDate, offsetMinutes);
    const localEndMinutes = localStart.minutes + durationMinutes;

    if (localEndMinutes > 24 * 60) {
      return false;
    }

    return userAvailability.some((slot) => {
      if (slot.day !== localStart.day) return false;

      const parsedRange = parseTimeRange(slot.timeRange);
      if (!parsedRange) return false;

      return (
        localStart.minutes >= parsedRange.start &&
        localEndMinutes <= parsedRange.end
      );
    });
  }

  // Accepted virtual meeting providers
  const RECOGNIZED_VIRTUAL_MEETING_HOSTS = [
    "zoom.us",
    "meet.google.com",
    "teams.microsoft.com",
    "teams.live.com",
    "teams.microsoft.us",
  ];

  // Run normalize meeting link logic.
  function normalizeMeetingLink(rawLink = "") {
    const trimmed = typeof rawLink === "string" ? rawLink.trim() : "";
    if (!trimmed) {
      return { error: "Meeting link is required for virtual swaps" };
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    let parsedUrl;
    try {
      parsedUrl = new URL(withProtocol);
    } catch (error) {
      return { error: "Enter a valid meeting link URL" };
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { error: "Meeting link must use http or https" };
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const recognizedHost = RECOGNIZED_VIRTUAL_MEETING_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );

    if (!recognizedHost) {
      return {
        error: "Use a recognized Zoom, Google Meet, or Microsoft Teams link",
      };
    }

    return { value: parsedUrl.toString() };
  }

  // Run split date and time for profile time zone logic.
  function splitDateAndTimeForProfileTimeZone(isoDate, timeZone) {
    const offsetMinutes = parseUtcOffsetToMinutes(timeZone);
    if (offsetMinutes === null) {
      throw new Error("Invalid profile time zone");
    }

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid suggested date");
    }

    const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const day = String(shifted.getUTCDate()).padStart(2, "0");
    const hour = String(shifted.getUTCHours()).padStart(2, "0");
    const minute = String(shifted.getUTCMinutes()).padStart(2, "0");

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  }

  // Run apply suggested slot logic.
  function applySuggestedSlot(isoDate) {
    try {
      const next = splitDateAndTimeForProfileTimeZone(isoDate, currentUserTimeZone);
      setFormData((prev) => ({
        ...prev,
        scheduledDate: next.date,
        scheduledTime: next.time,
      }));
      setSuggestionsError("");
    } catch (err) {
      setSuggestionsError(err.message || "Unable to use suggested slot");
    }
  }

  // Run fetch suggested slots logic.
  async function fetchSuggestedSlots() {
    const token = localStorage.getItem("token");
    if (!token) {
      setSuggestionsError("Please log in to view suggestions.");
      return;
    }

    if (!formData.duration) {
      setSuggestionsError("Select a duration to get suggested time slots.");
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsError("");

    try {
      const params = new URLSearchParams({
        recipientId: user._id,
        duration: String(parseInt(formData.duration, 10) || 60),
        daysAhead: "14",
        limit: "6",
      });

      const suggestionsPayload = await withMinimumDelay(async () => {
        const res = await fetchWithAuth(`${API_URL}/api/swaps/suggestions?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.message || "Failed to get suggestions");
        }

        return payload;
      });

      setSuggestedSlots(Array.isArray(suggestionsPayload.suggestions) ? suggestionsPayload.suggestions : []);
    } catch (err) {
      console.error("Error loading suggested slots:", err);
      setSuggestionsError(err.message || "Unable to load suggested time slots.");
      setSuggestedSlots([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }
  async function submitSwapRequest() {
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      const scheduledDateTime = buildIsoFromProfileTimeZone(
        formData.scheduledDate,
        formData.scheduledTime,
        currentUserTimeZone
      );

      const parsedTotalSessions = parseInt(formData.totalSessions, 10);
      const normalizedMilestones = (formData.milestoneTitles || []).map((title) => title.trim());

      let normalizedMeetingLink = "";
      let normalizedMeetingAddress = "";

      if (formData.meetingType === "virtual") {
        const meetingLinkResult = normalizeMeetingLink(formData.meetingLink);
        if (meetingLinkResult.error) {
          setError(meetingLinkResult.error);
          setLoading(false);
          return;
        }
        normalizedMeetingLink = meetingLinkResult.value;
      } else if (formData.meetingType === "inPerson") {
        const cleanAddress = formData.meetingAddress.trim();
        if (!cleanAddress) {
          setError("Please enter an address for in-person swaps");
          setLoading(false);
          return;
        }
        normalizedMeetingAddress = cleanAddress;
      } else {
        setError("Please choose a meeting type");
        setLoading(false);
        return;
      }

      const data = await withMinimumDelay(async () => {
        const res = await fetchWithAuth(API_URL + "/api/swaps", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientId: user._id,
            skillOffered: formData.skillOffered,
            skillWanted: formData.skillWanted,
            scheduledDate: scheduledDateTime,
            duration: parseInt(formData.duration, 10),
            totalSessions: parsedTotalSessions,
            milestones: normalizedMilestones.map((title) => ({ title })),
            meetingType: formData.meetingType,
            meetingLink: normalizedMeetingLink,
            meetingAddress: normalizedMeetingAddress,
            notes: formData.notes,
          }),
        });

        if (!res.ok) {
          const payload = await res.json();
          throw new Error(payload.message || "Failed to send swap request");
        }

        return res.json();
      });

      onSuccess(data);
    } catch (err) {
      console.error("Error sending swap request:", err);
      setError(err.message || "Failed to send swap request");
    } finally {
      setLoading(false);
    }
  }
  // Handle submit action.
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setAvailabilityWarning("");

    if (
      !formData.skillOffered ||
      !formData.skillWanted ||
      !formData.scheduledDate ||
      !formData.scheduledTime
    ) {
      setError("Please fill in all required fields");
      return;
    }

    const parsedTotalSessions = parseInt(formData.totalSessions, 10);
    const normalizedMilestones = (formData.milestoneTitles || []).map((title) => title.trim());

    if (
      !Number.isInteger(parsedTotalSessions) ||
      parsedTotalSessions < 1 ||
      parsedTotalSessions > 20
    ) {
      setError("Total sessions must be between 1 and 20");
      return;
    }

    if (
      normalizedMilestones.length !== parsedTotalSessions ||
      normalizedMilestones.some((title) => !title)
    ) {
      setError("Please add a goal for every session milestone");
      return;
    }

    if (!currentUserTimeZone) {
      setError("Please set your profile time zone before requesting a swap");
      return;
    }

    let scheduledDateObj;
    try {
      const scheduledDateTime = buildIsoFromProfileTimeZone(
        formData.scheduledDate,
        formData.scheduledTime,
        currentUserTimeZone
      );
      scheduledDateObj = new Date(scheduledDateTime);
    } catch (err) {
      setError("Invalid scheduled date or time");
      return;
    }

    const durationMinutes = parseInt(formData.duration, 10) || 60;
    const requesterAvailable = validateUserAvailability(
      currentUserAvailability,
      currentUserTimeZone,
      scheduledDateObj,
      durationMinutes
    );
    const recipientAvailable = validateUserAvailability(
      user.availability || [],
      user.timeZone || "",
      scheduledDateObj,
      durationMinutes
    );

    if (!requesterAvailable || !recipientAvailable) {
      const warningParts = [];

      if (!requesterAvailable) {
        warningParts.push("your listed availability");
      }

      if (!recipientAvailable) {
        warningParts.push(`${user.name}'s listed availability`);
      }

      setAvailabilityWarning(
        `This time falls outside ${warningParts.join(" and ")}. Do you still want to send the request?`
      );
      setShowAvailabilityConfirm(true);
      return;
    }

    await submitSwapRequest();
  }

  // Get user's skills they want to learn
  const recipientSkills =
    user.skills && user.skills.length > 0
      ? user.skills.map((s) => s.skillName || s).filter(Boolean)
      : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request Swap with {user.name}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {detailsLoading ? (
          <LoadingState message="Loading swap details..." compact />
        ) : detailsError ? (
          <LoadingState message={detailsError} compact onRetry={fetchCurrentUserProfile} />
        ) : (
          <form onSubmit={handleSubmit} className="swap-request-form">
            <fieldset className="swap-request-fieldset" disabled={loading}>
              <div className="form-group">
                <label htmlFor="skillOffered">
                  Skill You'll Teach <span className="required">*</span>
                </label>
                <select
                  id="skillOffered"
                  name="skillOffered"
                  value={formData.skillOffered}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a skill...</option>
                  {currentUserSkills.map((skill, idx) => (
                    <option key={idx} value={skill.skillName}>
                      {skill.skillName}
                    </option>
                  ))}
                </select>
                {currentUserSkills.length === 0 && (
                  <p className="form-hint">
                    Add skills to your profile to offer them in swaps
                  </p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="skillWanted">
                  Skill You Want to Learn <span className="required">*</span>
                </label>
                <select
                  id="skillWanted"
                  name="skillWanted"
                  value={formData.skillWanted}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a skill...</option>
                  {recipientSkills.map((skill, idx) => (
                    <option key={idx} value={skill}>
                      {skill}
                    </option>
                  ))}
                </select>
                {recipientSkills.length === 0 && (
                  <p className="form-hint">
                    This user hasn't listed any skills yet
                  </p>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="scheduledDate">
                    Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    id="scheduledDate"
                    name="scheduledDate"
                    value={formData.scheduledDate}
                    onChange={handleChange}
                    min={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="scheduledTime">
                    Time <span className="required">*</span>
                  </label>
                  <input
                    type="time"
                    id="scheduledTime"
                    name="scheduledTime"
                    value={formData.scheduledTime}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="duration">Duration (minutes)</label>
                <select
                  id="duration"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                >
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <div className="form-group">
                <label>Suggested Time Slots</label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={fetchSuggestedSlots}
                  disabled={loading || suggestionsLoading}
                >
                  {suggestionsLoading ? "Finding..." : "Suggest Times"}
                </button>

                {suggestionsError && <div className="form-error">{suggestionsError}</div>}

                {suggestedSlots.length > 0 && (
                  <div className="suggested-slots">
                    {suggestedSlots.map((slot) => {
                      const durationMinutes = parseInt(formData.duration, 10) || 60;
                      const requesterLocalLabel =
                        formatLocalSession(slot.scheduledDate, currentUserTimeZone, durationMinutes) ||
                        slot.requesterLocal ||
                        slot.scheduledDate;
                      const recipientLocalLabel =
                        formatLocalSession(slot.scheduledDate, user.timeZone || "", durationMinutes) ||
                        slot.recipientLocal ||
                        slot.scheduledDate;

                      return (
                        <button
                          key={slot.scheduledDate}
                          type="button"
                          className="suggested-slot-btn"
                          onClick={() => applySuggestedSlot(slot.scheduledDate)}
                          disabled={loading}
                        >
                          <span>{requesterLocalLabel}</span>
                          <small>{user.name}: {recipientLocalLabel}</small>
                          {slot.reason && (
                            <small className="suggested-slot-reason">Why: {slot.reason}</small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {suggestedSlots.length === 0 && !suggestionsLoading && !suggestionsError && (
                  <p className="form-hint">Click Suggest Times to find open slots for both of you.</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="totalSessions">
                  Number of Sessions <span className="required">*</span>
                </label>
                <input
                  type="number"
                  id="totalSessions"
                  name="totalSessions"
                  value={formData.totalSessions}
                  onChange={handleChange}
                  min="1"
                  max="20"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Session Goals <span className="required">*</span>
                </label>
                <div className="milestone-list">
                  {formData.milestoneTitles.map((title, index) => (
                    <input
                      key={`milestone-${index}`}
                      type="text"
                      value={title}
                      onChange={(event) => handleMilestoneChange(index, event.target.value)}
                      placeholder={`Milestone ${index + 1} goal`}
                      required
                    />
                  ))}
                </div>
                <p className="form-hint">Add one concrete outcome for each session.</p>
              </div>

              <div className="form-group">
                <label htmlFor="meetingType">
                  Meeting Type <span className="required">*</span>
                </label>
                <select
                  id="meetingType"
                  name="meetingType"
                  value={formData.meetingType}
                  onChange={handleChange}
                  required
                >
                  <option value="virtual">Virtual</option>
                  <option value="inPerson">In-Person</option>
                </select>
              </div>

              {formData.meetingType === "virtual" ? (
                <div className="form-group">
                  <label htmlFor="meetingLink">
                    Meeting Link <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="meetingLink"
                    name="meetingLink"
                    value={formData.meetingLink}
                    onChange={handleChange}
                    placeholder="Zoom, Google Meet, or Teams link"
                    required
                  />
                  <p className="form-hint">
                    Use a Zoom, Google Meet, or Microsoft Teams link.
                  </p>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="meetingAddress">
                    Address <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="meetingAddress"
                    name="meetingAddress"
                    value={formData.meetingAddress}
                    onChange={handleChange}
                    placeholder="Enter the in-person meeting address"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="notes">Notes (optional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any additional information..."
                  rows="3"
                />
              </div>

              {error && <div className="form-error">{error}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || currentUserSkills.length === 0 || recipientSkills.length === 0}
                >
                  {loading ? "Sending..." : "Send Request"}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </div>

      {showAvailabilityConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowAvailabilityConfirm(false)}
        >
          <div
            className="modal-content modal-content--confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Outside availability</h2>
              <button
                className="modal-close"
                onClick={() => setShowAvailabilityConfirm(false)}
              >
                ×
              </button>
            </div>

            <div className="swap-confirm-body">
              <p>{availabilityWarning}</p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAvailabilityConfirm(false)}
                disabled={loading}
              >
                Go Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  setShowAvailabilityConfirm(false);
                  await submitSwapRequest();
                }}
                disabled={loading}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SwapRequestModal;