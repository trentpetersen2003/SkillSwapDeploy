const express = require("express");
const request = require("supertest");
const swapsRoutes = require("../../routes/swaps");
const Swap = require("../../models/Swap");
const User = require("../../models/User");
const {
  sendSwapRequestEmail,
  sendSwapAcceptedEmail,
  sendSwapCancelledEmail,
} = require("../../services/email");

const AUTH_USER_ID = "507f1f77bcf86cd799439011";
const RECIPIENT_ID = "507f1f77bcf86cd799439012";

jest.mock("../../models/Swap");
jest.mock("../../models/User");
jest.mock("../../services/email", () => ({
  sendSwapRequestEmail: jest.fn(),
  sendSwapAcceptedEmail: jest.fn(),
  sendSwapCancelledEmail: jest.fn(),
}));
jest.mock("../../middleware/auth", () => (req, res, next) => {
  req.userId = AUTH_USER_ID;
  next();
});

// Run make select query logic.
function makeSelectQuery(value) {
  return {
    select: jest.fn().mockResolvedValue(value),
  };
}

// Run make populate query logic.
function makePopulateQuery(value) {
  return {
    populate: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(value),
    }),
  };
}

// Run make setup ready user logic.
function makeSetupReadyUser(id, overrides = {}) {
  return {
    _id: id,
    name: "Test User",
    email: `${id}@example.com`,
    city: "Boston",
    state: "MA",
    timeZone: "UTC-04:00",
    availability: [{ day: "Tuesday", timeRange: "5:00 AM - 9:00 AM" }],
    skills: [{ skillName: "Piano" }],
    skillsWanted: [{ skillName: "Spanish" }],
    blockedUsers: [],
    ...overrides,
  };
}

const allDayAvailability = [
  { day: "Sunday", timeRange: "12:00 AM - 11:59 PM" },
  { day: "Monday", timeRange: "12:00 AM - 11:59 PM" },
  { day: "Tuesday", timeRange: "12:00 AM - 11:59 PM" },
  { day: "Wednesday", timeRange: "12:00 AM - 11:59 PM" },
  { day: "Thursday", timeRange: "12:00 AM - 11:59 PM" },
  { day: "Friday", timeRange: "12:00 AM - 11:59 PM" },
  { day: "Saturday", timeRange: "12:00 AM - 11:59 PM" },
];

