const express = require("express");
const request = require("supertest");
const swapsRoutes = require("../../routes/swaps");
const Swap = require("../../models/Swap");
const User = require("../../models/User");

const AUTH_USER_ID = "507f1f77bcf86cd799439011";
const RECIPIENT_ID = "507f1f77bcf86cd799439012";

jest.mock("../../models/Swap");
jest.mock("../../models/User");
jest.mock("../../middleware/auth", () => (req, res, next) => {
  req.userId = AUTH_USER_ID;
  next();
});

function makeSelectQuery(value) {
  return {
    select: jest.fn().mockResolvedValue(value),
  };
}

function makePopulateQuery(value) {
  return {
    populate: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(value),
    }),
  };
}

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
        return makeSelectQuery({ blockedUsers: [] });
      }
      if (id === RECIPIENT_ID) {
        return makeSelectQuery({ blockedUsers: [] });
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
  });

  test("prevents marking swap completed when milestones remain", async () => {
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

  test("submits a review for completed swap", async () => {
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
