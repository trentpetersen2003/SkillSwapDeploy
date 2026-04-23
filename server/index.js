// server/index.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const swapRoutes = require("./routes/swaps");
const messageRoutes = require("./routes/messages");
const auth = require("./middleware/auth");
const forYouRoutes = require("./routes/forYou");
const { getEmailDeliveryMode, validateProductionEmailConfig } = require("./services/email");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Render sits behind a proxy; trust X-Forwarded-* for accurate client IP/protocol.
app.set("trust proxy", 1);

const productionEmailConfig = validateProductionEmailConfig();
if (!productionEmailConfig.valid) {
  console.warn(productionEmailConfig.message);
}

const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:3000",
  "https://sccapstone.github.io",
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  ...envAllowedOrigins,
].filter(Boolean);

// Run normalize origin logic.
function normalizeOrigin(origin) {
  return (origin || "").trim().replace(/\/+$/, "");
}

const allowedOriginSet = new Set(allowedOrigins.map(normalizeOrigin));

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOriginSet.has(normalizedOrigin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());

// TEMP route to verify auth middleware is working
app.get("/api/test-protected", auth, (req, res) => {
  res.json({
    message: "Protected route hit successfully",
    userId: req.userId,
  });
});

// connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/for-you", forYouRoutes);
app.use("/api/swaps", swapRoutes);
app.use("/api/messages", messageRoutes);

// start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Password reset email mode: ${getEmailDeliveryMode()}`);
});
