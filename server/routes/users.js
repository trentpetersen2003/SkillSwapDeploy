// server/routes/users.js
const express = require("express");
const User = require("../models/User");

const router = express.Router();

// GET /api/users - list all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// POST /api/users - create a new user
router.post("/", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const user = await User.create({ name, email });

    console.log("Created user:", user._id);
    res.status(201).json(user);
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ message: "Error creating user" });
  }
});

module.exports = router;