describe("Swaps Routes", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/swaps", swapsRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates a swap with milestones", async () => {
    User.findById.mockImplementation((id) => {
      if (id === AUTH_USER_ID) {
        return makeSelectQuery(makeSetupReadyUser(AUTH_USER_ID));
      }
      if (id === RECIPIENT_ID) {
        return makeSelectQuery(makeSetupReadyUser(RECIPIENT_ID));
      }
      return makeSelectQuery(null);
    });

    Swap.mockImplementation(function SwapConstructor(payload) {
      this._id = "swap-1";
      this.save = jest.fn().mockResolvedValue(this);
      Object.assign(this, payload);
    });

    Swap.findById.mockReturnValue(
      makePopulateQuery({
        _id: "swap-1",
        requester: { _id: AUTH_USER_ID, username: "me" },
        recipient: { _id: RECIPIENT_ID, username: "other" },
        totalSessions: 2,
        milestones: [{ title: "Session one" }, { title: "Session two" }],
      })
    );

    const response = await request(app)
      .post("/api/swaps")
      .send({
        recipientId: RECIPIENT_ID,
        skillOffered: "Piano",
        skillWanted: "Spanish",
        scheduledDate: "2030-01-01T10:00:00.000Z",
        meetingType: "virtual",
        meetingLink: "https://zoom.us/j/123456789",
        totalSessions: 2,
        milestones: [{ title: "Session one" }, { title: "Session two" }],
      });

    expect(response.status).toBe(201);
    expect(Swap).toHaveBeenCalledWith(
      expect.objectContaining({
        totalSessions: 2,
        milestones: [
          expect.objectContaining({ title: "Session one" }),
          expect.objectContaining({ title: "Session two" }),
        ],
      })
    );
    expect(sendSwapRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `${RECIPIENT_ID}@example.com`,
        preferenceEnabled: true,
      })
    );
  });

  test("returns suggested overlapping slots", async () => {
    User.findById.mockImplementation((id) => {
      if (id === AUTH_USER_ID) {
        return makeSelectQuery(
          makeSetupReadyUser(AUTH_USER_ID, {
            blockedUsers: [],
            availability: allDayAvailability,
          })
        );
      }

      if (id === RECIPIENT_ID) {
        return makeSelectQuery(
          makeSetupReadyUser(RECIPIENT_ID, {
            blockedUsers: [],
            availability: allDayAvailability,
          })
        );
      }

      return makeSelectQuery(null);
    });

    Swap.find.mockReturnValue(makeSelectQuery([]));

    const response = await request(app).get(
      `/api/swaps/suggestions?recipientId=${RECIPIENT_ID}&duration=60&limit=3`
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.suggestions)).toBe(true);
    expect(response.body.suggestions.length).toBeGreaterThan(0);
    expect(response.body.suggestions[0]).toEqual(
      expect.objectContaining({
        scheduledDate: expect.any(String),
        requesterLocal: expect.any(String),
        recipientLocal: expect.any(String),
      })
    );
  });

  test("returns 400 when recipient has no availability for suggestions", async () => {
    User.findById.mockImplementation((id) => {
      if (id === AUTH_USER_ID) {
        return makeSelectQuery(makeSetupReadyUser(AUTH_USER_ID, { blockedUsers: [] }));
      }

      if (id === RECIPIENT_ID) {
        return makeSelectQuery(
          makeSetupReadyUser(RECIPIENT_ID, {
            blockedUsers: [],
            availability: [],
          })
        );
      }

      return makeSelectQuery(null);
    });

    const response = await request(app).get(
      `/api/swaps/suggestions?recipientId=${RECIPIENT_ID}&duration=60`
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("This user has not set availability yet");
  });

  test("prevents marking swap completed when milestones remain", async () => {
    User.findById.mockImplementation((id) => {
      if (id === AUTH_USER_ID) {
        return makeSelectQuery(makeSetupReadyUser(AUTH_USER_ID));
      }
      return makeSelectQuery(null);
    });

    const save = jest.fn();
    Swap.findById.mockResolvedValue({
      _id: "swap-1",
      requester: { toString: () => AUTH_USER_ID },
      recipient: { toString: () => RECIPIENT_ID },
      status: "confirmed",
      milestones: [{ title: "Session one", completed: false }],
      save,
    });

    const response = await request(app)
      .patch("/api/swaps/swap-1/status")
      .send({ status: "completed" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Complete all milestones");
    expect(save).not.toHaveBeenCalled();
  });

  test("marks a milestone complete for a participant", async () => {
    User.findById.mockImplementation((id) => {
      if (id === AUTH_USER_ID) {
        return makeSelectQuery(makeSetupReadyUser(AUTH_USER_ID));
      }
      return makeSelectQuery(null);
    });

    const save = jest.fn().mockResolvedValue();
    const milestone = {
      completed: false,
      completedAt: null,
    };

    const swapDoc = {
      _id: "swap-1",
      requester: { toString: () => AUTH_USER_ID },
      recipient: { toString: () => RECIPIENT_ID },
      status: "confirmed",
      milestones: {
        id: jest.fn().mockReturnValue(milestone),
      },
      save,
    };

    Swap.findById
      .mockResolvedValueOnce(swapDoc)
      .mockReturnValueOnce(
        makePopulateQuery({
          _id: "swap-1",
          milestones: [{ _id: "m1", title: "Session one", completed: true }],
        })
      );

    const response = await request(app).patch(
      "/api/swaps/swap-1/milestones/m1/complete"
    );

    expect(response.status).toBe(200);
    expect(milestone.completed).toBe(true);
    expect(milestone.completedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalled();
  });

  test("confirms a session and auto-completes when both users confirmed", async () => {
    User.findById.mockImplementation((id) => {
      if (id === AUTH_USER_ID) {
        return makeSelectQuery(makeSetupReadyUser(AUTH_USER_ID));
      }
      return makeSelectQuery(null);
    });

    const save = jest.fn().mockResolvedValue();
    const swapDoc = {
      _id: "swap-1",
      requester: { toString: () => AUTH_USER_ID },
      recipient: { toString: () => RECIPIENT_ID },
      status: "confirmed",
      milestones: [{ title: "Session one", completed: true }],
      requesterConfirmedAt: null,
      recipientConfirmedAt: new Date("2030-01-01T12:00:00.000Z"),
      completedAt: null,
      save,
    };

    Swap.findById
      .mockResolvedValueOnce(swapDoc)
      .mockReturnValueOnce(
        makePopulateQuery({
          _id: "swap-1",
          status: "completed",
          requesterConfirmedAt: new Date(),
          recipientConfirmedAt: new Date(),
        })
      );

    const response = await request(app).patch("/api/swaps/swap-1/confirm-session");

    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(swapDoc.status).toBe("completed");
    expect(swapDoc.completedAt).toBeInstanceOf(Date);
  });

  test("sends accepted email when recipient confirms pending swap", async () => {
    User.findById
      .mockImplementationOnce((id) => {
        if (id === AUTH_USER_ID) {
          return makeSelectQuery(makeSetupReadyUser(AUTH_USER_ID));
        }
        return makeSelectQuery(null);
      })
      .mockImplementationOnce(() =>
        makeSelectQuery({
          _id: AUTH_USER_ID,
          name: "Requester",
          email: "requester@example.com",
          notificationPreferences: { swapConfirmedEmail: true },
        })
      )
      .mockImplementationOnce(() =>
        makeSelectQuery({
          _id: RECIPIENT_ID,
          name: "Recipient",
          email: "recipient@example.com",
          notificationPreferences: { swapConfirmedEmail: true },
        })
      );

    const save = jest.fn().mockResolvedValue();
    Swap.findById
      .mockResolvedValueOnce({
        _id: "swap-confirm",
        requester: { toString: () => AUTH_USER_ID },
        recipient: { toString: () => AUTH_USER_ID },
        status: "pending",
        skillOffered: "Piano",
        skillWanted: "Spanish",
        scheduledDate: new Date("2030-01-01T10:00:00.000Z"),
        milestones: [{ completed: true }],
        save,
      })
      .mockReturnValueOnce(
        makePopulateQuery({
          _id: "swap-confirm",
          status: "confirmed",
        })
      );

    const response = await request(app)
      .patch("/api/swaps/swap-confirm/status")
      .send({ status: "confirmed" });

    expect(response.status).toBe(200);
    expect(sendSwapAcceptedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "requester@example.com",
        preferenceEnabled: true,
      })
    );
  });

  test("sends cancellation email to the non-actor participant", async () => {
    User.findById
      .mockImplementationOnce((id) => {
        if (id === AUTH_USER_ID) {
          return makeSelectQuery(makeSetupReadyUser(AUTH_USER_ID));
        }
        return makeSelectQuery(null);
      })
      .mockImplementationOnce(() =>
        makeSelectQuery({
          _id: AUTH_USER_ID,
          name: "Requester",
          email: "requester@example.com",
          notificationPreferences: { swapCancelledEmail: true },
        })
      )
      .mockImplementationOnce(() =>
        makeSelectQuery({
          _id: RECIPIENT_ID,
          name: "Recipient",
          email: "recipient@example.com",
          notificationPreferences: { swapCancelledEmail: true },
        })
      );

    const save = jest.fn().mockResolvedValue();
    Swap.findById
      .mockResolvedValueOnce({
        _id: "swap-2",
        requester: { toString: () => AUTH_USER_ID },
        recipient: { toString: () => RECIPIENT_ID },
        status: "confirmed",
        skillOffered: "Piano",
        skillWanted: "Spanish",
        scheduledDate: new Date("2030-01-01T10:00:00.000Z"),
        milestones: [{ completed: true }],
        save,
      })
      .mockReturnValueOnce(
        makePopulateQuery({
          _id: "swap-2",
          status: "cancelled",
        })
      );

    const response = await request(app)
      .patch("/api/swaps/swap-2/status")
      .send({ status: "cancelled" });

    expect(response.status).toBe(200);
    expect(sendSwapCancelledEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "recipient@example.com",
        preferenceEnabled: true,
      })
    );
  });

  test("submits a review for completed swap", async () => {
    User.findById.mockImplementation((id) => {
      if (id === AUTH_USER_ID) {
        return makeSelectQuery(makeSetupReadyUser(AUTH_USER_ID));
      }
      return makeSelectQuery(null);
    });

    const save = jest.fn().mockResolvedValue();
    const swapDoc = {
      _id: "swap-1",
      requester: { toString: () => AUTH_USER_ID },
      recipient: { toString: () => RECIPIENT_ID },
      status: "completed",
      reviews: {},
      save,
    };

    Swap.findById
      .mockResolvedValueOnce(swapDoc)
      .mockReturnValueOnce(
        makePopulateQuery({
          _id: "swap-1",
          reviews: {
            requesterReview: { rating: 5, comment: "Great partner" },
          },
        })
      );

    const response = await request(app)
      .patch("/api/swaps/swap-1/review")
      .send({ rating: 5, comment: "Great partner" });

    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(swapDoc.reviews.requesterReview).toEqual(
      expect.objectContaining({ rating: 5, comment: "Great partner" })
    );
  });
});
