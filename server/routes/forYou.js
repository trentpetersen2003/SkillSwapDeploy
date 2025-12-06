// server/routes/forYou.js
const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    // Get all users except the current user
    const users = await User.find({
      _id: { $ne: req.userId },
    }).select("name username city timeZone bio availability skills skillsWanted");

    res.json(users);
  } catch (err) {
    console.error("Error in GET /api/for-you:", err);
    res.status(500).json({ message: "Error loading users" });
  }
});

module.exports = router;