const nodemailer = require("nodemailer");
const EmailDailyUsage = require("../models/EmailDailyUsage");

let cachedTransporter;
let cachedTestAccount;

const DELIVERY_MODES = {
  AUTO: "auto",
  SMTP: "smtp",
  ETHEREAL_TEST: "ethereal-test",
};

const EMAIL_CATEGORY = {
  TRANSACTIONAL: "transactional",
  NOTIFICATION: "notification",
  REMINDER: "reminder",
};

const EMAIL_PRIORITY = {
  CRITICAL: "critical",
  NORMAL: "normal",
  LOW: "low",
};

// Get today key data.
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Run to number logic.
function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Get email budget config data.
function getEmailBudgetConfig() {
  const hardLimit = Math.max(1, toNumber(process.env.EMAIL_DAILY_HARD_LIMIT, 350));
  const softLimit = Math.max(1, toNumber(process.env.EMAIL_DAILY_SOFT_LIMIT, 300));

  return {
    enforce: String(process.env.EMAIL_ENFORCE_DAILY_LIMIT || "true").toLowerCase() !== "false",
    hardLimit,
    softLimit: Math.min(softLimit, hardLimit),
  };
}

// Get counter field by category data.
function getCounterFieldByCategory(category) {
  if (category === EMAIL_CATEGORY.TRANSACTIONAL) {
    return "transactionalSent";
  }

  if (category === EMAIL_CATEGORY.REMINDER) {
    return "reminderSent";
  }

  return "notificationSent";
}

// Run reserve daily email slot logic.
async function reserveDailyEmailSlot({ category, priority }) {
  const config = getEmailBudgetConfig();
  if (!config.enforce) {
    return { allowed: true, reason: "budget-disabled" };
  }

  const todayKey = getTodayKey();
  const counterField = getCounterFieldByCategory(category);

  await EmailDailyUsage.updateOne(
    { dayKey: todayKey },
    {
      $setOnInsert: {
        dayKey: todayKey,
        totalSent: 0,
        transactionalSent: 0,
        notificationSent: 0,
        reminderSent: 0,
      },
    },
    { upsert: true }
  );

  let applicableLimit = config.hardLimit;
  if (category === EMAIL_CATEGORY.REMINDER || priority === EMAIL_PRIORITY.LOW) {
    applicableLimit = config.softLimit;
  }

  const updateResult = await EmailDailyUsage.updateOne(
    {
      dayKey: todayKey,
      totalSent: { $lt: applicableLimit },
    },
    {
      $inc: {
        totalSent: 1,
        [counterField]: 1,
      },
    }
  );

  if (!updateResult.matchedCount) {
    return {
      allowed: false,
      reason: `daily-limit-reached (${applicableLimit})`,
    };
  }

  return {
    allowed: true,
    reason: "reserved",
  };
}

// Build swap dashboard link payload.
function buildSwapDashboardLink() {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  return `${clientUrl}/swaps`;
}

// Check whether smtp config .
function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

// Get configured email mode data.
function getConfiguredEmailMode() {
  const configuredMode = (process.env.EMAIL_DELIVERY_MODE || DELIVERY_MODES.AUTO)
    .trim()
    .toLowerCase();

  if (configuredMode === DELIVERY_MODES.SMTP) {
    return DELIVERY_MODES.SMTP;
  }

  if (configuredMode === "ethereal" || configuredMode === DELIVERY_MODES.ETHEREAL_TEST) {
    return DELIVERY_MODES.ETHEREAL_TEST;
  }

  return DELIVERY_MODES.AUTO;
}

// Get email delivery mode data.
function getEmailDeliveryMode() {
  const configuredMode = getConfiguredEmailMode();

  if (configuredMode === DELIVERY_MODES.SMTP) {
    return DELIVERY_MODES.SMTP;
  }

  if (configuredMode === DELIVERY_MODES.ETHEREAL_TEST) {
    return DELIVERY_MODES.ETHEREAL_TEST;
  }

  if (hasSmtpConfig()) {
    return DELIVERY_MODES.SMTP;
  }

  return DELIVERY_MODES.ETHEREAL_TEST;
}

