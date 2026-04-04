const mongoose = require("mongoose");

const emailDailyUsageSchema = new mongoose.Schema(
  {
    dayKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    totalSent: {
      type: Number,
      default: 0,
      min: 0,
    },
    transactionalSent: {
      type: Number,
      default: 0,
      min: 0,
    },
    notificationSent: {
      type: Number,
      default: 0,
      min: 0,
    },
    reminderSent: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("EmailDailyUsage", emailDailyUsageSchema);
