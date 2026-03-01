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
    delete process.env.RESEND_API_KEY;
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

  test("uses resend in production when api key is present", () => {
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";

    expect(getEmailDeliveryMode()).toBe("resend");
  });

  test("validates non-production as always valid", () => {
    process.env.NODE_ENV = "development";

    expect(validateProductionEmailConfig()).toEqual({ valid: true });
  });

  test("fails production config when RESEND_API_KEY is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_FROM = "SkillSwap <no-reply@example.com>";

    expect(validateProductionEmailConfig()).toEqual({
      valid: false,
      message: "Startup blocked: RESEND_API_KEY is required in production.",
    });
  });

  test("fails production config when EMAIL_FROM is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";

    expect(validateProductionEmailConfig()).toEqual({
      valid: false,
      message: "Startup blocked: EMAIL_FROM is required in production.",
    });
  });

  test("passes production config when required values are present", () => {
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "SkillSwap <no-reply@example.com>";

    expect(validateProductionEmailConfig()).toEqual({ valid: true });
  });
});
