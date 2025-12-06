// server/models/Swap.js
const mongoose = require("mongoose");

const swapSchema = new mongoose.Schema(
  {
    // The user who initiated/requested the swap
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The user who is being asked to swap
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // What skill the requester is offering
    skillOffered: {
      type: String,
      required: true,
      trim: true,
    },
    // What skill the requester wants to learn
    skillWanted: {
      type: String,
      required: true,
      trim: true,
    },
    // When the swap is scheduled
    scheduledDate: {
      type: Date,
      required: true,
    },
    // Duration in minutes
    duration: {
      type: Number,
      default: 60,
    },
    // Location or meeting link
    location: {
      type: String,
      trim: true,
    },
    // Status of the swap
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
    // Optional notes
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Swap", swapSchema);