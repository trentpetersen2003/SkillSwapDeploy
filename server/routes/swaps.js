// server/routes/swaps.js
const express = require("express");
const router = express.Router();
const Swap = require("../models/Swap");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { isProfileSetupComplete } = require("../services/profileSetup");
const {
  sendSwapRequestEmail,
  sendSwapAcceptedEmail,
  sendSwapCancelledEmail,
} = require("../services/email");
const {
  removeSwapEventForUser,
  shouldRemoveCancelledSwaps,
  listUpcomingExternalEventsForUser,
  upsertSwapEventForUser,
} = require("../services/googleCalendar");

const PROFILE_SETUP_REQUIRED_MESSAGE =
  "Finish your profile setup before you use swaps.";

function isParticipant(swap, userId) {
  return swap.requester.toString() === userId || swap.recipient.toString() === userId;
}

function isRequester(swap, userId) {
  return swap.requester.toString() === userId;
}

function hasBothConfirmations(swap) {
  return Boolean(swap.requesterConfirmedAt && swap.recipientConfirmedAt);
}

function emailPrefEnabled(user, key) {
  return user?.notificationPreferences?.[key] !== false;
}

const CALENDAR_SELECT_FIELDS =
  "name username email notificationPreferences googleCalendar.connected googleCalendar.accountEmail googleCalendar.calendarId googleCalendar.syncAcceptedSwaps googleCalendar.removeCancelledSwaps googleCalendar.lastConnectedAt +googleCalendar.refreshTokenCiphertext +googleCalendar.refreshTokenIv +googleCalendar.refreshTokenAuthTag +googleCalendar.refreshTokenUpdatedAt";

const GOOGLE_CALENDAR_LOOKAHEAD_BUFFER_MS = 24 * 60 * 60 * 1000;

function getGoogleCalendarLookupWindow(startDate, endDate) {
  return {
    timeMin: new Date(startDate.getTime() - GOOGLE_CALENDAR_LOOKAHEAD_BUFFER_MS).toISOString(),
    timeMax: new Date(endDate.getTime() + GOOGLE_CALENDAR_LOOKAHEAD_BUFFER_MS).toISOString(),
  };
}

