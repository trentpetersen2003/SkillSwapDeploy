const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const usersRoutes = require("../../routes/users");
const { getReliabilityByUserIds } = require("../../services/reliability");

const AUTH_USER_ID = "507f1f77bcf86cd799439011";

jest.mock("../../models/User");
jest.mock("bcryptjs");
jest.mock("../../services/reliability", () => ({
  getReliabilityByUserIds: jest.fn(),
}));
jest.mock("../../middleware/auth", () => (req, res, next) => {
  req.userId = "507f1f77bcf86cd799439011";
  next();
});

// Run make select query logic.
function makeSelectQuery(value) {
  return {
    select: jest.fn().mockResolvedValue(value),
  };
}

// Run make select sort query logic.
function makeSelectSortQuery(value) {
  return {
    select: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue(value),
    }),
  };
}

describe("Users Routes", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/users", usersRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
    getReliabilityByUserIds.mockResolvedValue({});
  });

  describe("GET /api/users", () => {
    test("returns ranked users with match metadata by default", async () => {
      User.findById.mockReturnValue(
        makeSelectQuery({
          blockedUsers: [],
          showOthersLocations: true,
          skills: [{ skillName: "React", category: "Tech & Programming" }],
          skillsWanted: [{ skillName: "Python", category: "Tech & Programming" }],
          availability: [{ day: "Monday", timeRange: "6:00 PM - 8:00 PM" }],
          timeZone: "UTC-05:00",
        })
      );
      User.find.mockImplementation((query) => {
        if (query && query.blockedUsers) {
          return makeSelectQuery([]);
        }

        return makeSelectSortQuery([
          {
            _id: "u1",
            name: "Taylor",
            username: "taylor",
            city: "Denver",
            locationVisibility: "visible",
            skills: [{ skillName: "Python", category: "Tech & Programming" }],
            skillsWanted: [{ skillName: "React", category: "Tech & Programming" }],
            availability: [{ day: "Monday", timeRange: "7:00 PM - 8:00 PM" }],
            timeZone: "UTC-05:00",
          },
        ]);
      });
      getReliabilityByUserIds.mockResolvedValue({
        u1: { score: 88, tier: "Reliable" },
      });

      const response = await request(app).get("/api/users");

      expect(response.status).toBe(200);
      expect(response.body[0]).toEqual(
        expect.objectContaining({
          name: "Taylor",
          matchScore: expect.any(Number),
          matchReasons: expect.any(Array),
          reliability: expect.objectContaining({ score: 88, tier: "Reliable" }),
        })
      );
    });

    test("preserves created ordering when sortBy=created is requested", async () => {
      User.findById.mockReturnValue(
        makeSelectQuery({ blockedUsers: [], showOthersLocations: true, skills: [], skillsWanted: [] })
      );
      User.find.mockImplementation((query) => {
        if (query && query.blockedUsers) {
          return makeSelectQuery([]);
        }

        return makeSelectSortQuery([
          { _id: "u2", name: "Zoe", username: "zoe", createdAt: new Date("2026-03-01") },
          { _id: "u1", name: "Ava", username: "ava", createdAt: new Date("2026-02-01") },
        ]);
      });

      const response = await request(app).get("/api/users?sortBy=created");

      expect(response.status).toBe(200);
      expect(response.body.map((user) => user.name)).toEqual(["Zoe", "Ava"]);
    });

    test("supports location, availability, swap mode, and minRating filters together", async () => {
      User.findById.mockReturnValue(
        makeSelectQuery({ blockedUsers: [], showOthersLocations: true, skills: [], skillsWanted: [] })
      );
      User.find.mockImplementation((query) => {
        if (query && query.blockedUsers) {
          return makeSelectQuery([]);
        }

        return makeSelectSortQuery([
          {
            _id: "u1",
            name: "Taylor",
            username: "taylor",
            city: "Denver",
            locationVisibility: "visible",
            availability: [{ day: "Monday", timeRange: "6:00 PM - 8:00 PM" }],
            swapMode: "either",
          },
          {
            _id: "u2",
            name: "Sam",
            username: "sam",
            city: "Denver",
            locationVisibility: "visible",
            availability: [{ day: "Monday", timeRange: "6:00 PM - 8:00 PM" }],
            swapMode: "online",
          },
        ]);
      });
      getReliabilityByUserIds.mockResolvedValue({
        u1: { score: 80, tier: "Reliable", averageRating: 4.7 },
        u2: { score: 75, tier: "Reliable", averageRating: 3.2 },
      });

      const response = await request(app).get(
        "/api/users?location=den&availabilityDay=Monday&swapMode=online&minRating=4.5&sortBy=created"
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual(expect.objectContaining({ _id: "u1" }));
      expect(User.find).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          $and: expect.arrayContaining([
            expect.objectContaining({
              $or: [
                { city: expect.any(Object) },
                { state: expect.any(Object) },
              ],
              locationVisibility: { $ne: "hidden" },
            }),
            { availability: { $elemMatch: { day: { $in: ["Monday"] } } } },
            {
              $or: [
                { swapMode: { $in: ["online", "either"] } },
                { swapMode: { $exists: false } },
              ],
            },
          ]),
        })
      );
    });

    test("accepts multiple categories and availability days", async () => {
      User.findById.mockReturnValue(
        makeSelectQuery({ blockedUsers: [], showOthersLocations: true, skills: [], skillsWanted: [] })
      );
      User.find.mockImplementation((query) => {
        if (query && query.blockedUsers) {
          return makeSelectQuery([]);
        }

        return makeSelectSortQuery([
          {
            _id: "u3",
            name: "Jordan",
            username: "jordan",
            skills: [{ skillName: "Python", category: "Tech & Programming" }],
            availability: [{ day: "Monday", timeRange: "8:00 AM - 9:00 AM" }],
            swapMode: "online",
          },
        ]);
      });

      const response = await request(app).get(
        "/api/users?category=Tech%20%26%20Programming&category=Languages&availabilityDay=Monday&availabilityDay=Wednesday"
      );

      expect(response.status).toBe(200);
      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: expect.arrayContaining([
            {
              $or: [
                { "skills.category": { $in: ["Tech & Programming", "Languages"] } },
                { "skillsWanted.category": { $in: ["Tech & Programming", "Languages"] } },
              ],
            },
            { availability: { $elemMatch: { day: { $in: ["Monday", "Wednesday"] } } } },
          ]),
        })
      );
    });

    test("returns 400 for invalid availabilityDay", async () => {
      User.findById.mockReturnValue(
        makeSelectQuery({ blockedUsers: [], showOthersLocations: true, skills: [], skillsWanted: [] })
      );

      const response = await request(app).get("/api/users?availabilityDay=Funday");

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("availabilityDay must be a valid weekday");
    });
  });

  describe("DELETE /api/users/:id", () => {
    test("deletes the account for the authenticated user", async () => {
      User.findById.mockReturnValue(makeSelectQuery({ _id: AUTH_USER_ID }));
      User.findByIdAndDelete.mockResolvedValue({ _id: AUTH_USER_ID });

      const response = await request(app).delete(`/api/users/${AUTH_USER_ID}`);

      expect(response.status).toBe(200);
      expect(User.findByIdAndDelete).toHaveBeenCalledWith(AUTH_USER_ID);
    });
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
            profileReminderEmail: true,
          },
        })
      );

      User.findByIdAndUpdate.mockReturnValue(
        makeSelectQuery({
          notificationPreferences: {
            swapRequestEmail: false,
            swapConfirmedEmail: true,
            swapCancelledEmail: false,
            profileReminderEmail: true,
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
            "notificationPreferences.profileReminderEmail": true,
          },
        },
        { new: true, runValidators: true }
      );
      expect(response.body.notificationPreferences).toEqual({
        swapRequestEmail: false,
        swapConfirmedEmail: true,
        swapCancelledEmail: false,
        profileReminderEmail: true,
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

    test("updates both location privacy settings", async () => {
      User.findByIdAndUpdate.mockReturnValue(
        makeSelectQuery({ locationVisibility: "hidden", showOthersLocations: false })
      );

      const response = await request(app)
        .put("/api/users/location-visibility")
        .send({ locationVisibility: "hidden", showOthersLocations: false });

      expect(response.status).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        AUTH_USER_ID,
        { $set: { locationVisibility: "hidden", showOthersLocations: false } },
        { new: true, runValidators: true }
      );
      expect(response.body).toEqual({ locationVisibility: "hidden", showOthersLocations: false });
    });

    test("rejects invalid location visibility values", async () => {
      const response = await request(app)
        .put("/api/users/location-visibility")
        .send({ locationVisibility: "friends-only" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("locationVisibility must be 'visible' or 'hidden'");
    });

    test("rejects empty location privacy updates", async () => {
      const response = await request(app)
        .put("/api/users/location-visibility")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("At least one location privacy setting is required");
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

    test("returns blocked relationship statuses for requested users", async () => {
      const requestedId1 = "507f1f77bcf86cd799439012";
      const requestedId2 = "507f1f77bcf86cd799439013";

      User.findById.mockReturnValue(
        makeSelectQuery({ blockedUsers: [requestedId1] })
      );
      User.find.mockReturnValue(
        makeSelectQuery([{ _id: requestedId2 }])
      );

      const response = await request(app)
        .get(`/api/users/blocked/status?ids=${requestedId1},${requestedId2}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        statuses: {
          [requestedId1]: { iBlocked: true, blockedMe: false },
          [requestedId2]: { iBlocked: false, blockedMe: true },
        },
      });
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
