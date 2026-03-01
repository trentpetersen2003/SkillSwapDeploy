import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Settings from "./Settings";
import * as loadingUtils from "../utils/loading";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../config", () => "http://localhost:3001");

const defaultProfile = {
  _id: "u1",
  name: "Test User",
  username: "testuser",
  email: "test@example.com",
  locationVisibility: "visible",
  notificationPreferences: {
    swapRequestEmail: true,
    swapConfirmedEmail: true,
    swapCancelledEmail: true,
  },
};

function setupFetch({ profile = defaultProfile, blockedUsers = [] } = {}) {
  global.fetch = jest.fn(async (url, options = {}) => {
    if (url.endsWith("/api/users/profile") && (!options.method || options.method === "GET")) {
      return {
        ok: true,
        json: async () => profile,
      };
    }

    if (url.endsWith("/api/users/blocked") && (!options.method || options.method === "GET")) {
      return {
        ok: true,
        json: async () => blockedUsers,
      };
    }

    if (url.endsWith("/api/users/notifications") && options.method === "PUT") {
      return {
        ok: true,
        json: async () => ({ notificationPreferences: JSON.parse(options.body).notificationPreferences }),
      };
    }

    if (url.endsWith("/api/users/password") && options.method === "PUT") {
      return {
        ok: true,
        json: async () => ({ message: "Password updated" }),
      };
    }

    if (url.endsWith("/api/users/location-visibility") && options.method === "PUT") {
      return {
        ok: true,
        json: async () => ({ locationVisibility: "hidden" }),
      };
    }

    if (url.includes("/api/users/blocked/") && options.method === "DELETE") {
      return {
        ok: true,
        json: async () => ({ message: "User unblocked" }),
      };
    }

    if (url.includes("/api/users/") && options.method === "DELETE") {
      return {
        ok: true,
        json: async () => ({ message: "User deleted" }),
      };
    }

    return {
      ok: false,
      json: async () => ({ message: "Unhandled request" }),
    };
  });
}

describe("Settings Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();
    jest
      .spyOn(loadingUtils, "withMinimumDelay")
      .mockImplementation(async (taskOrPromise) => {
        if (typeof taskOrPromise === "function") {
          return taskOrPromise();
        }
        return taskOrPromise;
      });

    localStorage.setItem("token", "test-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u1",
        username: "testuser",
        email: "test@example.com",
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders new sections and requires username confirmation before delete", async () => {
    setupFetch();

    render(<Settings onLogout={jest.fn()} />);

    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Danger Zone")).toBeInTheDocument();

    const deleteButton = screen.getByRole("button", { name: "Delete account" });
    expect(deleteButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("testuser"), {
      target: { value: "testuser" },
    });

    await waitFor(() => {
      expect(deleteButton).toBeEnabled();
    });
  });

  test("saves notification preference changes", async () => {
    setupFetch();

    render(<Settings onLogout={jest.fn()} />);

    expect(await screen.findByText("Settings")).toBeInTheDocument();

    const requestEmailToggle = screen.getByLabelText("Email me for new swap requests");
    fireEvent.click(requestEmailToggle);

    fireEvent.click(screen.getByRole("button", { name: "Save Notifications" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/users/notifications",
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    expect(await screen.findByText("Notification preferences updated.")).toBeInTheDocument();
  });

  test("validates password form before submit", async () => {
    setupFetch();

    render(<Settings onLogout={jest.fn()} />);

    expect(await screen.findByText("Settings")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Please complete all password fields.")).toBeInTheDocument();
  });

  test("submits password change and clears fields on success", async () => {
    setupFetch();

    render(<Settings onLogout={jest.fn()} />);

    expect(await screen.findByText("Settings")).toBeInTheDocument();

    const [currentPasswordInput, newPasswordInput, confirmPasswordInput] = screen.getAllByPlaceholderText(/password/i);

    fireEvent.change(currentPasswordInput, { target: { value: "oldpassword" } });
    fireEvent.change(newPasswordInput, { target: { value: "newpassword123" } });
    fireEvent.change(confirmPasswordInput, { target: { value: "newpassword123" } });

    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/users/password",
        expect.objectContaining({ method: "PUT" })
      );
    });

    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
    expect(currentPasswordInput).toHaveValue("");
    expect(newPasswordInput).toHaveValue("");
    expect(confirmPasswordInput).toHaveValue("");
  });
});
