// server/routes/users.js
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
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
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    console.log("Created user:", user._id);
    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ message: "Error creating user" });
  }
});

// DELETE /api/users/:id - remove a user by id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  try {
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted", id: deleted._id });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Error deleting user" });
  }
});

// GET /api/users/profile - get current user profile
router.get("/profile", async (req, res) => {
  const auth = require("../middleware/auth");
  await auth(req, res, async () => {
    try {
      const user = await User.findById(req.userId).select("-passwordHash");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Migrate old firstName/lastName to name if needed
      const userData = user.toObject();
      if (!userData.name && (userData.firstName || userData.lastName)) {
        userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
        delete userData.firstName;
        delete userData.lastName;
      }
      
      res.json(userData);
    } catch (err) {
      console.error("Error fetching profile:", err);
      res.status(500).json({ message: "Error fetching profile" });
    }
  });
});

// PUT /api/users/profile - update current user profile
router.put("/profile", async (req, res) => {
  const auth = require("../middleware/auth");
  await auth(req, res, async () => {
    try {
      const { name, city, timeZone, bio, availability, skills } = req.body;

      if (!name || !city || !timeZone) {
        return res.status(400).json({ message: "Name, city, and time zone are required" });
      }

      const updateData = { name, city, timeZone, bio, availability, skills };
      
      // Remove old firstName/lastName if they exist
      const user = await User.findByIdAndUpdate(
        req.userId,
        { 
          $set: updateData,
          $unset: { firstName: "", lastName: "" }
        },
        { new: true, runValidators: true }
      ).select("-passwordHash");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (err) {
      console.error("Error updating profile:", err);
      res.status(500).json({ message: "Error updating profile" });
    }
  });
});

module.exports = router;