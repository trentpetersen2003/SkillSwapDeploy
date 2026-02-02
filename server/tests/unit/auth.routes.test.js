const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const authRoutes = require("../../routes/auth");

// Mock User model
jest.mock("../../models/User");

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
});
