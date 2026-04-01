// server/models/Swap.js
const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    dueDate: {
      type: Date,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    _id: true,
  }
);

const participantReviewSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

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
    // Structured swap plan metadata
    totalSessions: {
      type: Number,
      default: 1,
      min: 1,
      max: 20,
    },
    milestones: {
      type: [milestoneSchema],
      default: [],
    },
    requesterConfirmedAt: {
      type: Date,
      default: null,
    },
    recipientConfirmedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    reviews: {
      requesterReview: {
        type: participantReviewSchema,
        default: null,
      },
      recipientReview: {
        type: participantReviewSchema,
        default: null,
      },
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