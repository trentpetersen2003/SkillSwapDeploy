const Swap = require("../models/Swap");
const mongoose = require("mongoose");

const COMPLETED_STATUS = "completed";
const CANCELLED_STATUS = "cancelled";
const FINALIZED_STATUSES = [COMPLETED_STATUS, CANCELLED_STATUS];

function safeRate(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
}

function determineTier(score) {
  if (score >= 85) return "Highly Reliable";
  if (score >= 70) return "Reliable";
  if (score >= 50) return "Building";
  return "Needs Follow-through";
}

function buildSummaryFromStats(stats) {
  const totalSwaps = Number(stats.totalSwaps || 0);
  const completedSwaps = Number(stats.completedSwaps || 0);
  const cancelledSwaps = Number(stats.cancelledSwaps || 0);
  const totalMilestones = Number(stats.totalMilestones || 0);
  const completedMilestones = Number(stats.completedMilestones || 0);
  const ratingsReceivedCount = Number(stats.ratingsReceivedCount || 0);
  const ratingsReceivedSum = Number(stats.ratingsReceivedSum || 0);

  const swapCompletionRate = safeRate(completedSwaps, totalSwaps);
  const milestoneCompletionRate = totalMilestones
    ? safeRate(completedMilestones, totalMilestones)
    : swapCompletionRate;

  if (totalSwaps === 0 || completedSwaps === 0) {
    return {
      score: null,
      tier: "New",
      totalSwaps,
      completedSwaps,
      cancelledSwaps,
      swapCompletionRate: 0,
      milestoneCompletionRate: 0,
      averageRating: null,
      ratingsReceivedCount: 0,
    };
  }

  const score = Math.round((swapCompletionRate * 0.7 + milestoneCompletionRate * 0.3) * 100);

  return {
    score,
    tier: determineTier(score),
    totalSwaps,
    completedSwaps,
    cancelledSwaps,
    swapCompletionRate: Number((swapCompletionRate * 100).toFixed(1)),
    milestoneCompletionRate: Number((milestoneCompletionRate * 100).toFixed(1)),
    averageRating: ratingsReceivedCount
      ? Number((ratingsReceivedSum / ratingsReceivedCount).toFixed(2))
      : null,
    ratingsReceivedCount,
  };
}

async function getReliabilityByUserIds(userIds = []) {
  const normalizedUserIds = (userIds || []).map((id) => String(id)).filter(Boolean);
  if (normalizedUserIds.length === 0) {
    return {};
  }

  const objectIds = normalizedUserIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (objectIds.length === 0) {
    return {};
  }

  const stats = await Swap.aggregate([
    {
      $match: {
        $or: [
          { requester: { $in: objectIds } },
          { recipient: { $in: objectIds } },
        ],
      },
    },
    {
      $project: {
        participants: ["$requester", "$recipient"],
        requester: 1,
        recipient: 1,
        status: 1,
        milestones: 1,
        reviews: 1,
      },
    },
    { $unwind: "$participants" },
    {
      $addFields: {
        participantIsRequester: { $eq: ["$participants", "$requester"] },
        receivedRating: {
          $cond: [
            "$participantIsRequester",
            "$reviews.recipientReview.rating",
            "$reviews.requesterReview.rating",
          ],
        },
      },
    },
    {
      $match: {
        participants: { $in: objectIds },
      },
    },
    {
      $group: {
        _id: "$participants",
        totalSwaps: {
          $sum: {
            $cond: [{ $in: ["$status", FINALIZED_STATUSES] }, 1, 0],
          },
        },
        completedSwaps: {
          $sum: {
            $cond: [{ $eq: ["$status", COMPLETED_STATUS] }, 1, 0],
          },
        },
        cancelledSwaps: {
          $sum: {
            $cond: [{ $eq: ["$status", CANCELLED_STATUS] }, 1, 0],
          },
        },
        totalMilestones: {
          $sum: { $size: { $ifNull: ["$milestones", []] } },
        },
        completedMilestones: {
          $sum: {
            $size: {
              $filter: {
                input: { $ifNull: ["$milestones", []] },
                as: "milestone",
                cond: { $eq: ["$$milestone.completed", true] },
              },
            },
          },
        },
        ratingsReceivedCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$receivedRating", null] },
                  { $gte: ["$receivedRating", 1] },
                  { $lte: ["$receivedRating", 5] },
                ],
              },
              1,
              0,
            ],
          },
        },
        ratingsReceivedSum: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$receivedRating", null] },
                  { $gte: ["$receivedRating", 1] },
                  { $lte: ["$receivedRating", 5] },
                ],
              },
              "$receivedRating",
              0,
            ],
          },
        },
      },
    },
  ]);

  const byUserId = {};
  normalizedUserIds.forEach((id) => {
    byUserId[id] = buildSummaryFromStats({});
  });

  stats.forEach((stat) => {
    const userId = String(stat._id);
    byUserId[userId] = buildSummaryFromStats(stat);
  });

  return byUserId;
}

module.exports = {
  getReliabilityByUserIds,
  buildSummaryFromStats,
};
