const express = require("express");
const request = require("supertest");
const User = require("../../models/User");
const googleCalendarRoutes = require("../../routes/googleCalendar");
const {
  encryptToken,
  exchangeAuthCodeForTokens,
  getGoogleCalendarAuthUrl,
  getGoogleCalendarStatus,
  isGoogleCalendarConfigured,
  listUpcomingExternalEventsForUser,
  verifyGoogleCalendarState,
} = require("../../services/googleCalendar");

const AUTH_USER_ID = "507f1f77bcf86cd799439011";

jest.mock("../../models/User");
jest.mock("../../services/googleCalendar", () => ({
  DEFAULT_CALENDAR_ID: "primary",
  encryptToken: jest.fn(),
  exchangeAuthCodeForTokens: jest.fn(),
  getGoogleCalendarAuthUrl: jest.fn(),
  getGoogleCalendarStatus: jest.fn(),
  isGoogleCalendarConfigured: jest.fn(),
  listUpcomingExternalEventsForUser: jest.fn(),
  verifyGoogleCalendarState: jest.fn(),
}));
jest.mock("../../middleware/auth", () => (req, res, next) => {
  req.userId = AUTH_USER_ID;
  next();
});

function makeSelectQuery(value) {
  return {
    select: jest.fn().mockResolvedValue(value),
  };
}

function makeUpdateSelectQuery(value) {
  return {
    select: jest.fn().mockResolvedValue(value),
  };
}

function createFakeIdToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

