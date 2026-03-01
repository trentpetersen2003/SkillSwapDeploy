// server/routes/forYou.js
const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

function sanitizePublicUser(userDoc) {
  const user = typeof userDoc.toObject === "function" ? userDoc.toObject() : { ...userDoc };

  if (user.locationVisibility === "hidden") {
    user.city = "";
  }

  return user;
}

router.get("/", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select("blockedUsers");
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const usersWhoBlockedCurrent = await User.find({ blockedUsers: req.userId }).select("_id");
    const excludedIds = [
      req.userId,
      ...(currentUser.blockedUsers || []),
      ...usersWhoBlockedCurrent.map((user) => user._id),
    ];

    const users = await User.find({
      _id: { $nin: excludedIds },
    }).select("name username city locationVisibility timeZone bio availability skills skillsWanted");

    res.json(users.map(sanitizePublicUser));
  } catch (err) {
    console.error("Error in GET /api/for-you:", err);
    res.status(500).json({ message: "Error loading users" });
  }
});

module.exports = router;