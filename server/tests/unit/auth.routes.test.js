const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const PasswordResetToken = require("../../models/PasswordResetToken");
const { sendPasswordResetEmail } = require("../../services/email");
const authRoutes = require("../../routes/auth");

// Mock User model
jest.mock("../../models/User");
jest.mock("../../models/PasswordResetToken");
jest.mock("../../services/email", () => ({
  sendPasswordResetEmail: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

describe("Auth Routes", () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (consoleLogSpy) {
      consoleLogSpy.mockRestore();
    }
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe("POST /api/auth/register", () => {
    test("should register a new user successfully", async () => {
      const newUser = {
        _id: "123",
        name: "John Doe",
        username: "johndoe",
        email: "john@example.com",
        passwordHash: await bcrypt.hash("password123", 10),
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(newUser);

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "John Doe",
          username: "johndoe",
          email: "john@example.com",
          password: "password123",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe("John Doe");
      expect(response.body.username).toBe("johndoe");
      expect(response.body.email).toBe("john@example.com");
    });

    test("should return 400 if name is missing", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "test@example.com",
          password: "password123",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Name, username, email, and password are required"
      );
    });

    test("should return 400 if email is missing", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          username: "testuser",
          password: "password123",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Name, username, email, and password are required"
      );
    });

    test("should return 400 if password is missing", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          username: "testuser",
          email: "test@example.com",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Name, username, email, and password are required"
      );
    });

    test("should return 409 if email already exists", async () => {
      User.findOne.mockResolvedValueOnce({ email: "existing@example.com" });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "New User",
          username: "newuser",
          email: "existing@example.com",
          password: "password123",
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Email is already in use");
    });

    test("should return 409 if username already exists", async () => {
      User.findOne
        .mockResolvedValueOnce(null) // First check for email
        .mockResolvedValueOnce({ username: "existinguser" }); // Second check for username

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "New User",
          username: "existinguser",
          email: "new@example.com",
          password: "password123",
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Username is already taken");
    });

    test("should hash password before storing", async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: "123",
        name: "Test User",
        username: "testuser",
        email: "test@example.com",
      });

      jest.spyOn(bcrypt, "hash");

      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          username: "testuser",
          email: "test@example.com",
          password: "password123",
        });

      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
    });

    test("should return 500 on database error", async () => {
      User.findOne.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          username: "testuser",
          email: "test@example.com",
          password: "password123",
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Error registering user");
    });
  });

  describe("POST /api/auth/login", () => {
    test("should login user successfully with correct credentials", async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      const mockUser = {
        _id: "123",
        name: "John Doe",
        email: "john@example.com",
        passwordHash: hashedPassword,
      };

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "john@example.com",
          password: "password123",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.id).toBe("123");
      expect(response.body.user.name).toBe("John Doe");
      expect(response.body.user.email).toBe("john@example.com");
    });

    test("should return 400 if email is missing", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          password: "password123",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email and password are required");
    });

    test("should return 400 if password is missing", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "john@example.com",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email and password are required");
    });

    test("should return 401 if user does not exist", async () => {
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "password123",
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid credentials");
    });

    test("should return 401 if password is incorrect", async () => {
      const hashedPassword = await bcrypt.hash("correctpassword", 10);
      const mockUser = {
        _id: "123",
        email: "john@example.com",
        passwordHash: hashedPassword,
      };

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "john@example.com",
          password: "wrongpassword",
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid credentials");
    });

    test("should return valid JWT token", async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      const mockUser = {
        _id: "user-id-123",
        email: "john@example.com",
        name: "John Doe",
        passwordHash: hashedPassword,
      };

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "john@example.com",
          password: "password123",
        });

      const token = response.body.token;
      const decoded = jwt.verify(token, "test-secret");

      expect(decoded.userId).toBe("user-id-123");
    });

    test("should return 500 on database error", async () => {
      User.findOne.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "john@example.com",
          password: "password123",
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Error logging in");
    });

    test("should use environment JWT_SECRET for token generation", async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      const mockUser = {
        _id: "123",
        email: "test@example.com",
        name: "Test User",
        passwordHash: hashedPassword,
      };

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "test@example.com",
          password: "password123",
        });

      const token = response.body.token;
      expect(() => jwt.verify(token, "test-secret")).not.toThrow();
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    test("should return 400 if email is missing", async () => {
      const response = await request(app).post("/api/auth/forgot-password").send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email is required");
    });

    test("should return generic response when user does not exist", async () => {
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "missing@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "If an account exists for that email, a password reset link has been sent."
      );
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    test("should create a token and send reset email when user exists", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        email: "john@example.com",
      };
      User.findOne.mockResolvedValue(mockUser);
      PasswordResetToken.updateMany.mockResolvedValue({ modifiedCount: 0 });
      PasswordResetToken.create.mockResolvedValue({ _id: "token-record" });

      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "john@example.com" });

      expect(response.status).toBe(200);
      expect(PasswordResetToken.updateMany).toHaveBeenCalled();
      expect(PasswordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: mockUser._id, tokenHash: expect.any(String) })
      );
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "john@example.com", resetLink: expect.any(String) })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[password-reset] request.completed",
        expect.objectContaining({
          email: "john@example.com",
          accountFound: true,
        })
      );
    });

    test("should log completed request with accountFound false when user does not exist", async () => {
      User.findOne.mockResolvedValue(null);

      await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nobody@example.com" });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[password-reset] request.completed",
        expect.objectContaining({
          email: "nobody@example.com",
          accountFound: false,
        })
      );
    });

    test("should rate-limit forgot password requests", async () => {
      User.findOne.mockResolvedValue(null);

      const requests = [];
      for (let i = 0; i < 6; i += 1) {
        requests.push(
          request(app)
            .post("/api/auth/forgot-password")
            .send({ email: "limited@example.com" })
        );
      }

      const responses = await Promise.all(requests);
      const has429 = responses.some((response) => response.status === 429);
      expect(has429).toBe(true);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    test("should return 400 if required fields are missing", async () => {
      const response = await request(app).post("/api/auth/reset-password").send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Token, password, and password confirmation are required"
      );
    });

    test("should return 400 when passwords do not match", async () => {
      const response = await request(app).post("/api/auth/reset-password").send({
        token: "abc123",
        password: "password123",
        confirmPassword: "different123",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Passwords do not match");
    });

    test("should return 400 when token is invalid or expired", async () => {
      PasswordResetToken.findOne.mockResolvedValue(null);

      const response = await request(app).post("/api/auth/reset-password").send({
        token: "abc123",
        password: "password123",
        confirmPassword: "password123",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid or expired reset token");
    });

    test("should reset password and invalidate tokens", async () => {
      const currentHash = await bcrypt.hash("oldpassword123", 10);
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        passwordHash: currentHash,
        save: jest.fn().mockResolvedValue(true),
      };

      PasswordResetToken.findOne.mockResolvedValue({
        userId: mockUser._id,
      });
      User.findById.mockResolvedValue(mockUser);
      PasswordResetToken.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const response = await request(app).post("/api/auth/reset-password").send({
        token: "abc123",
        password: "newpassword123",
        confirmPassword: "newpassword123",
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Password reset successful");
      expect(mockUser.passwordHash).not.toBe(currentHash);
      expect(mockUser.save).toHaveBeenCalled();
      expect(PasswordResetToken.updateMany).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[password-reset] complete.completed",
        expect.objectContaining({
          userId: mockUser._id,
        })
      );
    });

    test("should rate-limit reset password requests", async () => {
      PasswordResetToken.findOne.mockResolvedValue(null);

      const requests = [];
      for (let i = 0; i < 11; i += 1) {
        requests.push(
          request(app).post("/api/auth/reset-password").send({
            token: "abc123",
            password: "password123",
            confirmPassword: "password123",
          })
        );
      }

      const responses = await Promise.all(requests);
      const has429 = responses.some((response) => response.status === 429);
      expect(has429).toBe(true);
    });
  });
});
