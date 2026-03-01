import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Chat from "./Chat";

const mockSearch = "";

jest.mock(
  "react-router-dom",
  () => ({
    useLocation: () => ({ search: mockSearch }),
  }),
  { virtual: true }
);

jest.mock("../config", () => "http://localhost:3001");

describe("Chat Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("token", "test-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u1",
        username: "me",
      })
    );
  });

  test("sends auth header when fetching users", async () => {
    global.fetch = jest.fn(async (url, options = {}) => {
      if (url === "http://localhost:3001/api/users") {
        return {
          ok: true,
          json: async () => [{ _id: "u2", name: "Other", username: "other" }],
        };
      }

      if (url === "http://localhost:3001/api/messages/conversations") {
        return {
          ok: true,
          json: async () => [],
        };
      }

      if (url === "http://localhost:3001/api/messages/u2") {
        return {
          ok: true,
          json: async () => [],
        };
      }

      return {
        ok: false,
        json: async () => ({ message: "Unhandled request" }),
      };
    });

    render(<Chat />);

    await screen.findByText("Chat with Other");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/users",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  test("shows blocked-user message when thread fetch is forbidden", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url === "http://localhost:3001/api/users") {
        return {
          ok: true,
          json: async () => [{ _id: "u2", name: "Other", username: "other" }],
        };
      }

      if (url === "http://localhost:3001/api/messages/conversations") {
        return {
          ok: true,
          json: async () => [],
        };
      }

      if (url === "http://localhost:3001/api/messages/u2") {
        return {
          ok: false,
          json: async () => ({ message: "Cannot chat with a blocked user" }),
        };
      }

      return {
        ok: false,
        json: async () => ({ message: "Unhandled request" }),
      };
    });

    render(<Chat />);

    expect(await screen.findByText("Chat with Other")).toBeInTheDocument();
    expect(
      await screen.findByText("Cannot chat with a blocked user")
    ).toBeInTheDocument();
  });

  test("shows blocked-user message when sending is forbidden", async () => {
    global.fetch = jest.fn(async (url, options = {}) => {
      if (url === "http://localhost:3001/api/users") {
        return {
          ok: true,
          json: async () => [{ _id: "u2", name: "Other", username: "other" }],
        };
      }

      if (url === "http://localhost:3001/api/messages/conversations") {
        return {
          ok: true,
          json: async () => [],
        };
      }

      if (url === "http://localhost:3001/api/messages/u2" && (!options.method || options.method === "GET")) {
        return {
          ok: true,
          json: async () => [],
        };
      }

      if (url === "http://localhost:3001/api/messages/u2" && options.method === "POST") {
        return {
          ok: false,
          json: async () => ({ message: "Cannot chat with a blocked user" }),
        };
      }

      return {
        ok: false,
        json: async () => ({ message: "Unhandled request" }),
      };
    });

    render(<Chat />);

    expect(await screen.findByText("Chat with Other")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "Hello there" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/messages/u2",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(
      await screen.findByText("Cannot chat with a blocked user")
    ).toBeInTheDocument();
  });

  test("shows login prompt when auth token is missing", async () => {
    localStorage.removeItem("token");
    global.fetch = jest.fn();

    render(<Chat />);

    expect(await screen.findByText("Please log in")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
