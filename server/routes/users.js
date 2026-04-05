// server/routes/users.js
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { getReliabilityByUserIds } = require("../services/reliability");
const { rankCandidates } = require("../services/matching");

const router = express.Router();
const PASSWORD_MIN_LENGTH = 8;
const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Run sanitize public user logic.
function sanitizePublicUser(userDoc, { viewerAllowsLocations = true } = {}) {
  const user = typeof userDoc.toObject === "function" ? userDoc.toObject() : { ...userDoc };

  if (!viewerAllowsLocations || user.locationVisibility === "hidden") {
    user.city = "";
    user.state = "";
    user.locationVisibility = "hidden";
  }

  return user;
}

// Parse multi value param input.
function parseMultiValueParam(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

// GET /api/users - list all users with search/filter
router.get("/", auth, async (req, res) => {
  try {
    const {
      search,
      category,
      sortBy,
      location,
      minRating,
      availabilityDay,
      swapMode,
    } = req.query;
    const requestedAvailabilityDays = parseMultiValueParam(availabilityDay);
    const requestedSwapModes = parseMultiValueParam(swapMode);
    const requestedCategories = parseMultiValueParam(category);
    const requestedLocation = typeof location === "string" ? location.trim() : "";
    const requestedMinRating =
      minRating !== undefined && minRating !== null && minRating !== ""
        ? Number(minRating)
        : null;

    if (
      requestedAvailabilityDays.length > 0 &&
      requestedAvailabilityDays.some((day) => !DAYS_OF_WEEK.includes(day))
    ) {
      return res.status(400).json({ message: "availabilityDay must be a valid weekday" });
    }

    if (requestedSwapModes.length > 0 && requestedSwapModes.some(
      (mode) => !["online", "in-person", "either"].includes(mode)
    )) {
      return res.status(400).json({ message: "swapMode must be online, in-person, or either" });
    }

    if (
      requestedMinRating !== null &&
      (!Number.isFinite(requestedMinRating) || requestedMinRating < 1 || requestedMinRating > 5)
    ) {
      return res.status(400).json({ message: "minRating must be a number between 1 and 5" });
    }

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

    const query = {
      _id: { $nin: excludedIds },
    };

    const andConditions = [];

    if (search) {
      andConditions.push({
        $or: [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { "skills.skillName": { $regex: search, $options: "i" } },
        { "skillsWanted.skillName": { $regex: search, $options: "i" } },
        ],
      });
    }

    if (requestedCategories.length > 0) {
      andConditions.push({
        $or: [
          { "skills.category": { $in: requestedCategories } },
          { "skillsWanted.category": { $in: requestedCategories } },
        ],
      });
    }

    if (requestedLocation && viewerAllowsLocations) {
      andConditions.push({
        $or: [
          { city: { $regex: requestedLocation, $options: "i" } },
          { state: { $regex: requestedLocation, $options: "i" } },
        ],
        locationVisibility: { $ne: "hidden" },
      });
    }

    if (requestedAvailabilityDays.length > 0) {
      andConditions.push({
        availability: { $elemMatch: { day: { $in: requestedAvailabilityDays } } },
      });
    }

    if (requestedSwapModes.length > 0) {
      const allowedModes = new Set();
      let includeLegacyMissingMode = false;

      requestedSwapModes.forEach((mode) => {
        if (mode === "online") {
          allowedModes.add("online");
          allowedModes.add("either");
          includeLegacyMissingMode = true;
        } else if (mode === "in-person") {
          allowedModes.add("in-person");
          allowedModes.add("either");
          includeLegacyMissingMode = true;
        } else if (mode === "either") {
          allowedModes.add("either");
          includeLegacyMissingMode = true;
        }
      });

      const swapModeOr = [{ swapMode: { $in: Array.from(allowedModes) } }];
      if (includeLegacyMissingMode) {
        swapModeOr.push({ swapMode: { $exists: false } });
      }

      andConditions.push({ $or: swapModeOr });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const users = await User.find(query)
      .select(
        "name username email city state locationVisibility showOthersLocations phoneNumber timeZone bio swapMode availability skills skillsWanted notificationPreferences lastProfileReminderAt createdAt updatedAt"
      )
      .sort({ createdAt: 1 });

    const reliabilityByUserId = await getReliabilityByUserIds(
      users.map((user) => user._id)
    );

    const withMatch = rankCandidates(currentUser, users, reliabilityByUserId);
    const resultUsers = sortBy === "created" ? users : withMatch;

    const filteredUsers =
      requestedMinRating === null
        ? resultUsers
        : resultUsers.filter((user) => {
            const reliability = user.reliability || reliabilityByUserId[String(user._id)] || null;
            const averageRating = Number(reliability?.averageRating || 0);
            return Number.isFinite(averageRating) && averageRating >= requestedMinRating;
          });

    res.json(
      filteredUsers.map((user) => {
        const publicUser = sanitizePublicUser(user, { viewerAllowsLocations });
        return {
          ...publicUser,
          reliability: user.reliability || reliabilityByUserId[String(user._id)] || null,
          matchScore: user.matchScore,
          matchReasons: user.matchReasons,
        };
      })
    );
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
router.delete("/:id", auth, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  if (String(id) !== String(req.userId)) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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
    const user = await User.findById(req.userId).select("-passwordHash -tokenVersion");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Migrate old firstName/lastName to name if needed
    const userData = user.toObject();
    
    // Ensure showOthersLocations is always a boolean (default to true if not set)
    if (userData.showOthersLocations === undefined || userData.showOthersLocations === null) {
      userData.showOthersLocations = true;
    }
    
    if (!userData.name && (userData.firstName || userData.lastName)) {
      userData.name = `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
      delete userData.firstName;
      delete userData.lastName;
    }

    const reliabilityByUserId = await getReliabilityByUserIds([req.userId]);

    res.json({
      ...userData,
      reliability: reliabilityByUserId[String(req.userId)] || null,
    });
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
      state,
      phoneNumber,
      timeZone,
      swapMode,
      availability,
      skills,
      skillsWanted,
    } = req.body;

    if (!name || !email || !city || !state || !timeZone) {
      return res
        .status(400)
        .json({ message: "Name, email, city, state, and time zone are required" });
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
      state,
      phoneNumber,
      timeZone,
      availability,
      skills,
      skillsWanted,
    };

    if (swapMode !== undefined) {
      if (!["either", "online", "in-person"].includes(swapMode)) {
        return res
          .status(400)
          .json({ message: "swapMode must be either, online, or in-person" });
      }
      updateData.swapMode = swapMode;
    }

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

// PUT /api/users/location-visibility - update location privacy settings
router.put("/location-visibility", auth, async (req, res) => {
  try {
    const { locationVisibility, showOthersLocations } = req.body;
    const updates = {};

    if (locationVisibility !== undefined) {
      if (!["visible", "hidden"].includes(locationVisibility)) {
        return res.status(400).json({ message: "locationVisibility must be 'visible' or 'hidden'" });
      }
      updates.locationVisibility = locationVisibility;
    }

    if (showOthersLocations !== undefined) {
      updates.showOthersLocations = Boolean(showOthersLocations);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "At least one location privacy setting is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("locationVisibility showOthersLocations");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      locationVisibility: user.locationVisibility,
      showOthersLocations: user.showOthersLocations !== false,
    });
  } catch (err) {
    console.error("Error updating location visibility:", err);
    res.status(500).json({ message: "Error updating location visibility" });
  }
});

// PUT /api/users/notifications - update notification preferences
router.put("/notifications", auth, async (req, res) => {
  try {
    const { notificationPreferences } = req.body;

    if (!notificationPreferences || typeof notificationPreferences !== "object") {
      return res.status(400).json({ message: "notificationPreferences is required" });
    }

    const existingUser = await User.findById(req.userId).select("notificationPreferences");
    if (!existingUser) return res.status(404).json({ message: "User not found" });

    const current = existingUser.notificationPreferences || {};

    const updates = {
      "notificationPreferences.swapRequestEmail":
        notificationPreferences.swapRequestEmail !== undefined
          ? Boolean(notificationPreferences.swapRequestEmail)
          : current.swapRequestEmail ?? true,
      "notificationPreferences.swapConfirmedEmail":
        notificationPreferences.swapConfirmedEmail !== undefined
          ? Boolean(notificationPreferences.swapConfirmedEmail)
          : current.swapConfirmedEmail ?? true,
      "notificationPreferences.swapCancelledEmail":
        notificationPreferences.swapCancelledEmail !== undefined
          ? Boolean(notificationPreferences.swapCancelledEmail)
          : current.swapCancelledEmail ?? true,
      "notificationPreferences.profileReminderEmail":
        notificationPreferences.profileReminderEmail !== undefined
          ? Boolean(notificationPreferences.profileReminderEmail)
          : current.profileReminderEmail ?? true,
    };

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("notificationPreferences");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ notificationPreferences: user.notificationPreferences });
  } catch (err) {
    console.error("Error updating notification preferences:", err);
    res.status(500).json({ message: "Error updating notification preferences" });
  }
});

// PUT /api/users/password - change current user password
router.put("/password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "Current password, new password, and confirmation are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return res
        .status(400)
        .json({ message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const sameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (sameAsCurrent) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).json({ message: "Error updating password" });
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

// GET /api/users/blocked/status?ids=<id1,id2,...> - get block relationship status for users
router.get("/blocked/status", auth, async (req, res) => {
  try {
    const rawIds = String(req.query.ids || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const targetIds = Array.from(new Set(rawIds)).filter((id) => (
      mongoose.Types.ObjectId.isValid(id) && id !== req.userId
    ));

    if (targetIds.length === 0) {
      return res.json({ statuses: {} });
    }

    const [currentUser, usersWhoBlockedCurrent] = await Promise.all([
      User.findById(req.userId).select("blockedUsers"),
      User.find({ _id: { $in: targetIds }, blockedUsers: req.userId }).select("_id"),
    ]);

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUserBlockedIds = new Set(
      (currentUser.blockedUsers || []).map((id) => String(id))
    );
    const blockedMeIds = new Set(
      usersWhoBlockedCurrent.map((user) => String(user._id))
    );

    const statuses = {};
    targetIds.forEach((id) => {
      statuses[id] = {
        iBlocked: currentUserBlockedIds.has(id),
        blockedMe: blockedMeIds.has(id),
      };
    });

    res.json({ statuses });
  } catch (err) {
    console.error("Error loading blocked relationship statuses:", err);
    res.status(500).json({ message: "Error loading blocked relationship statuses" });
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
