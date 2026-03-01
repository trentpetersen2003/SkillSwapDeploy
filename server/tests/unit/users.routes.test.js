const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const usersRoutes = require("../../routes/users");

const AUTH_USER_ID = "507f1f77bcf86cd799439011";

jest.mock("../../models/User");
jest.mock("bcryptjs");
jest.mock("../../middleware/auth", () => (req, res, next) => {
  req.userId = "507f1f77bcf86cd799439011";
  next();
});

function makeSelectQuery(value) {
  return {
    select: jest.fn().mockResolvedValue(value),
  };
}

describe("Users Routes", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/users", usersRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("PUT /api/users/notifications", () => {
    test("returns 400 when notificationPreferences is missing", async () => {
      const response = await request(app)
        .put("/api/users/notifications")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("notificationPreferences is required");
    });

    test("returns 404 when user does not exist", async () => {
      User.findById.mockReturnValue(makeSelectQuery(null));

      const response = await request(app)
        .put("/api/users/notifications")
        .send({
          notificationPreferences: {
            swapRequestEmail: false,
          },
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    test("updates notification preferences and preserves unspecified values", async () => {
      User.findById.mockReturnValue(
        makeSelectQuery({
          notificationPreferences: {
            swapRequestEmail: true,
            swapConfirmedEmail: true,
            swapCancelledEmail: false,
          },
        })
      );

      User.findByIdAndUpdate.mockReturnValue(
        makeSelectQuery({
          notificationPreferences: {
            swapRequestEmail: false,
            swapConfirmedEmail: true,
            swapCancelledEmail: false,
          },
        })
      );

      const response = await request(app)
        .put("/api/users/notifications")
        .send({
          notificationPreferences: {
            swapRequestEmail: false,
          },
        });

      expect(response.status).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        AUTH_USER_ID,
        {
          $set: {
            "notificationPreferences.swapRequestEmail": false,
            "notificationPreferences.swapConfirmedEmail": true,
            "notificationPreferences.swapCancelledEmail": false,
          },
        },
        { new: true, runValidators: true }
      );
      expect(response.body.notificationPreferences).toEqual({
        swapRequestEmail: false,
        swapConfirmedEmail: true,
        swapCancelledEmail: false,
      });
    });
  });

  describe("privacy and blocked user endpoints", () => {
    test("updates location visibility", async () => {
      User.findByIdAndUpdate.mockReturnValue(
        makeSelectQuery({ locationVisibility: "hidden" })
      );

      const response = await request(app)
        .put("/api/users/location-visibility")
        .send({ locationVisibility: "hidden" });

      expect(response.status).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        AUTH_USER_ID,
        { $set: { locationVisibility: "hidden" } },
        { new: true, runValidators: true }
      );
      expect(response.body.locationVisibility).toBe("hidden");
    });

    test("rejects invalid location visibility values", async () => {
      const response = await request(app)
        .put("/api/users/location-visibility")
        .send({ locationVisibility: "friends-only" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("locationVisibility must be 'visible' or 'hidden'");
    });

    test("returns blocked users list", async () => {
      const blockedUsers = [{ _id: "u2", username: "blockeduser", name: "Blocked User" }];
      User.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ blockedUsers }),
        }),
      });

      const response = await request(app).get("/api/users/blocked");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(blockedUsers);
    });

    test("blocks a valid target user", async () => {
      const targetUserId = "507f1f77bcf86cd799439012";
      User.findById.mockReturnValue(makeSelectQuery({ _id: targetUserId }));
      User.findOne.mockReturnValue(makeSelectQuery(null));
      User.findByIdAndUpdate.mockResolvedValue({});

      const response = await request(app)
        .post("/api/users/blocked")
        .send({ targetUserId });

      expect(response.status).toBe(201);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(AUTH_USER_ID, {
        $addToSet: { blockedUsers: targetUserId },
      });
      expect(response.body.message).toBe("User blocked");
    });

    test("prevents self-blocking", async () => {
      const response = await request(app)
        .post("/api/users/blocked")
        .send({ targetUserId: AUTH_USER_ID });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("You cannot block yourself");
    });

    test("unblocks a valid blocked user id", async () => {
      const blockedUserId = "507f1f77bcf86cd799439013";
      User.findByIdAndUpdate.mockResolvedValue({});

      const response = await request(app)
        .delete(`/api/users/blocked/${blockedUserId}`);

      expect(response.status).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(AUTH_USER_ID, {
        $pull: { blockedUsers: blockedUserId },
      });
      expect(response.body.message).toBe("User unblocked");
    });
  });

  describe("PUT /api/users/password", () => {
    test("returns 400 when required fields are missing", async () => {
      const response = await request(app)
        .put("/api/users/password")
        .send({ currentPassword: "old" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Current password, new password, and confirmation are required"
      );
    });

    test("returns 400 when new passwords do not match", async () => {
      const response = await request(app)
        .put("/api/users/password")
        .send({
          currentPassword: "oldpassword",
          newPassword: "newpassword123",
          confirmPassword: "differentpassword",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("New passwords do not match");
    });

    test("returns 400 when new password is too short", async () => {
      const response = await request(app)
        .put("/api/users/password")
        .send({
          currentPassword: "oldpassword",
          newPassword: "short",
          confirmPassword: "short",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Password must be at least 8 characters");
    });

    test("returns 404 when user is not found", async () => {
      User.findById.mockResolvedValue(null);

      const response = await request(app)
        .put("/api/users/password")
        .send({
          currentPassword: "oldpassword",
          newPassword: "newpassword123",
          confirmPassword: "newpassword123",
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    test("returns 401 when current password is incorrect", async () => {
      User.findById.mockResolvedValue({ passwordHash: "stored-hash" });
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .put("/api/users/password")
        .send({
          currentPassword: "wrongpassword",
          newPassword: "newpassword123",
          confirmPassword: "newpassword123",
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Current password is incorrect");
    });

    test("returns 400 when new password matches current password", async () => {
      User.findById.mockResolvedValue({ passwordHash: "stored-hash" });
      bcrypt.compare
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const response = await request(app)
        .put("/api/users/password")
        .send({
          currentPassword: "oldpassword",
          newPassword: "oldpassword",
          confirmPassword: "oldpassword",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "New password must be different from current password"
      );
    });

    test("updates password successfully", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      User.findById.mockResolvedValue({
        passwordHash: "stored-hash",
        save,
      });
      bcrypt.compare
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      bcrypt.hash.mockResolvedValue("new-hash");

      const response = await request(app)
        .put("/api/users/password")
        .send({
          currentPassword: "oldpassword",
          newPassword: "newpassword123",
          confirmPassword: "newpassword123",
        });

      expect(response.status).toBe(200);
      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 10);
      expect(save).toHaveBeenCalledTimes(1);
      expect(response.body.message).toBe("Password updated");
    });
  });
});
