const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth");
const {
  DEFAULT_CALENDAR_ID,
  encryptToken,
  exchangeAuthCodeForTokens,
  getGoogleCalendarAuthUrl,
  getGoogleCalendarStatus,
  isGoogleCalendarConfigured,
  listUpcomingExternalEventsForUser,
  verifyGoogleCalendarState,
} = require("../services/googleCalendar");

const router = express.Router();

function parseGoogleIdTokenPayload(idToken) {
  try {
    const parts = String(idToken || "").split(".");
    if (parts.length < 2) {
      return null;
    }

    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(decoded);
  } catch (_error) {
    return null;
  }
}

function isTruthy(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return Boolean(value);
}

router.get("/status", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("googleCalendar");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(getGoogleCalendarStatus(user));
  } catch (error) {
    console.error("Error loading Google Calendar status:", error);
    return res.status(500).json({ message: "Error loading Google Calendar status" });
  }
});

router.get("/auth-url", auth, async (req, res) => {
  try {
    if (!isGoogleCalendarConfigured()) {
      return res.status(500).json({ message: "Google Calendar integration is not configured" });
    }

    const url = getGoogleCalendarAuthUrl(req.userId);
    return res.json({ url });
  } catch (error) {
    console.error("Error generating Google Calendar auth URL:", error);
    return res.status(500).json({ message: "Error generating Google Calendar auth URL" });
  }
});

router.get("/callback", async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  let clientOrigin = "http://localhost:3000";
  try {
    clientOrigin = new URL(clientUrl).origin;
  } catch (_error) {
    clientOrigin = "http://localhost:3000";
  }

  function sendResult({ connected, message }) {
    const safeMessage = String(message || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    res.set("Content-Type", "text/html");
    res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Google Calendar Connection</title>
  </head>
  <body style="font-family: Arial, sans-serif; padding: 24px;">
    <h2>${connected ? "Google Calendar connected" : "Google Calendar connection failed"}</h2>
    <p>${safeMessage}</p>
    <script>
      (function () {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              {
                type: "google-calendar-connect-result",
                connected: ${connected ? "true" : "false"},
                message: ${JSON.stringify(message || "")}
              },
              ${JSON.stringify(clientOrigin)}
            );
          }
        } catch (e) {
          // no-op
        }
        setTimeout(function () { window.close(); }, 250);
      })();
    </script>
  </body>
</html>`);
  }

  try {
    if (!isGoogleCalendarConfigured()) {
      return sendResult({
        connected: false,
        message: "Google Calendar integration is not configured on the server.",
      });
    }

    const { code, state } = req.query;
    if (!code || !state) {
      return sendResult({
        connected: false,
        message: "Missing authorization parameters from Google.",
      });
    }

    const { userId } = verifyGoogleCalendarState(String(state));
    const tokens = await exchangeAuthCodeForTokens(String(code));

    const refreshToken = String(tokens.refresh_token || "").trim();
    const idTokenPayload = parseGoogleIdTokenPayload(tokens.id_token || "");
    const accountEmail = String(idTokenPayload?.email || "").trim().toLowerCase();
    const encryptedRefreshToken = refreshToken
      ? encryptToken(refreshToken)
      : { ciphertext: "", iv: "", authTag: "" };

    const updates = {
      "googleCalendar.connected": true,
      "googleCalendar.calendarId": DEFAULT_CALENDAR_ID,
      "googleCalendar.accountEmail": accountEmail,
      "googleCalendar.lastConnectedAt": new Date(),
      "googleCalendar.syncAcceptedSwaps": true,
      "googleCalendar.removeCancelledSwaps": true,
    };

    if (refreshToken) {
      updates["googleCalendar.refreshTokenCiphertext"] = encryptedRefreshToken.ciphertext;
      updates["googleCalendar.refreshTokenIv"] = encryptedRefreshToken.iv;
      updates["googleCalendar.refreshTokenAuthTag"] = encryptedRefreshToken.authTag;
      updates["googleCalendar.refreshTokenUpdatedAt"] = new Date();
    }

    await User.findByIdAndUpdate(userId, {
      $set: updates,
    });

    return sendResult({
      connected: true,
      message: "You can close this window and return to Settings.",
    });
  } catch (error) {
    console.error("Error handling Google Calendar callback:", error);
    return sendResult({
      connected: false,
      message: "Unable to complete Google Calendar connection.",
    });
  }
});

router.put("/settings", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("googleCalendar");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { syncAcceptedSwaps, removeCancelledSwaps } = req.body || {};

    const updates = {
      "googleCalendar.syncAcceptedSwaps": isTruthy(syncAcceptedSwaps),
      "googleCalendar.removeCancelledSwaps": isTruthy(removeCancelledSwaps),
    };

    const updated = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("googleCalendar");

    return res.json(getGoogleCalendarStatus(updated));
  } catch (error) {
    console.error("Error updating Google Calendar settings:", error);
    return res.status(500).json({ message: "Error updating Google Calendar settings" });
  }
});

router.post("/disconnect", auth, async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          "googleCalendar.connected": false,
          "googleCalendar.accountEmail": "",
          "googleCalendar.refreshTokenCiphertext": "",
          "googleCalendar.refreshTokenIv": "",
          "googleCalendar.refreshTokenAuthTag": "",
          "googleCalendar.refreshTokenUpdatedAt": null,
        },
      },
      { new: true }
    ).select("googleCalendar");

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(getGoogleCalendarStatus(updated));
  } catch (error) {
    console.error("Error disconnecting Google Calendar:", error);
    return res.status(500).json({ message: "Error disconnecting Google Calendar" });
  }
});

router.get("/events", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "googleCalendar.connected googleCalendar.accountEmail googleCalendar.calendarId googleCalendar.syncAcceptedSwaps googleCalendar.removeCancelledSwaps googleCalendar.lastConnectedAt +googleCalendar.refreshTokenCiphertext +googleCalendar.refreshTokenIv +googleCalendar.refreshTokenAuthTag +googleCalendar.refreshTokenUpdatedAt"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const status = getGoogleCalendarStatus(user);
    if (!status.connected) {
      return res.json({ events: [] });
    }

    const startDate = new Date(req.query.start || Date.now());
    const endDate = new Date(req.query.end || Date.now() + 90 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid start or end date" });
    }

    const events = await listUpcomingExternalEventsForUser({
      user,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
    });

    return res.json({ events });
  } catch (error) {
    console.error("Error loading Google Calendar events:", error);
    return res.status(500).json({ message: "Error loading Google Calendar events" });
  }
});

module.exports = router;
