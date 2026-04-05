const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");

const DEFAULT_CALENDAR_ID = "primary";
const GOOGLE_STATE_PURPOSE = "google-calendar-connect";

function getOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri:
      process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || "",
  };
}

function isGoogleCalendarConfigured() {
  const config = getOAuthConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function getOAuthClient() {
  const config = getOAuthConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("Google Calendar OAuth is not fully configured");
  }

  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

function getEncryptionKey() {
  const rawKey = String(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "").trim();
  if (!rawKey) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is required");
  }

  try {
    const maybeBase64 = Buffer.from(rawKey, "base64");
    if (maybeBase64.length === 32) {
      return maybeBase64;
    }
  } catch (_error) {
    // Fall through to deterministic key derivation.
  }

  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  return crypto.createHash("sha256").update(rawKey).digest();
}

function encryptToken(rawToken) {
  if (!rawToken) {
    return {
      ciphertext: "",
      iv: "",
      authTag: "",
    };
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(rawToken), "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptToken(encryptedToken = {}) {
  if (!encryptedToken.ciphertext || !encryptedToken.iv || !encryptedToken.authTag) {
    return "";
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encryptedToken.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encryptedToken.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedToken.ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function createGoogleCalendarState(userId) {
  return jwt.sign(
    {
      purpose: GOOGLE_STATE_PURPOSE,
      userId: String(userId),
    },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "15m" }
  );
}

function verifyGoogleCalendarState(state) {
  const payload = jwt.verify(
    String(state || ""),
    process.env.JWT_SECRET || "dev-secret"
  );

  if (!payload || payload.purpose !== GOOGLE_STATE_PURPOSE || !payload.userId) {
    throw new Error("Invalid Google Calendar state");
  }

  return {
    userId: String(payload.userId),
  };
}

function getGoogleCalendarAuthUrl(userId) {
  const client = getOAuthClient();
  const state = createGoogleCalendarState(userId);

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    state,
  });
}

async function exchangeAuthCodeForTokens(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(String(code || "").trim());
  return tokens || {};
}

async function revokeGoogleCalendarRefreshToken(refreshToken) {
  const token = String(refreshToken || "").trim();
  if (!token) {
    return false;
  }

  const client = getOAuthClient();
  await client.revokeToken(token);
  return true;
}

function getGoogleCalendarStatus(user = {}) {
  const calendar = user.googleCalendar || {};

  return {
    configured: isGoogleCalendarConfigured(),
    connected: Boolean(calendar.connected),
    accountEmail: calendar.accountEmail || "",
    calendarId: calendar.calendarId || DEFAULT_CALENDAR_ID,
    syncAcceptedSwaps: Boolean(calendar.syncAcceptedSwaps),
    removeCancelledSwaps: Boolean(calendar.removeCancelledSwaps),
  };
}

function hasUsableGoogleCalendarConnection(user = {}) {
  const calendar = user.googleCalendar || {};
  return Boolean(
    calendar.connected &&
      calendar.refreshTokenCiphertext &&
      calendar.refreshTokenIv &&
      calendar.refreshTokenAuthTag
  );
}

async function getCalendarClientForUser(user = {}) {
  if (!hasUsableGoogleCalendarConnection(user)) {
    return null;
  }

  const calendar = user.googleCalendar || {};
  const refreshToken = decryptToken({
    ciphertext: calendar.refreshTokenCiphertext,
    iv: calendar.refreshTokenIv,
    authTag: calendar.refreshTokenAuthTag,
  });

  if (!refreshToken) {
    return null;
  }

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  return google.calendar({ version: "v3", auth: client });
}

function formatPartnerLabel(partnerUser = {}, fallbackName = "") {
  const username = String(partnerUser?.username || "").trim();
  if (username) {
    return `@${username}`;
  }

  const name = String(partnerUser?.name || fallbackName || "").trim();
  if (name) {
    return name;
  }

  return "swap partner";
}

