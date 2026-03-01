// server/models/User.js
const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
  },
  timeRange: {
    type: String,
    required: true,
  },
}, { _id: false });

const skillSchema = new mongoose.Schema({
  skillName: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  level: {
    type: String,
    required: true,
    enum: ['Novice', 'Proficient', 'Expert'],
  },
}, { _id: false });

const skillWantedSchema = new mongoose.Schema({
  skillName: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  level: {
    type: String,
    required: true,
    enum: ['Novice', 'Proficient', 'Expert'],
  },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    locationVisibility: {
      type: String,
      enum: ["visible", "hidden"],
      default: "visible",
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    timeZone: {
      type: String,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    availability: [availabilitySchema],
    skills: [skillSchema],
    skillsWanted: [skillWantedSchema],
    blockedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    notificationPreferences: {
      swapRequestEmail: {
        type: Boolean,
        default: true,
      },
      swapConfirmedEmail: {
        type: Boolean,
        default: true,
      },
      swapCancelledEmail: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
