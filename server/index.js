// server/index.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const userRoutes = require("./routes/users");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

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

// start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
