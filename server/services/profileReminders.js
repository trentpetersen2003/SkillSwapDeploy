const User = require("../models/User");
const { isProfileSetupComplete, getIncompleteProfileFields } = require("./profileSetup");
const { sendProfileCompletionReminderEmail } = require("./email");

// Get cooldown days data.
function getCooldownDays() {
  const parsed = Number(process.env.EMAIL_PROFILE_REMINDER_COOLDOWN_DAYS || 7);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

// Check whether past cooldown .
function isPastCooldown(lastSentAt, cooldownDays) {
  if (!lastSentAt) {
    return true;
  }

  const elapsedMs = Date.now() - new Date(lastSentAt).getTime();
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
  return elapsedMs >= cooldownMs;
}

// Run send profile completion reminders logic.
async function sendProfileCompletionReminders({ limit } = {}) {
  const cooldownDays = getCooldownDays();
  const batchLimit = Number(limit || process.env.EMAIL_PROFILE_REMINDER_BATCH_SIZE || 50);

  const users = await User.find({}).select(
    "name email city state timeZone availability skills skillsWanted notificationPreferences lastProfileReminderAt"
  );

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    if (sent >= batchLimit) {
      break;
    }

    if (!user.email || !user.email.trim()) {
      skipped += 1;
      continue;
    }

    if (isProfileSetupComplete(user)) {
      skipped += 1;
      continue;
    }

    if (user.notificationPreferences?.profileReminderEmail === false) {
      skipped += 1;
      continue;
    }

    if (!isPastCooldown(user.lastProfileReminderAt, cooldownDays)) {
      skipped += 1;
      continue;
    }

    const missingFields = getIncompleteProfileFields(user);

    const result = await sendProfileCompletionReminderEmail({
      to: user.email,
      userName: user.name || "there",
      missingFields,
      preferenceEnabled: true,
    });

    if (result?.sent) {
      user.lastProfileReminderAt = new Date();
      await user.save();
      sent += 1;
      continue;
    }

    skipped += 1;
  }

  return {
    scanned: users.length,
    sent,
    skipped,
    cooldownDays,
    batchLimit,
  };
}

module.exports = {
  sendProfileCompletionReminders,
};
