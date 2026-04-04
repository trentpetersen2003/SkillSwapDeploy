const nodemailer = require("nodemailer");

let cachedTransporter;
let cachedTestAccount;

const DELIVERY_MODES = {
  AUTO: "auto",
  SMTP: "smtp",
  ETHEREAL_TEST: "ethereal-test",
};

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

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
    auth: {
      user: cachedTestAccount.user,
      pass: cachedTestAccount.pass,
    },
  });

  return cachedTransporter;
}

async function sendPasswordResetEmail({ to, resetLink }) {
  const subject = "Reset your SkillSwap password";
  const text = `You requested a password reset for your SkillSwap account.\n\nReset your password using this link: ${resetLink}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.`;
  const html = `
    <p>You requested a password reset for your SkillSwap account.</p>
    <p><a href="${resetLink}">Reset your password</a></p>
    <p>This link expires in 30 minutes and can only be used once.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

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
    console.log("Password reset email preview:", previewUrl);
  }
}

module.exports = {
  sendPasswordResetEmail,
  getEmailDeliveryMode,
  validateProductionEmailConfig,
};
