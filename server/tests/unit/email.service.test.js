const {
  getEmailDeliveryMode,
  getEmailBudgetConfig,
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
    delete process.env.EMAIL_DELIVERY_MODE;
    delete process.env.EMAIL_DAILY_HARD_LIMIT;
    delete process.env.EMAIL_DAILY_SOFT_LIMIT;
    delete process.env.EMAIL_ENFORCE_DAILY_LIMIT;
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

  test("forces ethereal-test when EMAIL_DELIVERY_MODE is set", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.EMAIL_DELIVERY_MODE = "ethereal-test";

    expect(getEmailDeliveryMode()).toBe("ethereal-test");
  });

  test("forces smtp when EMAIL_DELIVERY_MODE is set", () => {
    process.env.EMAIL_DELIVERY_MODE = "smtp";

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

  test("fails production config when ethereal mode is forced", () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_DELIVERY_MODE = "ethereal-test";

    expect(validateProductionEmailConfig()).toEqual({
      valid: false,
      message: "Startup blocked: EMAIL_DELIVERY_MODE=ethereal-test is not allowed in production.",
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

  test("uses safe default daily email budget", () => {
    expect(getEmailBudgetConfig()).toEqual({
      enforce: true,
      hardLimit: 350,
      softLimit: 300,
    });
  });

  test("reads budget values from environment", () => {
    process.env.EMAIL_DAILY_HARD_LIMIT = "200";
    process.env.EMAIL_DAILY_SOFT_LIMIT = "150";
    process.env.EMAIL_ENFORCE_DAILY_LIMIT = "false";

    expect(getEmailBudgetConfig()).toEqual({
      enforce: false,
      hardLimit: 200,
      softLimit: 150,
    });
  });
});
