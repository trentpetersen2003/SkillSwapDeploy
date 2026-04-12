const express = require("express");
const request = require("supertest");
const User = require("../../models/User");
const { getReliabilityByUserIds } = require("../../services/reliability");
const { rankCandidates } = require("../../services/matching");

jest.mock("../../models/User");
jest.mock("../../services/reliability", () => ({
  getReliabilityByUserIds: jest.fn(),
}));
jest.mock("../../services/matching", () => ({
  rankCandidates: jest.fn(),
  getMatchingTelemetrySnapshot: jest.fn().mockReturnValue({
    totalEvaluations: 0,
    lastUpdatedAt: null,
    unmatchedWantedSkills: [],
    unmatchedTeachSkills: [],
    lowConfidencePairs: [],
  }),
  resetMatchingTelemetry: jest.fn(),
}));
jest.mock("../../middleware/auth", () => (req, res, next) => {
  req.userId = "507f1f77bcf86cd799439011";
  next();
});

const forYouRoutes = require("../../routes/forYou");

// Run make select query logic.
function makeSelectQuery(value) {
  return {
    select: jest.fn().mockResolvedValue(value),
  };
}

describe("For You Routes", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/for-you", forYouRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_MATCHING_TELEMETRY;
    delete process.env.MATCHING_TELEMETRY_TOKEN;
    process.env.NODE_ENV = "test";
  });

  test("returns ranked users with match metadata", async () => {
    User.findById.mockReturnValue(
      makeSelectQuery({ blockedUsers: [], showOthersLocations: true })
    );
    User.find.mockReturnValue(
      makeSelectQuery([
        {
          _id: "u1",
          name: "Taylor",
          username: "taylor",
          city: "Denver",
          locationVisibility: "visible",
        },
      ])
    );
    getReliabilityByUserIds.mockResolvedValue({
      u1: { score: 90, tier: "Reliable" },
    });
    rankCandidates.mockReturnValue([
      {
        _id: "u1",
        name: "Taylor",
        username: "taylor",
        city: "Denver",
        locationVisibility: "visible",
        reliability: { score: 90, tier: "Reliable" },
        matchScore: 87,
        matchReasons: ["Strong skill-family compatibility in your learning goals"],
      },
    ]);

    const response = await request(app).get("/api/for-you");

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        name: "Taylor",
        matchScore: 87,
        matchReasons: ["Strong skill-family compatibility in your learning goals"],
        reliability: { score: 90, tier: "Reliable" },
      })
    );
  });

  test("returns at least 3 users when 3+ schedule-compatible matches exist", async () => {
    User.findById.mockReturnValue(
      makeSelectQuery({ blockedUsers: [], showOthersLocations: true })
    );
    User.find.mockReturnValue(
      makeSelectQuery([
        { _id: "u1", name: "Taylor", username: "taylor", city: "Denver", locationVisibility: "visible" },
        { _id: "u2", name: "Morgan", username: "morgan", city: "Austin", locationVisibility: "visible" },
        { _id: "u3", name: "Avery", username: "avery", city: "Seattle", locationVisibility: "visible" },
      ])
    );
    getReliabilityByUserIds.mockResolvedValue({
      u1: { score: 90, tier: "Reliable" },
      u2: { score: 75, tier: "Building" },
      u3: { score: 65, tier: "Building" },
    });
    rankCandidates.mockReturnValue([
      {
        _id: "u1",
        name: "Taylor",
        username: "taylor",
        city: "Denver",
        locationVisibility: "visible",
        reliability: { score: 90, tier: "Reliable" },
        matchScore: 87,
        matchReasons: ["Strong skill-family compatibility in your learning goals"],
      },
      {
        _id: "u2",
        name: "Morgan",
        username: "morgan",
        city: "Austin",
        locationVisibility: "visible",
        reliability: { score: 75, tier: "Building" },
        matchScore: 0,
        matchReasons: [],
      },
      {
        _id: "u3",
        name: "Avery",
        username: "avery",
        city: "Seattle",
        locationVisibility: "visible",
        reliability: { score: 65, tier: "Building" },
        matchScore: 0,
        matchReasons: ["Availability overlap on 1 day"],
      },
    ]);

    const response = await request(app).get("/api/for-you");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(response.body.map((user) => user._id)).toEqual(["u1", "u2", "u3"]);
  });

  test("hides matching telemetry unless explicitly enabled", async () => {
    User.findById.mockReturnValue(makeSelectQuery({ blockedUsers: [], showOthersLocations: true }));

    const response = await request(app).get("/api/for-you/matching-telemetry");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Not found");
  });
});