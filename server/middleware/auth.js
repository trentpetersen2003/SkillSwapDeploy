// server/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function auth(req, res, next) {
  const authHeader = req.headers.authorization || "";

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "No auth token provided" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = await User.findById(payload.userId, "tokenVersion");

    if (!user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const tokenVersion = Number(payload.tokenVersion || 0);
    if (tokenVersion !== Number(user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Session has ended. Please log in again." });
    }

    req.userId = payload.userId;
    next();
  } catch (err) {
    console.error("Invalid token:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = auth;