function buildSwapEventResource({ swap, userRole, partnerUser = null }) {
  const isRequester = userRole === "requester";
  const fallbackPartnerName = isRequester ? swap.recipient?.name : swap.requester?.name;
  const partnerName = formatPartnerLabel(partnerUser, fallbackPartnerName);

  const startDate = new Date(swap.scheduledDate);
  const endDate = new Date(startDate.getTime() + Number(swap.duration || 60) * 60 * 1000);

  const location =
    swap.meetingType === "virtual"
      ? swap.meetingLink || swap.location || "Online"
      : swap.meetingAddress || swap.location || "In person";

  const descriptionLines = [
    `SkillSwap session with ${partnerName}`,
    `You teach: ${swap.skillOffered}`,
    `You learn: ${swap.skillWanted}`,
  ];

  if (swap.notes) {
    descriptionLines.push(`Notes: ${swap.notes}`);
  }

  return {
    summary: `SkillSwap: ${swap.skillOffered} <-> ${swap.skillWanted}`,
    description: descriptionLines.join("\n"),
    location,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: "UTC",
    },
    extendedProperties: {
      private: {
        skillswapSwapId: String(swap._id),
      },
    },
  };
}

function getUserEventIdField(userRole) {
  return userRole === "requester" ? "requesterEventId" : "recipientEventId";
}

function shouldAutoSyncAcceptedSwaps(user = {}) {
  const calendar = user.googleCalendar || {};
  return hasUsableGoogleCalendarConnection(user) && Boolean(calendar.syncAcceptedSwaps);
}

function shouldRemoveCancelledSwaps(user = {}) {
  const calendar = user.googleCalendar || {};
  return shouldAutoSyncAcceptedSwaps(user) && Boolean(calendar.removeCancelledSwaps);
}

async function upsertSwapEventForUser({ user, swap, userRole, partnerUser = null }) {
  if (!shouldAutoSyncAcceptedSwaps(user)) {
    return "";
  }

  const calendar = await getCalendarClientForUser(user);
  if (!calendar) {
    return "";
  }

  const eventField = getUserEventIdField(userRole);
  const existingEventId = swap.googleCalendarSync?.[eventField] || "";
  const calendarId = user.googleCalendar?.calendarId || DEFAULT_CALENDAR_ID;
  const eventResource = buildSwapEventResource({ swap, userRole, partnerUser });

  if (existingEventId) {
    try {
      await calendar.events.patch({
        calendarId,
        eventId: existingEventId,
        requestBody: eventResource,
      });
      return existingEventId;
    } catch (error) {
      const status = Number(error?.code || error?.response?.status || 0);
      if (status !== 404) {
        throw error;
      }
    }
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventResource,
  });

  return response?.data?.id || "";
}

async function removeSwapEventForUser({ user, eventId }) {
  if (!eventId || !shouldRemoveCancelledSwaps(user)) {
    return;
  }

  const calendar = await getCalendarClientForUser(user);
  if (!calendar) {
    return;
  }

  const calendarId = user.googleCalendar?.calendarId || DEFAULT_CALENDAR_ID;

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error) {
    const status = Number(error?.code || error?.response?.status || 0);
    if (status !== 404) {
      throw error;
    }
  }
}

async function listUpcomingExternalEventsForUser({ user, timeMin, timeMax }) {
  const calendar = await getCalendarClientForUser(user);
  if (!calendar) {
    return [];
  }

  const calendarId = user.googleCalendar?.calendarId || DEFAULT_CALENDAR_ID;
  const response = await calendar.events.list({
    calendarId,
    singleEvents: true,
    orderBy: "startTime",
    timeMin,
    timeMax,
    maxResults: 100,
  });

  const items = Array.isArray(response?.data?.items) ? response.data.items : [];

  return items
    .filter((event) => !event?.extendedProperties?.private?.skillswapSwapId)
    .map((event) => ({
      id: event.id,
      title: event.summary || "Untitled event",
      description: event.description || "",
      location: event.location || "",
      status: event.status || "confirmed",
      start: event.start?.dateTime || event.start?.date || "",
      end: event.end?.dateTime || event.end?.date || "",
      htmlLink: event.htmlLink || "",
    }));
}

module.exports = {
  DEFAULT_CALENDAR_ID,
  encryptToken,
  exchangeAuthCodeForTokens,
  getGoogleCalendarAuthUrl,
  getGoogleCalendarStatus,
  hasUsableGoogleCalendarConnection,
  isGoogleCalendarConfigured,
  listUpcomingExternalEventsForUser,
  removeSwapEventForUser,
  revokeGoogleCalendarRefreshToken,
  shouldAutoSyncAcceptedSwaps,
  shouldRemoveCancelledSwaps,
  upsertSwapEventForUser,
  verifyGoogleCalendarState,
};