// Run validate production email config logic.
function validateProductionEmailConfig() {
  if (process.env.NODE_ENV !== "production") {
    return { valid: true };
  }

  const configuredMode = getConfiguredEmailMode();

  if (configuredMode === DELIVERY_MODES.ETHEREAL_TEST) {
    return {
      valid: false,
      message: "Startup blocked: EMAIL_DELIVERY_MODE=ethereal-test is not allowed in production.",
    };
  }

  if (!process.env.EMAIL_FROM) {
    return {
      valid: false,
      message: "Startup blocked: EMAIL_FROM is required in production.",
    };
  }

  if (!hasSmtpConfig()) {
    return {
      valid: false,
      message:
        "Startup blocked: SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS are required in production.",
    };
  }

  return { valid: true };
}

// Get transporter data.
async function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const mode = getEmailDeliveryMode();

  if (mode === DELIVERY_MODES.SMTP) {
    if (!hasSmtpConfig()) {
      throw new Error(
        "SMTP delivery mode requires SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS."
      );
    }

    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      connectionTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    return cachedTransporter;
  }

  if (!cachedTestAccount) {
    cachedTestAccount = await nodemailer.createTestAccount();
  }

  cachedTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    connectionTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: cachedTestAccount.user,
      pass: cachedTestAccount.pass,
    },
  });

  return cachedTransporter;
}

// Run send email logic.
async function sendEmail({
  to,
  subject,
  text,
  html,
  category,
  priority,
  preferenceEnabled = true,
  logLabel,
}) {
  if (!to) {
    return { sent: false, skipped: true, reason: "missing-recipient" };
  }

  if (preferenceEnabled === false) {
    return { sent: false, skipped: true, reason: "preference-disabled" };
  }

  const slot = await reserveDailyEmailSlot({ category, priority });
  if (!slot.allowed) {
    console.log(`[email] skipped ${logLabel}`, { to, reason: slot.reason });
    return { sent: false, skipped: true, reason: slot.reason };
  }

  const from = process.env.EMAIL_FROM || "SkillSwap <no-reply@skillswap.local>";
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`${logLabel} preview:`, previewUrl);
  }

  return { sent: true, skipped: false };
}

// Run send password reset email logic.
async function sendPasswordResetEmail({ to, resetLink }) {
  const subject = "Reset your SkillSwap password";
  const text = `You requested a password reset for your SkillSwap account.\n\nReset your password using this link: ${resetLink}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.`;
  const html = `
    <p>You requested a password reset for your SkillSwap account.</p>
    <p><a href="${resetLink}">Reset your password</a></p>
    <p>This link expires in 30 minutes and can only be used once.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
    category: EMAIL_CATEGORY.TRANSACTIONAL,
    priority: EMAIL_PRIORITY.CRITICAL,
    logLabel: "Password reset email",
  });
}

// Run send swap request email logic.
async function sendSwapRequestEmail({
  to,
  recipientName,
  requesterName,
  skillOffered,
  skillWanted,
  scheduledDate,
  preferenceEnabled = true,
}) {
  const dashboardLink = buildSwapDashboardLink();
  const friendlyDate = new Date(scheduledDate).toLocaleString();
  const subject = `${requesterName} sent you a new swap request`;
  const text = `Hi ${recipientName},\n\n${requesterName} requested a skill swap with you.\nOffered: ${skillOffered}\nWanted: ${skillWanted}\nProposed time: ${friendlyDate}\n\nReview the request: ${dashboardLink}`;
  const html = `
    <p>Hi ${recipientName},</p>
    <p><strong>${requesterName}</strong> requested a skill swap with you.</p>
    <p>Offered: ${skillOffered}<br/>Wanted: ${skillWanted}<br/>Proposed time: ${friendlyDate}</p>
    <p><a href="${dashboardLink}">Review this request</a></p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
    category: EMAIL_CATEGORY.NOTIFICATION,
    priority: EMAIL_PRIORITY.NORMAL,
    preferenceEnabled,
    logLabel: "Swap request email",
  });
}

