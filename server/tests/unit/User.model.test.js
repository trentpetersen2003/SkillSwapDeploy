const User = require("../../models/User");

describe("User Model", () => {
  describe("Schema validation", () => {
    test("should create a user with required fields", () => {
      const userData = {
        name: "John Doe",
        username: "johndoe",
        email: "john@example.com",
        passwordHash: "hashedpassword123",
      };

      const user = new User(userData);
      expect(user.name).toBe("John Doe");
      expect(user.username).toBe("johndoe");
      expect(user.email).toBe("john@example.com");
      expect(user.passwordHash).toBe("hashedpassword123");
    });

    test("should have default empty values for optional fields", () => {
      const userData = {
        name: "Jane Doe",
        username: "janedoe",
        email: "jane@example.com",
        passwordHash: "hashedpassword456",
      };

      const user = new User(userData);
      expect(user.city).toBe("");
      expect(user.locationVisibility).toBe("visible");
      expect(user.phoneNumber).toBe("");
      expect(user.timeZone).toBe("");
      expect(user.bio).toBe("");
      expect(user.swapMode).toBe("either");
      expect(user.availability).toEqual([]);
      expect(user.skills).toEqual([]);
      expect(user.skillsWanted).toEqual([]);
      expect(user.blockedUsers).toEqual([]);
      expect(user.notificationPreferences).toEqual({
        swapRequestEmail: true,
        swapConfirmedEmail: true,
        swapCancelledEmail: true,
      });
    });

    test("should accept hidden location visibility", () => {
      const user = new User({
        name: "Hidden User",
        username: "hiddenuser",
        email: "hidden@example.com",
        passwordHash: "hash",
        locationVisibility: "hidden",
      });

      expect(user.locationVisibility).toBe("hidden");
    });

    test("should accept optional profile fields", () => {
      const userData = {
        name: "Bob Smith",
        username: "bobsmith",
        email: "bob@example.com",
        passwordHash: "hashedpassword789",
        city: "Denver",
        phoneNumber: "555-1234",
        timeZone: "America/Denver",
        bio: "I love teaching!",
        swapMode: "online",
      };

      const user = new User(userData);
      expect(user.city).toBe("Denver");
      expect(user.phoneNumber).toBe("555-1234");
      expect(user.timeZone).toBe("America/Denver");
      expect(user.bio).toBe("I love teaching!");
      expect(user.swapMode).toBe("online");
    });

    test("should trim whitespace from string fields", () => {
      const userData = {
        name: "  Alice  ",
        username: "  alice  ",
        email: "  alice@example.com  ",
        passwordHash: "hashed",
      };

      const user = new User(userData);
      expect(user.name).toBe("Alice");
      expect(user.username).toBe("alice");
      expect(user.email).toBe("alice@example.com");
    });
  });

  describe("Skills array", () => {
    test("should accept skill objects with required fields", () => {
      const userData = {
        name: "Charlie",
        username: "charlie",
        email: "charlie@example.com",
        passwordHash: "hashed",
        skills: [
          {
            skillName: "Guitar",
            category: "Music",
            level: "Proficient",
          },
        ],
      };

      const user = new User(userData);
      expect(user.skills).toHaveLength(1);
      expect(user.skills[0].skillName).toBe("Guitar");
      expect(user.skills[0].category).toBe("Music");
      expect(user.skills[0].level).toBe("Proficient");
    });

    test("should accept multiple skills", () => {
      const userData = {
        name: "Diana",
        username: "diana",
        email: "diana@example.com",
        passwordHash: "hashed",
        skills: [
          {
            skillName: "Spanish",
            category: "Language",
            level: "Expert",
          },
          {
            skillName: "Cooking",
            category: "Culinary",
            level: "Novice",
          },
        ],
      };

      const user = new User(userData);
      expect(user.skills).toHaveLength(2);
      expect(user.skills[0].skillName).toBe("Spanish");
      expect(user.skills[1].skillName).toBe("Cooking");
    });

    test("should trim skill names and categories", () => {
      const userData = {
        name: "Eve",
        username: "eve",
        email: "eve@example.com",
        passwordHash: "hashed",
        skills: [
          {
            skillName: "  Python  ",
            category: "  Programming  ",
            level: "Expert",
          },
        ],
      };

      const user = new User(userData);
      expect(user.skills[0].skillName).toBe("Python");
      expect(user.skills[0].category).toBe("Programming");
    });
  });

  describe("Skills wanted array", () => {
    test("should accept skillsWanted objects", () => {
      const userData = {
        name: "Frank",
        username: "frank",
        email: "frank@example.com",
        passwordHash: "hashed",
        skillsWanted: [
          {
            skillName: "French",
            category: "Language",
            level: "Novice",
          },
        ],
      };

      const user = new User(userData);
      expect(user.skillsWanted).toHaveLength(1);
      expect(user.skillsWanted[0].skillName).toBe("French");
    });

    test("should allow both skills and skillsWanted", () => {
      const userData = {
        name: "Grace",
        username: "grace",
        email: "grace@example.com",
        passwordHash: "hashed",
        skills: [
          {
            skillName: "Piano",
            category: "Music",
            level: "Expert",
          },
        ],
        skillsWanted: [
          {
            skillName: "Painting",
            category: "Art",
            level: "Novice",
          },
        ],
      };

      const user = new User(userData);
      expect(user.skills).toHaveLength(1);
      expect(user.skillsWanted).toHaveLength(1);
    });
  });

  describe("Availability array", () => {
    test("should accept availability objects", () => {
      const userData = {
        name: "Henry",
        username: "henry",
        email: "henry@example.com",
        passwordHash: "hashed",
        availability: [
          {
            day: "Monday",
            timeRange: "9:00 AM - 5:00 PM",
          },
        ],
      };

      const user = new User(userData);
      expect(user.availability).toHaveLength(1);
      expect(user.availability[0].day).toBe("Monday");
      expect(user.availability[0].timeRange).toBe("9:00 AM - 5:00 PM");
    });

    test("should accept multiple availability entries", () => {
      const userData = {
        name: "Ivy",
        username: "ivy",
        email: "ivy@example.com",
        passwordHash: "hashed",
        availability: [
          {
            day: "Monday",
            timeRange: "6:00 PM - 8:00 PM",
          },
          {
            day: "Wednesday",
            timeRange: "7:00 PM - 9:00 PM",
          },
          {
            day: "Saturday",
            timeRange: "10:00 AM - 2:00 PM",
          },
        ],
      };

      const user = new User(userData);
      expect(user.availability).toHaveLength(3);
    });
  });

  describe("Timestamps", () => {
    test("should include createdAt and updatedAt timestamps", () => {
      const userData = {
        name: "Jack",
        username: "jack",
        email: "jack@example.com",
        passwordHash: "hashed",
      };

      const user = new User(userData);
      expect(user).toHaveProperty("createdAt");
      expect(user).toHaveProperty("updatedAt");
    });
  });

  describe("Field requirements", () => {
    test("should require name field", () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        passwordHash: "hashed",
      };

      const user = new User(userData);
      expect(user.validateSync()).toBeDefined();
    });

    test("should require username field", () => {
      const userData = {
        name: "Test User",
        email: "test@example.com",
        passwordHash: "hashed",
      };

      const user = new User(userData);
      expect(user.validateSync()).toBeDefined();
    });

    test("should require email field", () => {
      const userData = {
        name: "Test User",
        username: "testuser",
        passwordHash: "hashed",
      };

      const user = new User(userData);
      expect(user.validateSync()).toBeDefined();
    });

    test("should require passwordHash field", () => {
      const userData = {
        name: "Test User",
        username: "testuser",
        email: "test@example.com",
      };

      const user = new User(userData);
      expect(user.validateSync()).toBeDefined();
    });
  });

  describe("Skill level enum", () => {
    test("should accept valid skill levels", () => {
      const userData = {
        name: "Kevin",
        username: "kevin",
        email: "kevin@example.com",
        passwordHash: "hashed",
        skills: [
          {
            skillName: "Skill1",
            category: "Category1",
            level: "Novice",
          },
          {
            skillName: "Skill2",
            category: "Category2",
            level: "Proficient",
          },
          {
            skillName: "Skill3",
            category: "Category3",
            level: "Expert",
          },
        ],
      };

      const user = new User(userData);
      expect(user.skills).toHaveLength(3);
      expect(user.skills[0].level).toBe("Novice");
      expect(user.skills[1].level).toBe("Proficient");
      expect(user.skills[2].level).toBe("Expert");
    });
  });
});
