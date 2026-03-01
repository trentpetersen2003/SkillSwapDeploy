const {
  getEmailDeliveryMode,
  validateProductionEmailConfig,
} = require("../../services/email");

describe("Email service delivery mode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("uses ethereal-test by default in non-production", () => {
    expect(getEmailDeliveryMode()).toBe("ethereal-test");
  });

  test("uses smtp when smtp credentials are present", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    expect(getEmailDeliveryMode()).toBe("smtp");
  });

  test("validates non-production as always valid", () => {
    process.env.NODE_ENV = "development";

    expect(validateProductionEmailConfig()).toEqual({ valid: true });
  });

  test("fails production config when SMTP config is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_FROM = "SkillSwap <no-reply@example.com>";

    expect(validateProductionEmailConfig()).toEqual({
      valid: false,
      message: "Startup blocked: SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS are required in production.",
    });
  });

  test("fails production config when EMAIL_FROM is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "skillswap@example.com";
    process.env.SMTP_PASS = "app-password";

    expect(validateProductionEmailConfig()).toEqual({
      valid: false,
      message: "Startup blocked: EMAIL_FROM is required in production.",
    });
  });

  test("passes production config when SMTP values are present", () => {
    process.env.NODE_ENV = "production";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "skillswap@example.com";
    process.env.SMTP_PASS = "app-password";
    process.env.EMAIL_FROM = "SkillSwap <skillswap@example.com>";

    expect(validateProductionEmailConfig()).toEqual({ valid: true });
  });
});
