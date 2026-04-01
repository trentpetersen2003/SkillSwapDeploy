// server/routes/forYou.js
const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { getReliabilityByUserIds } = require("../services/reliability");
const {
  rankCandidates,
  getMatchingTelemetrySnapshot,
  resetMatchingTelemetry,
} = require("../services/matching");

const router = express.Router();

function isMatchingTelemetryEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.ENABLE_MATCHING_TELEMETRY || "").toLowerCase() === "true"
  );
}

function canAccessMatchingTelemetry(req) {
  if (!isMatchingTelemetryEnabled()) {
    return false;
  }

  const requiredToken = process.env.MATCHING_TELEMETRY_TOKEN;
  if (!requiredToken) {
    return true;
  }

  return req.get("x-matching-telemetry-token") === requiredToken;
}

function sanitizePublicUser(userDoc, { viewerAllowsLocations = true } = {}) {
  const user = typeof userDoc.toObject === "function" ? userDoc.toObject() : { ...userDoc };

  if (!viewerAllowsLocations || user.locationVisibility === "hidden") {
    user.city = "";
    user.locationVisibility = "hidden";
  }

  return user;
}

router.get("/", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select(
      "blockedUsers showOthersLocations skills skillsWanted availability timeZone"
    );
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const viewerAllowsLocations = currentUser.showOthersLocations !== false;

    const usersWhoBlockedCurrent = await User.find({ blockedUsers: req.userId }).select("_id");
    const excludedIds = [
      req.userId,
      ...(currentUser.blockedUsers || []),
      ...usersWhoBlockedCurrent.map((user) => user._id),
    ];

    const users = await User.find({
      _id: { $nin: excludedIds },
    }).select("name username city locationVisibility timeZone bio availability skills skillsWanted");

    const reliabilityByUserId = await getReliabilityByUserIds(
      users.map((user) => user._id)
    );

    const rankedUsers = rankCandidates(currentUser, users, reliabilityByUserId);

    res.json(
      rankedUsers.map((user) => {
        const publicUser = sanitizePublicUser(user, { viewerAllowsLocations });
        return {
          ...publicUser,
          reliability: user.reliability || null,
          matchScore: user.matchScore,
          matchReasons: user.matchReasons,
        };
      })
    );
  } catch (err) {
    console.error("Error in GET /api/for-you:", err);
    res.status(500).json({ message: "Error loading users" });
  }
});

router.get("/matching-telemetry", auth, (req, res) => {
  if (!canAccessMatchingTelemetry(req)) {
    return res.status(404).json({ message: "Not found" });
  }

  return res.json(getMatchingTelemetrySnapshot());
});

router.delete("/matching-telemetry", auth, (req, res) => {
  if (!canAccessMatchingTelemetry(req)) {
    return res.status(404).json({ message: "Not found" });
  }

  resetMatchingTelemetry();
  return res.json({ message: "Matching telemetry reset" });
});

module.exports = router;