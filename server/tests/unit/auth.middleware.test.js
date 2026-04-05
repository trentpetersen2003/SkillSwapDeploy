const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const auth = require("../../middleware/auth");

jest.mock("../../models/User");

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe("Auth Middleware", () => {
  const originalEnv = process.env.JWT_SECRET;
  let consoleErrorSpy;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-key";
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalEnv;
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe("Token validation", () => {
    test("should return 401 when no token is provided", async () => {
      const req = { headers: {} };
      const res = mockRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("No auth token provided");
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when authorization header is empty", async () => {
      const req = { headers: { authorization: "" } };
      const res = mockRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("No auth token provided");
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when authorization header exists but has no Bearer prefix", async () => {
      const req = { headers: { authorization: "InvalidToken123" } };
      const res = mockRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when token is invalid", async () => {
      const req = { headers: { authorization: "Bearer invalid.token.here" } };
      const res = mockRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Invalid or expired token");
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when token is expired", async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: "123", exp: Math.floor(Date.now() / 1000) - 3600 },
        "test-secret-key"
      );

      const req = { headers: { authorization: `Bearer ${expiredToken}` } };
      const res = mockRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Valid token handling", () => {
    test("should call next() when valid token is provided", async () => {
      const token = jwt.sign({ userId: "user123", tokenVersion: 0 }, "test-secret-key");
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();
      User.findById.mockResolvedValue({ tokenVersion: 0 });

      await auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBeNull();
    });

    test("should extract userId from valid token and attach to request", async () => {
      const token = jwt.sign({ userId: "user456", tokenVersion: 0 }, "test-secret-key");
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();
      User.findById.mockResolvedValue({ tokenVersion: 0 });

      await auth(req, res, next);

      expect(req.userId).toBe("user456");
      expect(next).toHaveBeenCalled();
    });

    test("should handle Bearer prefix case-sensitively", async () => {
      const token = jwt.sign({ userId: "user789", tokenVersion: 0 }, "test-secret-key");
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();
      User.findById.mockResolvedValue({ tokenVersion: 0 });

      await auth(req, res, next);

      expect(req.userId).toBe("user789");
      expect(next).toHaveBeenCalled();
    });

    test("should extract token correctly with Bearer prefix", async () => {
      const token = jwt.sign({ userId: "testuser", tokenVersion: 0 }, "test-secret-key");
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();
      User.findById.mockResolvedValue({ tokenVersion: 0 });

      await auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBeNull();
    });
  });

  describe("JWT secret handling", () => {
    test("should use JWT_SECRET from environment variable", async () => {
      process.env.JWT_SECRET = "custom-secret";
      const token = jwt.sign({ userId: "user999", tokenVersion: 0 }, "custom-secret");

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();
      User.findById.mockResolvedValue({ tokenVersion: 0 });

      await auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe("user999");
    });

    test("should use default secret if JWT_SECRET is not set", async () => {
      delete process.env.JWT_SECRET;
      const token = jwt.sign({ userId: "user111", tokenVersion: 0 }, "dev-secret");

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();
      User.findById.mockResolvedValue({ tokenVersion: 0 });

      await auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe("user111");
    });
  });

  describe("Error handling", () => {
    test("should return error message for malformed token", async () => {
      const req = { headers: { authorization: "Bearer malformed" } };
      const res = mockRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Invalid or expired token");
    });

    test("should not call next() on any error", async () => {
      const req = { headers: { authorization: "Bearer bad.token" } };
      const res = mockRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when user cannot be found", async () => {
      const token = jwt.sign({ userId: "missing-user", tokenVersion: 0 }, "test-secret-key");
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      User.findById.mockResolvedValue(null);

      await auth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("should return 401 when token version does not match", async () => {
      const token = jwt.sign({ userId: "user123", tokenVersion: 0 }, "test-secret-key");
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      User.findById.mockResolvedValue({ tokenVersion: 2 });

      await auth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Session has ended. Please log in again.");
      expect(next).not.toHaveBeenCalled();
    });
  });
});
