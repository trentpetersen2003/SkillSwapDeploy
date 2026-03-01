// server/routes/auth.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const PasswordResetToken = require("../models/PasswordResetToken");
const { sendPasswordResetEmail } = require("../services/email");

const router = express.Router();
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);
const PASSWORD_MIN_LENGTH = 8;
const RESET_RATE_WINDOW_MINUTES = Number(process.env.RESET_RATE_WINDOW_MINUTES || 15);
const FORGOT_PASSWORD_RATE_LIMIT_MAX = Number(process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX || 5);
const RESET_PASSWORD_RATE_LIMIT_MAX = Number(process.env.RESET_PASSWORD_RATE_LIMIT_MAX || 10);

const forgotPasswordLimiter = rateLimit({
  windowMs: RESET_RATE_WINDOW_MINUTES * 60 * 1000,
  max: FORGOT_PASSWORD_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please try again later." },
});

const resetPasswordLimiter = rateLimit({
  windowMs: RESET_RATE_WINDOW_MINUTES * 60 * 1000,
  max: RESET_PASSWORD_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many reset attempts. Please try again later." },
});

function logPasswordResetEvent(event, meta = {}) {
  console.log(`[password-reset] ${event}`, meta);
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password ) {
      return res
        .status(400)
        .json({ message: "Name, username, email, and password are required" });
    }

    // check if email already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    // check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ message: "Username is already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      username,
      email,
      passwordHash,
    });

    console.log("Registered user:", user._id);

    // for now, just return basic info
    res.status(201).json({
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    console.error("Error in /register:", err);
    res.status(500).json({ message: "Error registering user" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // simple JWT for protected routes
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Error in /login:", err);
    res.status(500).json({ message: "Error logging in" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.trim();
    logPasswordResetEvent("request.received", {
      email: normalizedEmail,
      ip: req.ip,
    });

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      logPasswordResetEvent("request.completed", {
        email: normalizedEmail,
        ip: req.ip,
        accountFound: false,
      });

      return res.json({
        message:
          "If an account exists for that email, a password reset link has been sent.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    const usedAt = new Date();

    await PasswordResetToken.updateMany(
      {
        userId: user._id,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt } }
    );

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const resetLink = `${clientUrl}/reset-password/${rawToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      resetLink,
    });

    logPasswordResetEvent("request.completed", {
      email: user.email,
      ip: req.ip,
      accountFound: true,
    });

    return res.json({
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (err) {
    logPasswordResetEvent("request.failed", {
      ip: req.ip,
      reason: err.message,
    });
    console.error("Error in /forgot-password:", err);
    return res.status(500).json({ message: "Error requesting password reset" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    logPasswordResetEvent("complete.received", {
      ip: req.ip,
    });

    if (!token || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "Token, password, and password confirmation are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res
        .status(400)
        .json({ message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetRecord = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      logPasswordResetEvent("complete.failed", {
        ip: req.ip,
        reason: "invalid-or-expired-token",
      });
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const user = await User.findById(resetRecord.userId);
    if (!user) {
      logPasswordResetEvent("complete.failed", {
        ip: req.ip,
        reason: "missing-user",
      });
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const sameAsCurrent = await bcrypt.compare(password, user.passwordHash);
    if (sameAsCurrent) {
      return res
        .status(400)
        .json({ message: "New password must be different from your current password" });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();

    const usedAt = new Date();
    await PasswordResetToken.updateMany(
      {
        userId: user._id,
        usedAt: null,
      },
      { $set: { usedAt } }
    );

    logPasswordResetEvent("complete.completed", {
      userId: String(user._id),
      ip: req.ip,
    });

    return res.json({ message: "Password reset successful" });
  } catch (err) {
    logPasswordResetEvent("complete.failed", {
      ip: req.ip,
      reason: err.message,
    });
    console.error("Error in /reset-password:", err);
    return res.status(500).json({ message: "Error resetting password" });
  }
});

module.exports = router;
