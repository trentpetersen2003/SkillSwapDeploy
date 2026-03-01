// server/routes/users.js
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
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

// GET /api/users - list all users with search/filter
router.get("/", auth, async (req, res) => {
  try {
    const { search, category } = req.query;
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

    let query = {
      _id: { $nin: excludedIds },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { "skills.skillName": { $regex: search, $options: "i" } },
        { "skillsWanted.skillName": { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      const categoryFilter = [
        { "skills.category": category },
        { "skillsWanted.category": category },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: categoryFilter }];
        delete query.$or;
      } else {
        query.$or = categoryFilter;
      }
    }

    const users = await User.find(query)
      .select("-passwordHash -blockedUsers")
      .sort({ createdAt: 1 });

    res.json(users.map(sanitizePublicUser));
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// POST /api/users - create a new user
router.post("/", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, username, email, and password are required" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ message: "Username is already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, username, email, passwordHash });

    res.status(201).json({
      id: user._id,
      name: user.name,
      username: user.username,
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
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Migrate old firstName/lastName to name if needed
    const userData = user.toObject();
    if (!userData.name && (userData.firstName || userData.lastName)) {
      userData.name = `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
      delete userData.firstName;
      delete userData.lastName;
    }

    res.json(userData);
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// PUT /api/users/profile - update current user profile
router.put("/profile", auth, async (req, res) => {
  try {
    const {
      name,
      email,
      city,
      phoneNumber,
      timeZone,
      bio,
      availability,
      skills,
      skillsWanted,
    } = req.body;

    if (!name || !email || !city || !timeZone) {
      return res
        .status(400)
        .json({ message: "Name, email, city, and time zone are required" });
    }

    // Email uniqueness check
    const existingEmail = await User.findOne({
      email,
      _id: { $ne: req.userId },
    });
    if (existingEmail) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    const updateData = {
      name,
      email,
      city,
      phoneNumber,
      timeZone,
      bio,
      availability,
      skills,
      skillsWanted,
    };

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: updateData,
        $unset: { firstName: "", lastName: "" },
      },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ message: "Error updating profile" });
  }
});

// PUT /api/users/username - update username only 
router.put("/username", auth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ message: "Username is required" });
    }

    const clean = username.trim();

    const existing = await User.findOne({
      username: clean,
      _id: { $ne: req.userId },
    });
    if (existing) {
      return res.status(409).json({ message: "Username is already taken" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { username: clean } },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Error updating username:", err);
    res.status(500).json({ message: "Error updating username" });
  }
});

// PUT /api/users/location-visibility - update location visibility setting
router.put("/location-visibility", auth, async (req, res) => {
  try {
    const { locationVisibility } = req.body;

    if (!["visible", "hidden"].includes(locationVisibility)) {
      return res.status(400).json({ message: "locationVisibility must be 'visible' or 'hidden'" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { locationVisibility } },
      { new: true, runValidators: true }
    ).select("locationVisibility");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ locationVisibility: user.locationVisibility });
  } catch (err) {
    console.error("Error updating location visibility:", err);
    res.status(500).json({ message: "Error updating location visibility" });
  }
});

// GET /api/users/blocked - list blocked users for current user
router.get("/blocked", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("blockedUsers", "name username")
      .select("blockedUsers");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.blockedUsers || []);
  } catch (err) {
    console.error("Error loading blocked users:", err);
    res.status(500).json({ message: "Error loading blocked users" });
  }
});

// POST /api/users/blocked - block a user
router.post("/blocked", auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "Valid targetUserId is required" });
    }

    if (targetUserId === req.userId) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    const targetUser = await User.findById(targetUserId).select("_id");
    if (!targetUser) {
      return res.status(404).json({ message: "User to block not found" });
    }

    const existing = await User.findOne({
      _id: req.userId,
      blockedUsers: targetUserId,
    }).select("_id");

    if (existing) {
      return res.status(409).json({ message: "User is already blocked" });
    }

    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { blockedUsers: targetUserId },
    });

    res.status(201).json({ message: "User blocked" });
  } catch (err) {
    console.error("Error blocking user:", err);
    res.status(500).json({ message: "Error blocking user" });
  }
});

// DELETE /api/users/blocked/:blockedUserId - unblock a user
router.delete("/blocked/:blockedUserId", auth, async (req, res) => {
  try {
    const { blockedUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(blockedUserId)) {
      return res.status(400).json({ message: "Invalid blocked user id" });
    }

    await User.findByIdAndUpdate(req.userId, {
      $pull: { blockedUsers: blockedUserId },
    });

    res.json({ message: "User unblocked" });
  } catch (err) {
    console.error("Error unblocking user:", err);
    res.status(500).json({ message: "Error unblocking user" });
  }
});

module.exports = router;