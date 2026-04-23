const BASE_URL = "http://localhost:3000";
const API_BASE = "http://localhost:3001";

function setAuth(win) {
  win.localStorage.setItem("token", "test-token");
  win.localStorage.setItem(
    "user",
    JSON.stringify({
      name: "Test User",
      username: "testuser",
      email: "test@example.com",
    })
  );
}

describe("SkillSwap behavior tests", () => {
  it("shows splash actions and guest preview cards", () => {
    cy.intercept("GET", `${API_BASE}/api/users/public-preview`, {
      body: [
        {
          id: "guest-1",
          name: "Aisha R.",
          username: "aisha",
          city: "Denver",
          state: "CO",
          locationVisibility: "visible",
          swapMode: "either",
          offers: ["Python fundamentals", "SQL basics"],
          wants: ["Public speaking"],
        },
        {
          id: "guest-2",
          name: "Hidden User",
          username: "hidden-user",
          city: "Seattle",
          state: "WA",
          locationVisibility: "hidden",
          swapMode: "online",
          offers: ["Figma"],
          wants: ["Data visualization"],
        },
      ],
    }).as("getPublicPreview");

    cy.visit(`${BASE_URL}/`);
    cy.contains("Trade skills. Build confidence. Grow together.").should("be.visible");
    cy.contains("button", "Log in").should("be.visible");
    cy.contains("button", "Sign up").should("be.visible");
    cy.contains("button", "Browse as guest").click();

    cy.url().should("include", "/browse-preview");
    cy.wait("@getPublicPreview");
    cy.contains("Guest preview").should("be.visible");
    cy.contains("Aisha R.").should("be.visible");
    cy.contains("Hidden User")
      .closest(".guest-preview-card")
      .within(() => {
        cy.contains("Location:").should("not.exist");
      });
  });

  it("redirects authenticated users away from splash to app", () => {
    cy.intercept("GET", `${API_BASE}/api/messages/conversations`, { body: [] }).as("getConversations");
    cy.intercept("GET", `${API_BASE}/api/users/profile`, {
      body: {
        _id: "u0",
        name: "Test User",
        email: "test@example.com",
        timeZone: "UTC-05:00",
        skills: [{ skillName: "Piano", category: "Creative & Arts" }],
        skillsWanted: [{ skillName: "Guitar", category: "Creative & Arts" }],
        availability: [{ day: "Monday", timeRange: "6:00 PM - 8:00 PM" }],
      },
    }).as("getProfile");
    cy.intercept("GET", `${API_BASE}/api/for-you`, { body: [] }).as("getForYou");
    cy.intercept("GET", `${API_BASE}/api/swaps`, { body: [] }).as("getSwaps");

    cy.visit(`${BASE_URL}/`, { onBeforeLoad: setAuth });
    cy.wait("@getProfile");
    cy.url().should("include", "/foryou");
  });

  it("shows login validation messages", () => {
    cy.visit(`${BASE_URL}/`);
    cy.contains("Trade skills. Build confidence. Grow together.").should("be.visible");

    cy.contains("button", "Log in").should("be.visible").click();
    cy.contains("Email and password are required.").should("be.visible");

    cy.contains("Need an account? Sign up").click();
    cy.get("input[name='email']").type("test@example.com");
    cy.get("input[name='password']").type("password123");
    cy.contains("Sign up").should("be.visible").click();
    cy.contains("Name is required to register.").should("be.visible");

    cy.get("input[name='name']").type("Test User");
    cy.contains("Sign up").should("be.visible").click();
    cy.contains("Username is required to register.").should("be.visible");
  });

  it("loads For You page and opens swap request modal", () => {
    cy.intercept("GET", `${API_BASE}/api/messages/conversations`, { body: [] }).as("getConversations");
    cy.intercept("GET", `${API_BASE}/api/for-you`, {
      body: [
        {
          _id: "u1",
          name: "Alice",
          username: "alice",
          city: "Denver",
          skills: [{ skillName: "Guitar" }],
          skillsWanted: [{ skillName: "Spanish" }],
          bio: "Music teacher",
          matchScore: 92,
          matchReasons: ["Teaches skills you want: Spanish", "Availability overlap on 1 day"],
          reliability: { score: 88, tier: "Reliable" },
        },
      ],
    }).as("getForYou");

    cy.intercept("GET", `${API_BASE}/api/users/profile`, {
      body: { skills: [{ skillName: "Piano" }], skillsWanted: [] },
    }).as("getProfile");
    cy.intercept("GET", `${API_BASE}/api/swaps`, { body: [] }).as("getSwaps");

    cy.visit(`${BASE_URL}/foryou`, { onBeforeLoad: setAuth });
    cy.wait("@getForYou");
    cy.wait("@getSwaps");

    cy.contains("For You").should("be.visible");
    cy.contains("Alice").should("be.visible");
    cy.contains("Match 92%").should("be.visible");
    cy.contains("Teaches skills you want: Spanish").should("be.visible");

    cy.contains("Request Swap").should("be.visible").click();
    cy.contains("Request Swap with Alice").should("be.visible");
  });

  it("browses users and searches by name", () => {
    cy.intercept("GET", `${API_BASE}/api/messages/conversations`, { body: [] }).as("getConversations");
    cy.intercept("GET", `${API_BASE}/api/users*`, (req) => {
      const search = req.query.search || "";
      if (search.toLowerCase().includes("ann")) {
        req.reply({
          body: [
            {
              _id: "u2",
              name: "Ann Lee",
              username: "annlee",
              city: "Seattle",
              skills: [{ skillName: "Python" }],
              skillsWanted: [{ skillName: "Guitar" }],
                matchScore: 84,
                matchReasons: ["Strong skill-family compatibility in your learning goals"],
                reliability: { score: 91, tier: "Reliable" },
            },
          ],
        });
      } else {
        req.reply({
          body: [
            {
              _id: "u3",
              name: "Bob Ray",
              username: "bobray",
              city: "Austin",
              skills: [{ skillName: "Excel" }],
              skillsWanted: [],
                matchScore: 40,
                matchReasons: ["Some category overlap in teach/learn preferences"],
                reliability: { score: 72, tier: "Reliable" },
            },
          ],
        });
      }
    }).as("getUsers");

    cy.visit(`${BASE_URL}/browse`, { onBeforeLoad: setAuth });
    cy.wait("@getUsers");
    cy.contains("Browse Users").should("be.visible");
    cy.contains("Match ").should("be.visible");

    cy.get("input[placeholder='Search by name, username, or skill...']")
      .should("be.visible")
      .type("Ann");
    cy.contains("button", "Search").should("be.visible").click();
    cy.wait("@getUsers");

    cy.contains("Ann Lee").should("be.visible");
    cy.contains("Match 84%").should("be.visible");
  });

  it("loads calendar and switches view", () => {
    cy.intercept("GET", `${API_BASE}/api/messages/conversations`, { body: [] }).as("getConversations");
    cy.intercept("GET", `${API_BASE}/api/swaps`, {
      body: [],
    }).as("getSwaps");

    cy.visit(`${BASE_URL}/calendar`, { onBeforeLoad: setAuth });
    cy.wait("@getSwaps");
    
    cy.contains("button", "Calendar View").should("be.visible").click();
    cy.get(".react-calendar").should("exist");
  });

  it("navigates to profile tab", () => {
    cy.intercept("GET", `${API_BASE}/api/messages/conversations`, { body: [] }).as("getConversations");
    cy.visit(`${BASE_URL}/profile`, { onBeforeLoad: setAuth });
    cy.contains("Profile").should("be.visible");
  });

  it("guides first-time profile setup and shows missing requirements on save", () => {
    cy.intercept("GET", `${API_BASE}/api/messages/conversations`, { body: [] }).as("getConversations");
    cy.intercept("GET", `${API_BASE}/api/users/profile`, {
      body: {
        _id: "u0",
        name: "",
        email: "",
        city: "",
        state: "",
        timeZone: "",
        swapMode: "either",
        availability: [],
        skills: [],
        skillsWanted: [],
      },
    }).as("getIncompleteProfile");
    cy.intercept("GET", `${API_BASE}/api/swaps`, { body: [] }).as("getSwaps");

    cy.visit(`${BASE_URL}/profile`, { onBeforeLoad: setAuth });
    cy.wait("@getIncompleteProfile");

    cy.contains("Finish your profile to unlock swapping.").should("be.visible");
    cy.contains("Setup guide").should("be.visible");
    cy.contains("0/8 required complete").should("be.visible");
    cy.contains("button", "Add your name").should("be.visible");
    cy.contains("button", "Add at least one availability slot").should("be.visible");

    cy.contains("button", "Save Profile").click();

    cy.contains("Complete the required basics before saving.").should("be.visible");
    cy.contains("You still need to add:").should("be.visible");
    cy.contains("Name").should("be.visible");
    cy.contains("Email").should("be.visible");
    cy.contains("City").should("be.visible");
    cy.contains("State").should("be.visible");
    cy.contains("Time zone").should("be.visible");
    cy.contains("Availability").should("be.visible");
    cy.contains("Skills you offer").should("be.visible");
    cy.contains("Skills you want").should("be.visible");
  });

  it("manages settings notifications, security, and safety controls", () => {
    cy.intercept("GET", `${API_BASE}/api/messages/conversations`, { body: [] }).as("getConversations");
    cy.intercept("GET", `${API_BASE}/api/users/profile`, {
      body: {
        _id: "u0",
        username: "testuser",
        locationVisibility: "visible",
        notificationPreferences: {
          swapRequestEmail: true,
          swapConfirmedEmail: true,
          swapCancelledEmail: true,
        },
      },
    }).as("getSettingsProfile");

    cy.intercept("GET", `${API_BASE}/api/users/blocked`, {
      body: [
        { _id: "u9", name: "Blocked User", username: "blockeduser" },
      ],
    }).as("getBlockedUsers");

    cy.intercept("PUT", `${API_BASE}/api/users/location-visibility`, {
      body: { locationVisibility: "hidden" },
    }).as("saveVisibility");

    cy.intercept("PUT", `${API_BASE}/api/users/notifications`, {
      body: {
        notificationPreferences: {
          swapRequestEmail: false,
          swapConfirmedEmail: true,
          swapCancelledEmail: true,
        },
      },
    }).as("saveNotifications");

    cy.intercept("PUT", `${API_BASE}/api/users/password`, {
      body: { message: "Password updated" },
    }).as("changePassword");

    cy.intercept("DELETE", `${API_BASE}/api/users/blocked/u9`, {
      body: { message: "User unblocked" },
    }).as("unblockUser");

    cy.visit(`${BASE_URL}/settings`, { onBeforeLoad: setAuth });
    cy.wait("@getSettingsProfile");
    cy.wait("@getBlockedUsers");

    cy.contains("Settings").should("be.visible");

    cy.get("select.settings-input").first().select("Hidden in Browse and For You");
    cy.contains("button", "Save Privacy").click();
    cy.wait("@saveVisibility");

    cy.contains("span", "Email me for new swap requests")
      .closest("label")
      .find("input[type='checkbox']")
      .click();
    cy.contains("button", "Save Notifications").click();
    cy.wait("@saveNotifications");

    cy.contains("Blocked User (@blockeduser)").should("be.visible");
    cy.contains("button", "Unblock").click();
    cy.wait("@unblockUser");
    cy.contains("Blocked User (@blockeduser)").should("not.exist");

    cy.get("input[placeholder='Current password']").type("oldpassword");
    cy.get("input[placeholder='New password']").type("newpassword123");
    cy.get("input[placeholder='Confirm new password']").type("newpassword123");
    cy.contains("button", "Update Password").click();
    cy.wait("@changePassword");

    cy.contains("button", "Delete account").should("be.disabled");
    cy.get("input[placeholder='testuser']").type("testuser");
    cy.contains("button", "Delete account").should("not.be.disabled");
  });

  it("completes forgot and reset password flow", () => {
    cy.intercept("POST", `${API_BASE}/api/auth/forgot-password`, {
      body: {
        message: "If an account exists for that email, a password reset link has been sent.",
      },
    }).as("forgotPassword");

    cy.intercept("POST", `${API_BASE}/api/auth/reset-password`, {
      body: {
        message: "Password reset successful",
      },
    }).as("resetPassword");

    cy.visit(`${BASE_URL}/login`);
    cy.contains("Forgot password?").should("be.visible").click();

    cy.get("input[name='email']").type("test@example.com");
    cy.contains("Send reset link").click();
    cy.wait("@forgotPassword");
    cy.contains("If an account exists for that email, a password reset link has been sent.").should(
      "be.visible"
    );

    cy.visit(`${BASE_URL}/reset-password/mock-token`);
    cy.get("input[name='password']").type("newpassword123");
    cy.get("input[name='confirmPassword']").type("newpassword123");
    cy.contains("Reset password").click();
    cy.wait("@resetPassword");

    cy.url().should("include", "?reset=success");
    cy.contains("Password reset successful. You can now log in.").should("be.visible");
  });
});
