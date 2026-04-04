const Swap = require("../../models/Swap");
const {
  buildSummaryFromStats,
  getReliabilityByUserIds,
} = require("../../services/reliability");

jest.mock("../../models/Swap");

describe("Reliability Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns New tier when there is no swap history", () => {
    const summary = buildSummaryFromStats({});

    expect(summary).toEqual(
      expect.objectContaining({
        score: null,
        tier: "New",
        totalSwaps: 0,
        completedSwaps: 0,
      })
    );
  });

  test("calculates reliability score from completion rates", () => {
    const summary = buildSummaryFromStats({
      totalSwaps: 10,
      completedSwaps: 8,
      cancelledSwaps: 1,
      totalMilestones: 20,
      completedMilestones: 15,
      ratingsReceivedCount: 4,
      ratingsReceivedSum: 18,
    });

    expect(summary.score).toBe(78);
    expect(summary.tier).toBe("Reliable");
    expect(summary.swapCompletionRate).toBe(80);
    expect(summary.milestoneCompletionRate).toBe(75);
    expect(summary.averageRating).toBe(4.5);
    expect(summary.ratingsReceivedCount).toBe(4);
  });

  test("returns per-user reliability map from aggregate stats", async () => {
    const userId = "507f1f77bcf86cd799439011";
    Swap.aggregate.mockResolvedValue([
      {
        _id: userId,
        totalSwaps: 4,
        completedSwaps: 3,
        cancelledSwaps: 1,
        totalMilestones: 8,
        completedMilestones: 6,
        ratingsReceivedCount: 3,
        ratingsReceivedSum: 14,
      },
    ]);

    const result = await getReliabilityByUserIds([userId]);

    expect(Swap.aggregate).toHaveBeenCalledTimes(1);
    expect(result[userId]).toEqual(
      expect.objectContaining({
        score: 75,
        tier: "Reliable",
        totalSwaps: 4,
        averageRating: 4.67,
        ratingsReceivedCount: 3,
      })
    );
  });

  test("does not count unrated completed swaps toward average rating", () => {
    const summary = buildSummaryFromStats({
      totalSwaps: 3,
      completedSwaps: 3,
      cancelledSwaps: 0,
      totalMilestones: 3,
      completedMilestones: 3,
      ratingsReceivedCount: 0,
      ratingsReceivedSum: 0,
    });

    expect(summary.averageRating).toBeNull();
    expect(summary.ratingsReceivedCount).toBe(0);
  });
});