function parseGoogleCalendarEventBoundary(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getGoogleCalendarEventWindow(event) {
  const start = parseGoogleCalendarEventBoundary(event?.start?.dateTime || event?.start?.date);
  const end = parseGoogleCalendarEventBoundary(event?.end?.dateTime || event?.end?.date);

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

function doesGoogleCalendarEventConflict(event, startDate, endDate) {
  const window = getGoogleCalendarEventWindow(event);
  if (!window) {
    return false;
  }

  return startDate < window.end && endDate > window.start;
}

function findGoogleCalendarConflict(events, startDate, endDate) {
  return (Array.isArray(events) ? events : []).find((event) =>
    doesGoogleCalendarEventConflict(event, startDate, endDate)
  ) || null;
}

function formatGoogleCalendarConflictMessage(event) {
  const title = String(event?.title || event?.summary || "Another event").trim() || "Another event";
  const window = getGoogleCalendarEventWindow(event);

  if (!window) {
    return `That time conflicts with another event on your Google Calendar (${title}).`;
  }

  const startsAt = window.start.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `That time conflicts with your Google Calendar event: ${title} (${startsAt}).`;
}

async function getGoogleCalendarEventsForUser(user, startDate, endDate) {
  if (!user) {
    return [];
  }

  const { timeMin, timeMax } = getGoogleCalendarLookupWindow(startDate, endDate);
  return listUpcomingExternalEventsForUser({
    user,
    timeMin,
    timeMax,
  });
}

async function syncConfirmedSwapToCalendars({ swap, requesterUser, recipientUser }) {
  const [requesterResult, recipientResult] = await Promise.allSettled([
    upsertSwapEventForUser({
      user: requesterUser,
      swap,
      userRole: "requester",
      partnerUser: recipientUser,
    }),
    upsertSwapEventForUser({
      user: recipientUser,
      swap,
      userRole: "recipient",
      partnerUser: requesterUser,
    }),
  ]);

  if (requesterResult.status === "rejected") {
    throw requesterResult.reason;
  }

  if (recipientResult.status === "rejected") {
    throw recipientResult.reason;
  }

  const requesterEventId = requesterResult.value || "";
  const recipientEventId = recipientResult.value || "";

  const nextSyncState = {
    requesterEventId,
    recipientEventId,
    lastSyncedAt: new Date(),
  };

  const existingSync = swap.googleCalendarSync || {};
  const hasChanged =
    existingSync.requesterEventId !== nextSyncState.requesterEventId ||
    existingSync.recipientEventId !== nextSyncState.recipientEventId;

  if (hasChanged) {
    swap.googleCalendarSync = nextSyncState;
    await swap.save();
  }
}

async function removeCancelledSwapFromCalendars({ swap, requesterUser, recipientUser }) {
  const requesterEventId = swap.googleCalendarSync?.requesterEventId || "";
  const recipientEventId = swap.googleCalendarSync?.recipientEventId || "";
  const requesterShouldRemove = shouldRemoveCancelledSwaps(requesterUser);
  const recipientShouldRemove = shouldRemoveCancelledSwaps(recipientUser);

  const [requesterResult, recipientResult] = await Promise.allSettled([
    requesterShouldRemove
      ? removeSwapEventForUser({
          user: requesterUser,
          eventId: requesterEventId,
        })
      : Promise.resolve(),
    recipientShouldRemove
      ? removeSwapEventForUser({
          user: recipientUser,
          eventId: recipientEventId,
        })
      : Promise.resolve(),
  ]);

  if (requesterResult.status === "rejected") {
    throw requesterResult.reason;
  }

  if (recipientResult.status === "rejected") {
    throw recipientResult.reason;
  }

  const nextSyncState = {
    requesterEventId: requesterShouldRemove ? "" : requesterEventId,
    recipientEventId: recipientShouldRemove ? "" : recipientEventId,
    lastSyncedAt: new Date(),
  };

  const hasChanged =
    (swap.googleCalendarSync?.requesterEventId || "") !== nextSyncState.requesterEventId ||
    (swap.googleCalendarSync?.recipientEventId || "") !== nextSyncState.recipientEventId;

  const hadEvents = Boolean(requesterEventId || recipientEventId);
  if (hadEvents) {
    swap.googleCalendarSync = hasChanged ? nextSyncState : {
      ...(swap.googleCalendarSync || {}),
      lastSyncedAt: new Date(),
    };
    await swap.save();
  }
}

function normalizeMilestones(rawMilestones = [], totalSessions = 1) {
  const sessionCount = Number(totalSessions);
  if (!Number.isInteger(sessionCount) || sessionCount < 1 || sessionCount > 20) {
    return { error: "totalSessions must be an integer between 1 and 20" };
  }

  if (!Array.isArray(rawMilestones)) {
    return { error: "milestones must be an array" };
  }

  if (rawMilestones.length === 0) {
    const defaultMilestones = Array.from({ length: sessionCount }, (_, index) => ({
      title: `Session ${index + 1} goal`,
      dueDate: undefined,
      completed: false,
      completedAt: null,
    }));

    return { milestones: defaultMilestones, totalSessions: sessionCount };
  }

  if (rawMilestones.length !== sessionCount) {
    return { error: "milestones count must match totalSessions" };
  }

  const normalized = rawMilestones.map((milestone, index) => {
    const title = typeof milestone?.title === "string" ? milestone.title.trim() : "";
    if (!title) {
      return { error: `Milestone ${index + 1} must include a title` };
    }

    let dueDate = undefined;
    if (milestone?.dueDate) {
      const parsedDate = new Date(milestone.dueDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return { error: `Milestone ${index + 1} has an invalid dueDate` };
      }
      dueDate = parsedDate;
    }

    return {
      title,
      dueDate,
      completed: false,
      completedAt: null,
    };
  });

  const firstError = normalized.find((entry) => entry.error);
  if (firstError) {
    return { error: firstError.error };
  }

  return { milestones: normalized, totalSessions: sessionCount };
}
// Availability helpers
const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function parseUtcOffsetToMinutes(timeZone) {
  if (typeof timeZone !== "string") return null;

  const match = timeZone.match(/^UTC([+-])(\d{2}):(\d{2})$/i);
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);

  return sign * (hours * 60 + minutes);
}

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
function describeLocalSession(date, timeZone, durationMinutes) {
  const offsetMinutes = parseUtcOffsetToMinutes(timeZone);
  if (offsetMinutes === null) {
    return "invalid local time";
  }

  const localStart = getLocalDayAndMinutes(date, offsetMinutes);
  const localEnd = localStart.minutes + durationMinutes;

  return `${localStart.day} ${formatMinutes(localStart.minutes)} - ${formatMinutes(localEnd)} (${timeZone})`;
}

function roundUpToInterval(date, intervalMinutes) {
  const intervalMs = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / intervalMs) * intervalMs);
}

function getDateRangeEnd(daysAhead) {
  const end = new Date();
  end.setDate(end.getDate() + daysAhead);
  return end;
}

function isSwapConflict(existingSwap, startDate, durationMinutes) {
  const existingStart = new Date(existingSwap.scheduledDate);
  const existingDuration = Number(existingSwap.duration || 60);
  const existingEnd = new Date(existingStart.getTime() + existingDuration * 60 * 1000);
  const candidateEnd = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  return startDate < existingEnd && candidateEnd > existingStart;
}

