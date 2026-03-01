const nodemailer = require("nodemailer");
const { Resend } = require("resend");

let cachedTransporter;
let cachedTestAccount;

function getEmailDeliveryMode() {
  const hasSmtpConfig =
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (process.env.NODE_ENV === "production" && process.env.RESEND_API_KEY) {
    return "resend";
  }

  if (hasSmtpConfig) {
    return "smtp";
  }

  return "ethereal-test";
}

function validateProductionEmailConfig() {
  if (process.env.NODE_ENV !== "production") {
    return { valid: true };
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      valid: false,
      message: "Startup blocked: RESEND_API_KEY is required in production.",
    };
  }

  if (!process.env.EMAIL_FROM) {
    return {
      valid: false,
      message: "Startup blocked: EMAIL_FROM is required in production.",
    };
  }

  return { valid: true };
}

async function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const hasSmtpConfig =
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (hasSmtpConfig) {
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
  const useResend = process.env.NODE_ENV === "production" && process.env.RESEND_API_KEY;

  if (useResend) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from,
      to,
      subject,
      text,
      html,
    });
    return;
  }

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