describe("Google Calendar Routes", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/integrations/google-calendar", googleCalendarRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/integrations/google-calendar/status", () => {
    test("returns 404 when user does not exist", async () => {
      User.findById.mockReturnValue(makeSelectQuery(null));

      const response = await request(app).get("/api/integrations/google-calendar/status");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    test("returns mapped Google Calendar status", async () => {
      const user = { googleCalendar: { connected: true } };
      User.findById.mockReturnValue(makeSelectQuery(user));
      getGoogleCalendarStatus.mockReturnValue({ configured: true, connected: true });

      const response = await request(app).get("/api/integrations/google-calendar/status");

      expect(response.status).toBe(200);
      expect(getGoogleCalendarStatus).toHaveBeenCalledWith(user);
      expect(response.body).toEqual({ configured: true, connected: true });
    });
  });

  describe("GET /api/integrations/google-calendar/auth-url", () => {
    test("returns 500 when integration is not configured", async () => {
      isGoogleCalendarConfigured.mockReturnValue(false);

      const response = await request(app).get("/api/integrations/google-calendar/auth-url");

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Google Calendar integration is not configured");
    });

    test("returns auth url when configured", async () => {
      isGoogleCalendarConfigured.mockReturnValue(true);
      getGoogleCalendarAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/auth");

      const response = await request(app).get("/api/integrations/google-calendar/auth-url");

      expect(response.status).toBe(200);
      expect(getGoogleCalendarAuthUrl).toHaveBeenCalledWith(AUTH_USER_ID);
      expect(response.body.url).toContain("accounts.google.com");
    });
  });

  describe("GET /api/integrations/google-calendar/callback", () => {
    test("returns failed callback page when params are missing", async () => {
      isGoogleCalendarConfigured.mockReturnValue(true);

      const response = await request(app).get("/api/integrations/google-calendar/callback");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Google Calendar connection failed");
      expect(response.text).toContain("Missing authorization parameters from Google");
    });

    test("stores encrypted tokens and returns success callback page", async () => {
      isGoogleCalendarConfigured.mockReturnValue(true);
      verifyGoogleCalendarState.mockReturnValue({ userId: AUTH_USER_ID });
      exchangeAuthCodeForTokens.mockResolvedValue({
        refresh_token: "refresh-token-value",
        id_token: createFakeIdToken({ email: "person@example.com" }),
      });
      encryptToken.mockReturnValue({
        ciphertext: "enc",
        iv: "iv",
        authTag: "tag",
      });
      User.findByIdAndUpdate.mockResolvedValue({ _id: AUTH_USER_ID });

      const response = await request(app).get(
        "/api/integrations/google-calendar/callback?code=test-code&state=test-state"
      );

      expect(response.status).toBe(200);
      expect(response.text).toContain("Google Calendar connected");
      expect(verifyGoogleCalendarState).toHaveBeenCalledWith("test-state");
      expect(exchangeAuthCodeForTokens).toHaveBeenCalledWith("test-code");
      expect(encryptToken).toHaveBeenCalledWith("refresh-token-value");
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        AUTH_USER_ID,
        expect.objectContaining({
          $set: expect.objectContaining({
            "googleCalendar.connected": true,
            "googleCalendar.accountEmail": "person@example.com",
            "googleCalendar.refreshTokenCiphertext": "enc",
            "googleCalendar.refreshTokenIv": "iv",
            "googleCalendar.refreshTokenAuthTag": "tag",
          }),
        })
      );
    });
  });

  describe("PUT /api/integrations/google-calendar/settings", () => {
    test("returns 404 when user does not exist", async () => {
      User.findById.mockReturnValue(makeSelectQuery(null));

      const response = await request(app)
        .put("/api/integrations/google-calendar/settings")
        .send({ syncAcceptedSwaps: true, removeCancelledSwaps: true });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    test("updates settings and returns mapped status", async () => {
      User.findById.mockReturnValue(makeSelectQuery({ _id: AUTH_USER_ID }));
      User.findByIdAndUpdate.mockReturnValue(
        makeUpdateSelectQuery({ googleCalendar: { connected: true } })
      );
      getGoogleCalendarStatus.mockReturnValue({
        connected: true,
        syncAcceptedSwaps: true,
        removeCancelledSwaps: false,
      });

      const response = await request(app)
        .put("/api/integrations/google-calendar/settings")
        .send({ syncAcceptedSwaps: "true", removeCancelledSwaps: false });

      expect(response.status).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        AUTH_USER_ID,
        {
          $set: {
            "googleCalendar.syncAcceptedSwaps": true,
            "googleCalendar.removeCancelledSwaps": false,
          },
        },
        { new: true, runValidators: true }
      );
      expect(response.body).toEqual({
        connected: true,
        syncAcceptedSwaps: true,
        removeCancelledSwaps: false,
      });
    });
  });

  describe("POST /api/integrations/google-calendar/disconnect", () => {
    test("clears sensitive fields and returns status", async () => {
      User.findByIdAndUpdate.mockReturnValue(
        makeUpdateSelectQuery({ googleCalendar: { connected: false } })
      );
      getGoogleCalendarStatus.mockReturnValue({ connected: false });

      const response = await request(app).post("/api/integrations/google-calendar/disconnect");

      expect(response.status).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        AUTH_USER_ID,
        expect.objectContaining({
          $set: expect.objectContaining({
            "googleCalendar.connected": false,
            "googleCalendar.refreshTokenCiphertext": "",
            "googleCalendar.refreshTokenIv": "",
            "googleCalendar.refreshTokenAuthTag": "",
          }),
        }),
        { new: true }
      );
      expect(response.body).toEqual({ connected: false });
    });
  });

  describe("GET /api/integrations/google-calendar/events", () => {
    test("returns 404 when user does not exist", async () => {
      User.findById.mockReturnValue(makeSelectQuery(null));

      const response = await request(app).get("/api/integrations/google-calendar/events");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    test("returns empty events when not connected", async () => {
      const user = { googleCalendar: { connected: false } };
      User.findById.mockReturnValue(makeSelectQuery(user));
      getGoogleCalendarStatus.mockReturnValue({ connected: false });

      const response = await request(app).get("/api/integrations/google-calendar/events");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ events: [] });
      expect(listUpcomingExternalEventsForUser).not.toHaveBeenCalled();
    });

    test("returns 400 for invalid date range", async () => {
      const user = { googleCalendar: { connected: true } };
      User.findById.mockReturnValue(makeSelectQuery(user));
      getGoogleCalendarStatus.mockReturnValue({ connected: true });

      const response = await request(app).get(
        "/api/integrations/google-calendar/events?start=invalid-date"
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid start or end date");
    });

    test("returns external events when connected", async () => {
      const user = { googleCalendar: { connected: true } };
      User.findById.mockReturnValue(makeSelectQuery(user));
      getGoogleCalendarStatus.mockReturnValue({ connected: true });
      listUpcomingExternalEventsForUser.mockResolvedValue([
        {
          id: "event-1",
          title: "Interview",
          start: "2030-01-01T12:00:00.000Z",
          end: "2030-01-01T13:00:00.000Z",
        },
      ]);

      const response = await request(app).get(
        "/api/integrations/google-calendar/events?start=2030-01-01T00:00:00.000Z&end=2030-02-01T00:00:00.000Z"
      );

      expect(response.status).toBe(200);
      expect(listUpcomingExternalEventsForUser).toHaveBeenCalledWith(
        expect.objectContaining({
          user,
          timeMin: "2030-01-01T00:00:00.000Z",
          timeMax: "2030-02-01T00:00:00.000Z",
        })
      );
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].id).toBe("event-1");
    });
  });
});
