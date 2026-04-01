// server/routes/forYou.js
const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { getReliabilityByUserIds } = require("../services/reliability");

const router = express.Router();

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
    const currentUser = await User.findById(req.userId).select("blockedUsers showOthersLocations");
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

    res.json(
      users.map((user) => {
        const publicUser = sanitizePublicUser(user, { viewerAllowsLocations });
        return {
          ...publicUser,
          reliability: reliabilityByUserId[String(user._id)] || null,
        };
      })
    );
  } catch (err) {
    console.error("Error in GET /api/for-you:", err);
    res.status(500).json({ message: "Error loading users" });
  }
});

module.exports = router;