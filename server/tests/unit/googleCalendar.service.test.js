jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn(),
    },
    calendar: jest.fn(),
  },
}));

const { google } = require("googleapis");
const {
  encryptToken,
  exchangeAuthCodeForTokens,
  getGoogleCalendarAuthUrl,
  getGoogleCalendarStatus,
  hasUsableGoogleCalendarConnection,
  isGoogleCalendarConfigured,
  listUpcomingExternalEventsForUser,
  removeSwapEventForUser,
  shouldAutoSyncAcceptedSwaps,
  shouldRemoveCancelledSwaps,
  upsertSwapEventForUser,
  verifyGoogleCalendarState,
} = require("../../services/googleCalendar");

describe("Google Calendar service", () => {
  const originalEnv = process.env;

  let oauthClient;
  let calendarClient;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      GOOGLE_REDIRECT_URI: "http://localhost:3001/api/auth/google/callback",
      JWT_SECRET: "test-jwt-secret",
      GOOGLE_TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    };

    oauthClient = {
      generateAuthUrl: jest.fn((options) => `https://accounts.google.com/mock?state=${options.state}`),
      getToken: jest.fn().mockResolvedValue({ tokens: { refresh_token: "refresh-token" } }),
      setCredentials: jest.fn(),
    };

    calendarClient = {
      events: {
        patch: jest.fn(),
        insert: jest.fn().mockResolvedValue({ data: { id: "new-event-id" } }),
        delete: jest.fn(),
        list: jest.fn().mockResolvedValue({ data: { items: [] } }),
      },
    };

    google.auth.OAuth2.mockImplementation(() => oauthClient);
    google.calendar.mockReturnValue(calendarClient);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  test("reports configuration readiness from env", () => {
    expect(isGoogleCalendarConfigured()).toBe(true);

    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(isGoogleCalendarConfigured()).toBe(false);
  });

  test("creates auth url and verifies state payload", () => {
    const url = getGoogleCalendarAuthUrl("user-123");

    expect(url).toContain("accounts.google.com/mock");
    expect(oauthClient.generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: true,
        scope: expect.arrayContaining([
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/calendar.events",
        ]),
      })
    );

    const state = new URL(url).searchParams.get("state");
    expect(state).toBeTruthy();

    const verified = verifyGoogleCalendarState(state);
    expect(verified).toEqual({ userId: "user-123" });
  });

  test("rejects invalid calendar state", () => {
    expect(() => verifyGoogleCalendarState("bad-state-token")).toThrow();
  });

  test("exchanges auth code for tokens", async () => {
    oauthClient.getToken.mockResolvedValue({ tokens: { refresh_token: "abc", expiry_date: 123 } });

    const tokens = await exchangeAuthCodeForTokens("code-123");

    expect(oauthClient.getToken).toHaveBeenCalledWith("code-123");
    expect(tokens).toEqual({ refresh_token: "abc", expiry_date: 123 });
  });

  test("maps calendar status values from user document", () => {
    const status = getGoogleCalendarStatus({
      googleCalendar: {
        connected: true,
        accountEmail: "person@example.com",
        calendarId: "primary",
        syncAcceptedSwaps: true,
        removeCancelledSwaps: false,
      },
    });

    expect(status).toEqual({
      configured: true,
      connected: true,
      accountEmail: "person@example.com",
      calendarId: "primary",
      syncAcceptedSwaps: true,
      removeCancelledSwaps: false,
    });
  });

  test("detects usable connection and sync toggles", () => {
    const encrypted = encryptToken("refresh-token");
    const user = {
      googleCalendar: {
        connected: true,
        syncAcceptedSwaps: true,
        removeCancelledSwaps: true,
        refreshTokenCiphertext: encrypted.ciphertext,
        refreshTokenIv: encrypted.iv,
        refreshTokenAuthTag: encrypted.authTag,
      },
    };

    expect(hasUsableGoogleCalendarConnection(user)).toBe(true);
    expect(shouldAutoSyncAcceptedSwaps(user)).toBe(true);
    expect(shouldRemoveCancelledSwaps(user)).toBe(true);
  });

  test("upserts swap event by patching existing event when present", async () => {
    const encrypted = encryptToken("refresh-token");
    const user = {
      googleCalendar: {
        connected: true,
        syncAcceptedSwaps: true,
        removeCancelledSwaps: true,
        calendarId: "primary",
        refreshTokenCiphertext: encrypted.ciphertext,
        refreshTokenIv: encrypted.iv,
        refreshTokenAuthTag: encrypted.authTag,
      },
    };
    const swap = {
      _id: "swap-1",
      scheduledDate: "2030-01-01T10:00:00.000Z",
      duration: 60,
      meetingType: "virtual",
      meetingLink: "https://meet.google.com/mock",
      skillOffered: "Piano",
      skillWanted: "Spanish",
      requester: { name: "Requester" },
      recipient: { name: "Recipient" },
      googleCalendarSync: {
        requesterEventId: "requester-event",
      },
    };

    const eventId = await upsertSwapEventForUser({
      user,
      swap,
      userRole: "requester",
    });

    expect(oauthClient.setCredentials).toHaveBeenCalledWith({ refresh_token: "refresh-token" });
    expect(calendarClient.events.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "primary",
        eventId: "requester-event",
      })
    );
    expect(calendarClient.events.insert).not.toHaveBeenCalled();
    expect(eventId).toBe("requester-event");
  });

  test("creates event when existing event is missing", async () => {
    const encrypted = encryptToken("refresh-token");
    const user = {
      googleCalendar: {
        connected: true,
        syncAcceptedSwaps: true,
        removeCancelledSwaps: true,
        calendarId: "primary",
        refreshTokenCiphertext: encrypted.ciphertext,
        refreshTokenIv: encrypted.iv,
        refreshTokenAuthTag: encrypted.authTag,
      },
    };
    const swap = {
      _id: "swap-2",
      scheduledDate: "2030-01-01T10:00:00.000Z",
      duration: 60,
      meetingType: "virtual",
      meetingLink: "https://meet.google.com/mock",
      skillOffered: "Guitar",
      skillWanted: "French",
      requester: { name: "Requester" },
      recipient: { name: "Recipient" },
      googleCalendarSync: {
        requesterEventId: "old-event",
      },
    };

    const notFoundError = new Error("Not found");
    notFoundError.code = 404;
    calendarClient.events.patch.mockRejectedValue(notFoundError);
    calendarClient.events.insert.mockResolvedValue({ data: { id: "inserted-event" } });

    const eventId = await upsertSwapEventForUser({ user, swap, userRole: "requester" });

    expect(calendarClient.events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "primary",
      })
    );
    expect(eventId).toBe("inserted-event");
  });

  test("throws on non-404 patch failures", async () => {
    const encrypted = encryptToken("refresh-token");
    const user = {
      googleCalendar: {
        connected: true,
        syncAcceptedSwaps: true,
        removeCancelledSwaps: true,
        calendarId: "primary",
        refreshTokenCiphertext: encrypted.ciphertext,
        refreshTokenIv: encrypted.iv,
        refreshTokenAuthTag: encrypted.authTag,
      },
    };
    const swap = {
      _id: "swap-3",
      scheduledDate: "2030-01-01T10:00:00.000Z",
      duration: 60,
      meetingType: "virtual",
      meetingLink: "https://meet.google.com/mock",
      skillOffered: "Math",
      skillWanted: "Coding",
      requester: { name: "Requester" },
      recipient: { name: "Recipient" },
      googleCalendarSync: {
        requesterEventId: "existing-event",
      },
    };

    const patchError = new Error("Forbidden");
    patchError.code = 403;
    calendarClient.events.patch.mockRejectedValue(patchError);

    await expect(
      upsertSwapEventForUser({ user, swap, userRole: "requester" })
    ).rejects.toThrow("Forbidden");
  });

  test("removes swap event and ignores 404s", async () => {
    const encrypted = encryptToken("refresh-token");
    const user = {
      googleCalendar: {
        connected: true,
        syncAcceptedSwaps: true,
        removeCancelledSwaps: true,
        calendarId: "primary",
        refreshTokenCiphertext: encrypted.ciphertext,
        refreshTokenIv: encrypted.iv,
        refreshTokenAuthTag: encrypted.authTag,
      },
    };

    await removeSwapEventForUser({ user, eventId: "event-1" });

    expect(calendarClient.events.delete).toHaveBeenCalledWith({
      calendarId: "primary",
      eventId: "event-1",
    });

    const notFoundError = new Error("Not found");
    notFoundError.code = 404;
    calendarClient.events.delete.mockRejectedValueOnce(notFoundError);

    await expect(
      removeSwapEventForUser({ user, eventId: "event-1" })
    ).resolves.toBeUndefined();
  });

  test("filters out SkillSwap-linked events from external events list", async () => {
    const encrypted = encryptToken("refresh-token");
    const user = {
      googleCalendar: {
        connected: true,
        syncAcceptedSwaps: true,
        removeCancelledSwaps: true,
        calendarId: "primary",
        refreshTokenCiphertext: encrypted.ciphertext,
        refreshTokenIv: encrypted.iv,
        refreshTokenAuthTag: encrypted.authTag,
      },
    };

    calendarClient.events.list.mockResolvedValue({
      data: {
        items: [
          {
            id: "external-1",
            summary: "Interview",
            start: { dateTime: "2030-01-01T12:00:00.000Z" },
            end: { dateTime: "2030-01-01T13:00:00.000Z" },
          },
          {
            id: "skillswap-1",
            summary: "SkillSwap session",
            start: { dateTime: "2030-01-02T12:00:00.000Z" },
            end: { dateTime: "2030-01-02T13:00:00.000Z" },
            extendedProperties: {
              private: {
                skillswapSwapId: "swap-1",
              },
            },
          },
        ],
      },
    });

    const events = await listUpcomingExternalEventsForUser({
      user,
      timeMin: "2030-01-01T00:00:00.000Z",
      timeMax: "2030-01-31T00:00:00.000Z",
    });

    expect(calendarClient.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "primary",
        singleEvents: true,
        orderBy: "startTime",
      })
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        id: "external-1",
        title: "Interview",
      })
    );
  });
});
