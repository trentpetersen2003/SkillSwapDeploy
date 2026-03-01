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
  it("shows login validation messages", () => {
    cy.visit(`${BASE_URL}/`);
    cy.contains("SkillSwap").should("be.visible");

    cy.contains("Log in").should("be.visible").click();
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
        },
      ],
    }).as("getForYou");

    cy.intercept("GET", `${API_BASE}/api/users/profile`, {
      body: { skills: [{ skillName: "Piano" }], skillsWanted: [] },
    }).as("getProfile");

    cy.visit(`${BASE_URL}/foryou`, { onBeforeLoad: setAuth });
    cy.wait("@getForYou");

    cy.contains("For You").should("be.visible").click();
    cy.contains("Alice").should("be.visible");

    cy.contains("Request Swap").should("be.visible").click();
    cy.contains("Request Swap with Alice").should("be.visible");
  });

  it("browses users and searches by name", () => {
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
            },
          ],
        });
      }
    }).as("getUsers");

    cy.visit(`${BASE_URL}/foryou`, { onBeforeLoad: setAuth });
    cy.contains("Browse").should("be.visible").click();
    cy.wait("@getUsers");
    cy.contains("Browse Users").should("be.visible");

    cy.get("input[placeholder='Search by name, username, or skill...']")
      .should("be.visible")
      .type("Ann");
    cy.contains("button", "Search").should("be.visible").click();
    cy.wait("@getUsers");

    cy.contains("Ann Lee").should("be.visible");
  });

  it("loads calendar and switches view", () => {
    cy.intercept("GET", `${API_BASE}/api/swaps`, {
      body: [],
    }).as("getSwaps");

    cy.visit(`${BASE_URL}/foryou`, { onBeforeLoad: setAuth });
    cy.contains("Calendar").should("be.visible").click();
    cy.wait("@getSwaps");
    
    cy.contains("button", "Calendar View").should("be.visible").click();
    cy.get(".react-calendar").should("exist");
  });

  it("navigates to profile tab", () => {
    cy.visit(`${BASE_URL}/foryou`, { onBeforeLoad: setAuth });
    cy.contains("Profile").should("be.visible").click();
    cy.contains("Profile").should("be.visible");
  });

  it("manages settings notifications, security, and safety controls", () => {
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
    cy.contains("button", "Save Visibility").click();
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

    cy.visit(`${BASE_URL}/`);
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