// Run send swap accepted email logic.
async function sendSwapAcceptedEmail({
  to,
  requesterName,
  recipientName,
  skillOffered,
  skillWanted,
  scheduledDate,
  preferenceEnabled = true,
}) {
  const dashboardLink = buildSwapDashboardLink();
  const friendlyDate = new Date(scheduledDate).toLocaleString();
  const subject = `${recipientName} accepted your swap request`;
  const text = `Hi ${requesterName},\n\n${recipientName} accepted your swap request.\nOffered: ${skillOffered}\nWanted: ${skillWanted}\nScheduled time: ${friendlyDate}\n\nView your swaps: ${dashboardLink}`;
  const html = `
    <p>Hi ${requesterName},</p>
    <p><strong>${recipientName}</strong> accepted your swap request.</p>
    <p>Offered: ${skillOffered}<br/>Wanted: ${skillWanted}<br/>Scheduled time: ${friendlyDate}</p>
    <p><a href="${dashboardLink}">View your swaps</a></p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
    category: EMAIL_CATEGORY.NOTIFICATION,
    priority: EMAIL_PRIORITY.NORMAL,
    preferenceEnabled,
    logLabel: "Swap accepted email",
  });
}

// Run send swap cancelled email logic.
async function sendSwapCancelledEmail({
  to,
  recipientName,
  actorName,
  skillOffered,
  skillWanted,
  scheduledDate,
  preferenceEnabled = true,
}) {
  const dashboardLink = buildSwapDashboardLink();
  const friendlyDate = new Date(scheduledDate).toLocaleString();
  const subject = `${actorName} cancelled a swap`;
  const text = `Hi ${recipientName},\n\n${actorName} cancelled your scheduled swap.\nOffered: ${skillOffered}\nWanted: ${skillWanted}\nOriginal time: ${friendlyDate}\n\nSee your swaps: ${dashboardLink}`;
  const html = `
    <p>Hi ${recipientName},</p>
    <p><strong>${actorName}</strong> cancelled your scheduled swap.</p>
    <p>Offered: ${skillOffered}<br/>Wanted: ${skillWanted}<br/>Original time: ${friendlyDate}</p>
    <p><a href="${dashboardLink}">See your swaps</a></p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
    category: EMAIL_CATEGORY.NOTIFICATION,
    priority: EMAIL_PRIORITY.NORMAL,
    preferenceEnabled,
    logLabel: "Swap cancelled email",
  });
}

// Run send profile completion reminder email logic.
async function sendProfileCompletionReminderEmail({
  to,
  userName,
  missingFields,
  preferenceEnabled = true,
}) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const profileLink = `${clientUrl}/profile`;
  const subject = "Complete your SkillSwap profile";
  const fieldList = missingFields.join(", ");
  const text = `Hi ${userName},\n\nPlease complete your profile to unlock swap features.\nMissing items: ${fieldList}\n\nUpdate your profile: ${profileLink}`;
  const html = `
    <p>Hi ${userName},</p>
    <p>Please complete your profile to unlock swap features.</p>
    <p>Missing items: ${fieldList}</p>
    <p><a href="${profileLink}">Update your profile</a></p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
    category: EMAIL_CATEGORY.REMINDER,
    priority: EMAIL_PRIORITY.LOW,
    preferenceEnabled,
    logLabel: "Profile reminder email",
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendSwapRequestEmail,
  sendSwapAcceptedEmail,
  sendSwapCancelledEmail,
  sendProfileCompletionReminderEmail,
  getEmailDeliveryMode,
  validateProductionEmailConfig,
  getEmailBudgetConfig,
};