function hasConflict(existingSwaps, startDate, durationMinutes) {
  return existingSwaps.some((swap) => isSwapConflict(swap, startDate, durationMinutes));
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isWeekendDay(day) {
  return day === "Saturday" || day === "Sunday";
}

function isEveningMinutes(minutes) {
  return minutes >= 17 * 60 && minutes < 22 * 60;
}

function isWorkHoursMinutes(minutes) {
  return minutes >= 9 * 60 && minutes < 17 * 60;
}

function scoreSuggestedSlot({
  date,
  requesterTimeZone,
  recipientTimeZone,
  rangeStart,
}) {
  const requesterOffset = parseUtcOffsetToMinutes(requesterTimeZone);
  const recipientOffset = parseUtcOffsetToMinutes(recipientTimeZone);

  if (requesterOffset === null || recipientOffset === null) {
    return Number.POSITIVE_INFINITY;
  }

  const requesterLocal = getLocalDayAndMinutes(date, requesterOffset);
  const recipientLocal = getLocalDayAndMinutes(date, recipientOffset);

  const minutesFromNow = Math.max(0, (date.getTime() - rangeStart.getTime()) / (60 * 1000));
  let score = minutesFromNow / 60;

  const requesterWeekend = isWeekendDay(requesterLocal.day);
  const recipientWeekend = isWeekendDay(recipientLocal.day);
  if (requesterWeekend && recipientWeekend) {
    score -= 24;
  } else if (requesterWeekend || recipientWeekend) {
    score -= 8;
  }

  const requesterEvening = isEveningMinutes(requesterLocal.minutes);
  const recipientEvening = isEveningMinutes(recipientLocal.minutes);
  if (requesterEvening && recipientEvening) {
    score -= 16;
  } else if (requesterEvening || recipientEvening) {
    score -= 6;
  }

  if (isWorkHoursMinutes(requesterLocal.minutes) && isWorkHoursMinutes(recipientLocal.minutes)) {
    score += 6;
  }

  return score;
}

function getSuggestedSlotReason({ date, requesterTimeZone, recipientTimeZone }) {
  const requesterOffset = parseUtcOffsetToMinutes(requesterTimeZone);
  const recipientOffset = parseUtcOffsetToMinutes(recipientTimeZone);

  if (requesterOffset === null || recipientOffset === null) {
    return "Mutual availability";
  }

  const requesterLocal = getLocalDayAndMinutes(date, requesterOffset);
  const recipientLocal = getLocalDayAndMinutes(date, recipientOffset);

  const requesterWeekend = isWeekendDay(requesterLocal.day);
  const recipientWeekend = isWeekendDay(recipientLocal.day);
  const requesterEvening = isEveningMinutes(requesterLocal.minutes);
  const recipientEvening = isEveningMinutes(recipientLocal.minutes);

  if (requesterWeekend && recipientWeekend && requesterEvening && recipientEvening) {
    return "Weekend evening overlap";
  }

  if (requesterEvening && recipientEvening) {
    return "Both users evening-friendly";
  }

  if (requesterWeekend && recipientWeekend) {
    return "Both users weekend-friendly";
  }

  if (requesterEvening || recipientEvening) {
    return "At least one user in evening hours";
  }

  return "Earliest mutual slot";
}
function formatAvailabilityForDay(availability = [], day, timeZone = "") {
  const daySlots = (availability || []).filter((slot) => slot.day === day);

  if (daySlots.length === 0) {
    return `not available on ${day}${timeZone ? ` (${timeZone})` : ""}`;
  }

  const slotsText = daySlots.map((slot) => slot.timeRange).join(", ");
  return `${day} ${slotsText}${timeZone ? ` (${timeZone})` : ""}`;
}
// Supported virtual meeting providers
const RECOGNIZED_VIRTUAL_MEETING_HOSTS = [
  "zoom.us",
  "meet.google.com",
  "teams.microsoft.com",
  "teams.live.com",
  "teams.microsoft.us",
];

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
// Normalize meeting fields and keep location populated for existing UI
function normalizeMeetingDetails(meetingType, meetingLink, meetingAddress) {
  const normalizedType =
    typeof meetingType === "string" ? meetingType.trim() : "";

  if (!["virtual", "inPerson"].includes(normalizedType)) {
    return {
      error: "Meeting type must be either virtual or in-person",
    };
  }

  if (normalizedType === "virtual") {
    const normalizedLink = normalizeMeetingLink(meetingLink);
    if (normalizedLink.error) {
      return { error: normalizedLink.error };
    }

    return {
      meetingType: "virtual",
      meetingLink: normalizedLink.value,
      meetingAddress: "",
      location: normalizedLink.value,
    };
  }

  const cleanAddress =
    typeof meetingAddress === "string" ? meetingAddress.trim() : "";

  if (!cleanAddress) {
    return { error: "Address is required for in-person swaps" };
  }

  return {
    meetingType: "inPerson",
    meetingLink: "",
    meetingAddress: cleanAddress,
    location: cleanAddress,
  };
}
function validateUserAvailability(user, scheduledDate, durationMinutes) {
  if (!user?.timeZone) {
    return { ok: false, reason: "missing time zone" };
  }

  if (!Array.isArray(user.availability) || user.availability.length === 0) {
    return { ok: false, reason: "missing availability" };
  }

  const offsetMinutes = parseUtcOffsetToMinutes(user.timeZone);
  if (offsetMinutes === null) {
    return { ok: false, reason: "invalid time zone" };
  }

  const localStart = getLocalDayAndMinutes(scheduledDate, offsetMinutes);
  const localEndMinutes = localStart.minutes + durationMinutes;

  if (localEndMinutes > 24 * 60) {
    return { ok: false, reason: "session crosses into the next day" };
  }

  const fitsSlot = user.availability.some((slot) => {
    if (slot.day !== localStart.day) return false;

    const parsedRange = parseTimeRange(slot.timeRange);
    if (!parsedRange) return false;

    return (
      localStart.minutes >= parsedRange.start &&
      localEndMinutes <= parsedRange.end
    );
  });

  if (!fitsSlot) {
    return {
      ok: false,
      reason: `outside availability on ${localStart.day}`,
    };
  }

  return { ok: true };
}

async function enforceProfileSetupComplete(userId, res) {
  const currentUser = await User.findById(userId).select(
    "name email city state timeZone availability skills skillsWanted"
  );

  if (!currentUser) {
    res.status(404).json({ message: "User not found" });
    return null;
  }

  if (!isProfileSetupComplete(currentUser)) {
    res.status(403).json({ message: PROFILE_SETUP_REQUIRED_MESSAGE });
    return null;
  }

  return currentUser;
}
// Get all swaps for the authenticated user
router.get("/", auth, async (req, res) => {
  try {
    const currentUser = await enforceProfileSetupComplete(req.userId, res);
    if (!currentUser) {
      return;
    }

    const swaps = await Swap.find({
      $or: [{ requester: req.userId }, { recipient: req.userId }],
    })
      .populate("requester", "name email username")
      .populate("recipient", "name email username")
      .sort({ scheduledDate: 1 });

    res.json(swaps);
  } catch (error) {
    console.error("Error fetching swaps:", error);
    res.status(500).json({ message: "Error fetching swaps" });
  }
});

// Get swaps for a specific date range
router.get("/range", auth, async (req, res) => {
  try {
    const currentUser = await enforceProfileSetupComplete(req.userId, res);
    if (!currentUser) {
      return;
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start and end dates are required" });
    }

    const swaps = await Swap.find({
      $or: [{ requester: req.userId }, { recipient: req.userId }],
      scheduledDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
      .populate("requester", "name email username")
      .populate("recipient", "name email username")
      .sort({ scheduledDate: 1 });

    res.json(swaps);
  } catch (error) {
    console.error("Error fetching swaps by range:", error);
    res.status(500).json({ message: "Error fetching swaps" });
  }
});

// Suggest mutual time slots based on both users' availability and existing swaps
router.get("/suggestions", auth, async (req, res) => {
  try {
    const currentUser = await enforceProfileSetupComplete(req.userId, res);
    if (!currentUser) {
      return;
    }

    const currentUserCalendar = await User.findById(req.userId).select(CALENDAR_SELECT_FIELDS);

    const { recipientId } = req.query;
    const durationMinutes = parsePositiveInt(req.query.duration, 60);
    const daysAhead = Math.min(parsePositiveInt(req.query.daysAhead, 14), 30);
    const limit = Math.min(parsePositiveInt(req.query.limit, 8), 20);
    const intervalMinutes = Math.min(parsePositiveInt(req.query.intervalMinutes, 30), 60);

    if (!recipientId) {
      return res.status(400).json({ message: "recipientId is required" });
    }

    if (recipientId === req.userId) {
      return res.status(400).json({ message: "Cannot suggest slots for yourself" });
    }

    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
      return res.status(400).json({ message: "Duration must be between 15 and 240 minutes" });
    }

    const recipient = await User.findById(recipientId).select(
      "blockedUsers availability timeZone name email googleCalendar.connected googleCalendar.accountEmail googleCalendar.calendarId googleCalendar.syncAcceptedSwaps googleCalendar.removeCancelledSwaps googleCalendar.lastConnectedAt +googleCalendar.refreshTokenCiphertext +googleCalendar.refreshTokenIv +googleCalendar.refreshTokenAuthTag +googleCalendar.refreshTokenUpdatedAt"
    );
    const requesterPrivacy = await User.findById(req.userId).select("blockedUsers");

    if (!recipient || !requesterPrivacy) {
      return res.status(404).json({ message: "User not found" });
    }

    const requesterBlockedRecipient = (requesterPrivacy.blockedUsers || []).some(
      (id) => id.toString() === recipientId
    );
    const recipientBlockedRequester = (recipient.blockedUsers || []).some(
      (id) => id.toString() === req.userId
    );

    if (requesterBlockedRecipient || recipientBlockedRequester) {
      return res.status(403).json({ message: "Cannot suggest slots with a blocked user" });
    }

    if (!currentUser.timeZone || !recipient.timeZone) {
      return res.status(400).json({ message: "Both users must set a time zone" });
    }

    if (!Array.isArray(currentUser.availability) || currentUser.availability.length === 0) {
      return res.status(400).json({ message: "You must set availability first" });
    }

    if (!Array.isArray(recipient.availability) || recipient.availability.length === 0) {
      return res.status(400).json({ message: "This user has not set availability yet" });
    }

    const rangeStart = new Date();
    const rangeEnd = getDateRangeEnd(daysAhead);

    const [requesterGoogleEvents, recipientGoogleEvents] = await Promise.all([
      getGoogleCalendarEventsForUser(currentUserCalendar, rangeStart, rangeEnd),
      getGoogleCalendarEventsForUser(recipient, rangeStart, rangeEnd),
    ]);

    const existingSwaps = await Swap.find({
      status: { $in: ["pending", "confirmed"] },
      scheduledDate: { $gte: rangeStart, $lte: rangeEnd },
      $or: [
        { requester: req.userId },
        { recipient: req.userId },
        { requester: recipientId },
        { recipient: recipientId },
      ],
    }).select("scheduledDate duration requester recipient status");

    const requesterSwaps = existingSwaps.filter(
      (swap) =>
        swap.requester.toString() === req.userId || swap.recipient.toString() === req.userId
    );
    const recipientSwaps = existingSwaps.filter(
      (swap) =>
        swap.requester.toString() === recipientId || swap.recipient.toString() === recipientId
    );

    const candidateSlots = [];
    let cursor = roundUpToInterval(new Date(), intervalMinutes);

    while (cursor <= rangeEnd) {
      const requesterAvailable = validateUserAvailability(currentUser, cursor, durationMinutes).ok;
      const recipientAvailable = validateUserAvailability(recipient, cursor, durationMinutes).ok;

      if (requesterAvailable && recipientAvailable) {
        const requesterBusy = hasConflict(requesterSwaps, cursor, durationMinutes);
        const recipientBusy = hasConflict(recipientSwaps, cursor, durationMinutes);
        const cursorEnd = new Date(cursor.getTime() + durationMinutes * 60 * 1000);
        const requesterGoogleBusy = findGoogleCalendarConflict(
          requesterGoogleEvents,
          cursor,
          cursorEnd
        );
        const recipientGoogleBusy = findGoogleCalendarConflict(
          recipientGoogleEvents,
          cursor,
          cursorEnd
        );

        if (!requesterBusy && !recipientBusy && !requesterGoogleBusy && !recipientGoogleBusy) {
          candidateSlots.push({
            date: new Date(cursor),
            score: scoreSuggestedSlot({
              date: cursor,
              requesterTimeZone: currentUser.timeZone,
              recipientTimeZone: recipient.timeZone,
              rangeStart,
            }),
          });
        }
      }

      cursor = new Date(cursor.getTime() + intervalMinutes * 60 * 1000);
    }

    const suggestions = candidateSlots
      .sort((a, b) => {
        if (a.score !== b.score) {
          return a.score - b.score;
        }

        return a.date.getTime() - b.date.getTime();
      })
      .slice(0, limit)
      .map((entry) => ({
        scheduledDate: entry.date.toISOString(),
        requesterLocal: describeLocalSession(entry.date, currentUser.timeZone, durationMinutes),
        recipientLocal: describeLocalSession(entry.date, recipient.timeZone, durationMinutes),
        reason: getSuggestedSlotReason({
          date: entry.date,
          requesterTimeZone: currentUser.timeZone,
          recipientTimeZone: recipient.timeZone,
        }),
      }));

    return res.json({
      duration: durationMinutes,
      intervalMinutes,
      daysAhead,
      suggestions,
    });
  } catch (error) {
    console.error("Error suggesting swap slots:", error);
    return res.status(500).json({ message: "Error generating slot suggestions" });
  }
});

// Create a new swap
router.post("/", auth, async (req, res) => {
  try {
    const setupReadyUser = await enforceProfileSetupComplete(req.userId, res);
    if (!setupReadyUser) {
      return;
    }
    const {
      recipientId,
      skillOffered,
      skillWanted,
      scheduledDate,
      duration,
      meetingType,
      meetingLink,
      meetingAddress,
      notes,
      totalSessions,
      milestones,
    } = req.body;

    if (!recipientId || !skillOffered || !skillWanted || !scheduledDate) {
      return res.status(400).json({
        message: "Recipient, skills offered/wanted, and scheduled date are required",
      });
    }
    const scheduledDateObj = new Date(scheduledDate);
    if (Number.isNaN(scheduledDateObj.getTime())) {
      return res.status(400).json({ message: "Invalid scheduled date" });
    }

    if (scheduledDateObj <= new Date()) {
      return res.status(400).json({ message: "Scheduled date must be in the future" });
    }

    const durationMinutes = Number(duration || 60);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
      return res.status(400).json({ message: "Duration must be between 15 and 240 minutes" });
    }
    const normalizedMilestones = normalizeMilestones(milestones, totalSessions || 1);
    if (normalizedMilestones.error) {
      return res.status(400).json({ message: normalizedMilestones.error });
    }
    // Validate meeting type details before creating the swap
    const normalizedMeeting = normalizeMeetingDetails(
      meetingType,
      meetingLink,
      meetingAddress
    );

    if (normalizedMeeting.error) {
      return res.status(400).json({ message: normalizedMeeting.error });
    }
    // Don't allow swapping with yourself
    if (recipientId === req.userId) {
      return res.status(400).json({ message: "Cannot create a swap with yourself" });
    }

    const [requester, recipient] = await Promise.all([
      User.findById(req.userId).select(
        "blockedUsers availability timeZone name email notificationPreferences googleCalendar.connected googleCalendar.accountEmail googleCalendar.calendarId googleCalendar.syncAcceptedSwaps googleCalendar.removeCancelledSwaps googleCalendar.lastConnectedAt +googleCalendar.refreshTokenCiphertext +googleCalendar.refreshTokenIv +googleCalendar.refreshTokenAuthTag +googleCalendar.refreshTokenUpdatedAt"
      ),
      User.findById(recipientId).select(
        "blockedUsers availability timeZone name email notificationPreferences googleCalendar.connected googleCalendar.accountEmail googleCalendar.calendarId googleCalendar.syncAcceptedSwaps googleCalendar.removeCancelledSwaps googleCalendar.lastConnectedAt +googleCalendar.refreshTokenCiphertext +googleCalendar.refreshTokenIv +googleCalendar.refreshTokenAuthTag +googleCalendar.refreshTokenUpdatedAt"
      ),
    ]);

    if (!requester || !recipient) {
      return res.status(404).json({ message: "User not found" });
    }

    const requesterBlockedRecipient = (requester.blockedUsers || []).some(
      (id) => id.toString() === recipientId
    );
    const recipientBlockedRequester = (recipient.blockedUsers || []).some(
      (id) => id.toString() === req.userId
    );

    if (requesterBlockedRecipient || recipientBlockedRequester) {
      return res.status(403).json({ message: "Cannot create swap with a blocked user" });
    }

    if (!requester.timeZone || !recipient.timeZone) {
      return res.status(400).json({
        message: "Both users must have a time zone set before creating a swap request",
      });
    }

    if (!Array.isArray(requester.availability) || requester.availability.length === 0) {
      return res.status(400).json({
        message: "You must set your availability before creating a swap request",
      });
    }

    if (!Array.isArray(recipient.availability) || recipient.availability.length === 0) {
      return res.status(400).json({
        message: "This user has not set availability yet",
      });
    }

    const [requesterGoogleEvents, recipientGoogleEvents] = await Promise.all([
      getGoogleCalendarEventsForUser(
        requester,
        scheduledDateObj,
        new Date(scheduledDateObj.getTime() + durationMinutes * 60 * 1000)
      ),
      getGoogleCalendarEventsForUser(
        recipient,
        scheduledDateObj,
        new Date(scheduledDateObj.getTime() + durationMinutes * 60 * 1000)
      ),
    ]);

    const requesterGoogleConflict = findGoogleCalendarConflict(
      requesterGoogleEvents,
      scheduledDateObj,
      new Date(scheduledDateObj.getTime() + durationMinutes * 60 * 1000)
    );

    if (requesterGoogleConflict) {
      return res.status(400).json({
        message: formatGoogleCalendarConflictMessage(requesterGoogleConflict),
      });
    }

    const recipientGoogleConflict = findGoogleCalendarConflict(
      recipientGoogleEvents,
      scheduledDateObj,
      new Date(scheduledDateObj.getTime() + durationMinutes * 60 * 1000)
    );

    if (recipientGoogleConflict) {
      return res.status(400).json({
        message: "That time conflicts with another event on this user's Google Calendar.",
      });
    }

    const requesterAvailabilityCheck = validateUserAvailability(
      requester,
      scheduledDateObj,
      durationMinutes
    );
    if (!requesterAvailabilityCheck.ok) {
      const requesterLocal = getLocalDayAndMinutes(
        scheduledDateObj,
        parseUtcOffsetToMinutes(requester.timeZone)
      );

      return res.status(400).json({
        message: `That time is outside your availability. In your time, this request is ${describeLocalSession(
          scheduledDateObj,
          requester.timeZone,
          durationMinutes
        )}. You are only available ${formatAvailabilityForDay(
          requester.availability,
          requesterLocal.day,
          requester.timeZone
        )}.`,
      });
    }

    const recipientAvailabilityCheck = validateUserAvailability(
      recipient,
      scheduledDateObj,
      durationMinutes
    );

    if (!recipientAvailabilityCheck.ok) {
      const recipientLocal = getLocalDayAndMinutes(
        scheduledDateObj,
        parseUtcOffsetToMinutes(recipient.timeZone)
      );

      return res.status(400).json({
        message: `That time is outside this user's availability. In their time, this request is ${describeLocalSession(
          scheduledDateObj,
          recipient.timeZone,
          durationMinutes
        )}. They are only available ${formatAvailabilityForDay(
          recipient.availability,
          recipientLocal.day,
          recipient.timeZone
        )}.`,
      });
    }
    const newSwap = new Swap({
      requester: req.userId,
      recipient: recipientId,
      skillOffered,
      skillWanted,
      scheduledDate: scheduledDateObj,
      duration: durationMinutes,
      location: normalizedMeeting.location,
      meetingType: normalizedMeeting.meetingType,
      meetingLink: normalizedMeeting.meetingLink,
      meetingAddress: normalizedMeeting.meetingAddress,
      notes,
      totalSessions: normalizedMilestones.totalSessions,
      milestones: normalizedMilestones.milestones,
      status: "pending",
    });

    await newSwap.save();

    const populatedSwap = await Swap.findById(newSwap._id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    try {
      await sendSwapRequestEmail({
        to: recipient.email,
        recipientName: recipient.name,
        requesterName: requester.name,
        skillOffered: newSwap.skillOffered,
        skillWanted: newSwap.skillWanted,
        scheduledDate: newSwap.scheduledDate,
        preferenceEnabled: emailPrefEnabled(recipient, "swapRequestEmail"),
      });
    } catch (emailError) {
      console.error("Error sending swap request email:", emailError);
    }

    res.status(201).json(populatedSwap);
  } catch (error) {
    console.error("Error creating swap:", error);
    res.status(500).json({ message: "Error creating swap" });
  }
});

// Update swap status
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const currentUser = await enforceProfileSetupComplete(req.userId, res);
    if (!currentUser) {
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const swap = await Swap.findById(id);

    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    // Only the recipient can confirm, or either party can cancel
    if (
      status === "confirmed" &&
      swap.recipient.toString() !== req.userId
    ) {
      return res.status(403).json({ message: "Only recipient can confirm" });
    }

    if (["cancelled", "completed"].includes(status) && !isParticipant(swap, req.userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (status === "completed") {
      const hasIncompleteMilestones = (swap.milestones || []).some(
        (milestone) => !milestone.completed
      );

      if (hasIncompleteMilestones) {
        return res.status(400).json({
          message: "Complete all milestones before marking this swap completed",
        });
      }

      if (!hasBothConfirmations(swap)) {
        return res.status(400).json({
          message: "Both participants must confirm the session before completion",
        });
      }

      if (!swap.completedAt) {
        swap.completedAt = new Date();
      }
    }

    if (status !== "completed") {
      swap.completedAt = null;
    }

    swap.status = status;
    await swap.save();

    const [requesterUser, recipientUser] = await Promise.all([
      User.findById(swap.requester).select(CALENDAR_SELECT_FIELDS),
      User.findById(swap.recipient).select(CALENDAR_SELECT_FIELDS),
    ]);

    if (status === "confirmed" && requesterUser && recipientUser) {
      try {
        await sendSwapAcceptedEmail({
          to: requesterUser.email,
          requesterName: requesterUser.name,
          recipientName: recipientUser.name,
          skillOffered: swap.skillOffered,
          skillWanted: swap.skillWanted,
          scheduledDate: swap.scheduledDate,
          preferenceEnabled: emailPrefEnabled(requesterUser, "swapConfirmedEmail"),
        });
      } catch (emailError) {
        console.error("Error sending swap accepted email:", emailError);
      }
    }

    if (status === "cancelled" && requesterUser && recipientUser) {
      const cancelledByRequester = swap.requester.toString() === req.userId;
      const targetUser = cancelledByRequester ? recipientUser : requesterUser;
      const actorUser = cancelledByRequester ? requesterUser : recipientUser;

      try {
        await sendSwapCancelledEmail({
          to: targetUser.email,
          recipientName: targetUser.name,
          actorName: actorUser.name,
          skillOffered: swap.skillOffered,
          skillWanted: swap.skillWanted,
          scheduledDate: swap.scheduledDate,
          preferenceEnabled: emailPrefEnabled(targetUser, "swapCancelledEmail"),
        });
      } catch (emailError) {
        console.error("Error sending swap cancelled email:", emailError);
      }
    }

    if (status === "confirmed" && requesterUser && recipientUser) {
      try {
        await syncConfirmedSwapToCalendars({
          swap,
          requesterUser,
          recipientUser,
        });
      } catch (calendarError) {
        console.error("Error syncing confirmed swap to Google Calendar:", calendarError);
      }
    }

    if (status === "cancelled" && requesterUser && recipientUser) {
      try {
        await removeCancelledSwapFromCalendars({
          swap,
          requesterUser,
          recipientUser,
        });
      } catch (calendarError) {
        console.error("Error removing cancelled swap from Google Calendar:", calendarError);
      }
    }

    const updatedSwap = await Swap.findById(id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    res.json(updatedSwap);
  } catch (error) {
    console.error("Error updating swap status:", error);
    res.status(500).json({ message: "Error updating swap" });
  }
});

// Confirm a completed live session. When both users confirm, swap auto-completes.
router.patch("/:id/confirm-session", auth, async (req, res) => {
  try {
    const currentUser = await enforceProfileSetupComplete(req.userId, res);
    if (!currentUser) {
      return;
    }

    const { id } = req.params;
    const swap = await Swap.findById(id);

    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    if (!isParticipant(swap, req.userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (swap.status !== "confirmed") {
      return res.status(400).json({
        message: "Only active confirmed swaps can be session-confirmed",
      });
    }

    const hasIncompleteMilestones = (swap.milestones || []).some(
      (milestone) => !milestone.completed
    );

    if (hasIncompleteMilestones) {
      return res.status(400).json({
        message: "Complete all milestones before confirming the session",
      });
    }

    if (isRequester(swap, req.userId)) {
      swap.requesterConfirmedAt = swap.requesterConfirmedAt || new Date();
    } else {
      swap.recipientConfirmedAt = swap.recipientConfirmedAt || new Date();
    }

    if (hasBothConfirmations(swap)) {
      swap.status = "completed";
      swap.completedAt = swap.completedAt || new Date();
    }

    await swap.save();

    const updatedSwap = await Swap.findById(id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    res.json(updatedSwap);
  } catch (error) {
    console.error("Error confirming session:", error);
    res.status(500).json({ message: "Error confirming session" });
  }
});

// Submit a post-session rating for the other participant.
router.patch("/:id/review", auth, async (req, res) => {
  try {
    const currentUser = await enforceProfileSetupComplete(req.userId, res);
    if (!currentUser) {
      return;
    }

    const { id } = req.params;
    const { rating, comment } = req.body;

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be an integer from 1 to 5" });
    }

    const cleanComment = typeof comment === "string" ? comment.trim() : "";

    const swap = await Swap.findById(id);
    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    if (!isParticipant(swap, req.userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (swap.status === "cancelled" || swap.status === "pending") {
      return res.status(400).json({ message: "You can only review completed swaps" });
    }

    const hasCurrentUserConfirmed = isRequester(swap, req.userId)
      ? Boolean(swap.requesterConfirmedAt)
      : Boolean(swap.recipientConfirmedAt);

    if (swap.status === "confirmed" && !hasCurrentUserConfirmed) {
      return res.status(400).json({ message: "Confirm your session before reviewing" });
    }

    if (!swap.reviews) {
      swap.reviews = {};
    }

    const reviewField = isRequester(swap, req.userId)
      ? "requesterReview"
      : "recipientReview";

    if (swap.reviews[reviewField]) {
      return res.status(409).json({ message: "You have already submitted a review" });
    }

    swap.reviews[reviewField] = {
      rating: numericRating,
      comment: cleanComment,
      submittedAt: new Date(),
    };

    await swap.save();

    const updatedSwap = await Swap.findById(id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    res.json(updatedSwap);
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ message: "Error submitting review" });
  }
});

// Mark a milestone as completed for an active swap
router.patch("/:id/milestones/:milestoneId/complete", auth, async (req, res) => {
  try {
    const currentUser = await enforceProfileSetupComplete(req.userId, res);
    if (!currentUser) {
      return;
    }

    const { id, milestoneId } = req.params;

    const swap = await Swap.findById(id);
    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    const isParticipant =
      swap.requester.toString() === req.userId || swap.recipient.toString() === req.userId;

    if (!isParticipant) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (swap.status === "cancelled" || swap.status === "completed") {
      return res
        .status(400)
        .json({ message: "Cannot update milestones for closed swaps" });
    }

    const milestone = (swap.milestones || []).id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    if (!milestone.completed) {
      milestone.completed = true;
      milestone.completedAt = new Date();
      await swap.save();
    }

    const updatedSwap = await Swap.findById(id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    res.json(updatedSwap);
  } catch (error) {
    console.error("Error completing milestone:", error);
    res.status(500).json({ message: "Error updating milestone" });
  }
});

// Delete a swap
router.delete("/:id", auth, async (req, res) => {
  try {
    const currentUser = await enforceProfileSetupComplete(req.userId, res);
    if (!currentUser) {
      return;
    }

    const { id } = req.params;

    const swap = await Swap.findById(id);

    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    // Only the requester can delete
    if (swap.requester.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the requester can delete this swap" });
    }

    const [requesterUser, recipientUser] = await Promise.all([
      User.findById(swap.requester).select(CALENDAR_SELECT_FIELDS),
      User.findById(swap.recipient).select(CALENDAR_SELECT_FIELDS),
    ]);

    if (requesterUser && recipientUser) {
      try {
        await removeCancelledSwapFromCalendars({
          swap,
          requesterUser,
          recipientUser,
        });
      } catch (calendarError) {
        console.error("Error removing deleted swap from Google Calendar:", calendarError);
      }
    }

    await Swap.findByIdAndDelete(id);

    res.json({ message: "Swap deleted successfully" });
  } catch (error) {
    console.error("Error deleting swap:", error);
    res.status(500).json({ message: "Error deleting swap" });
  }
});

module.exports = router;
