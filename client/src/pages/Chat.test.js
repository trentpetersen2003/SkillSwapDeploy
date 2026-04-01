import React, { act } from "react";
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

const otherUser = { _id: "u2", name: "Other", username: "other" };

function buildConversation(overrides = {}) {
  return {
    user: otherUser,
    lastMessage: {
      _id: "m-last",
      text: "Last message",
      sender: "u2",
      recipient: "u1",
      createdAt: "2026-03-31T10:00:00.000Z",
    },
    unreadCount: 0,
    ...overrides,
  };
}

function isThreadHistoryUrl(url) {
  return url.startsWith("http://localhost:3001/api/messages/u2/history");
}

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
          json: async () => [buildConversation()],
        };
      }

      if (isThreadHistoryUrl(url)) {
        return {
          ok: true,
          json: async () => ({ messages: [], hasMoreOlder: false }),
        };
      }

      return {
        ok: false,
        json: async () => ({ message: "Unhandled request" }),
      };
    });

    render(<Chat />);

    await screen.findByText("Recent conversations");

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
          json: async () => [buildConversation()],
        };
      }

      if (isThreadHistoryUrl(url)) {
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

    const conversationButton = await screen.findByRole("button", {
      name: "Open recent conversation with Other",
    });
    fireEvent.click(conversationButton);

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
          json: async () => [buildConversation()],
        };
      }

      if (isThreadHistoryUrl(url) && (!options.method || options.method === "GET")) {
        return {
          ok: true,
          json: async () => ({ messages: [], hasMoreOlder: false }),
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

    const conversationButton = await screen.findByRole("button", {
      name: "Open recent conversation with Other",
    });
    fireEvent.click(conversationButton);

    expect(await screen.findByText("Chat with Other")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "Hello there" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

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

  test("updates active thread without changing selected chat", async () => {
    jest.useFakeTimers();
    let threadFetchCount = 0;

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
          json: async () => [buildConversation()],
        };
      }

      if (isThreadHistoryUrl(url)) {
        threadFetchCount += 1;
        if (threadFetchCount === 1) {
          return {
            ok: true,
            json: async () => ({ messages: [], hasMoreOlder: false }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            messages: [
              {
                _id: "m1",
                sender: "u2",
                recipient: "u1",
                text: "New message while selected",
                createdAt: "2026-03-31T12:00:00.000Z",
              },
            ],
            hasMoreOlder: false,
          }),
        };
      }

      return {
        ok: false,
        json: async () => ({ message: "Unhandled request" }),
      };
    });

    render(<Chat />);

    const conversationButton = await screen.findByRole("button", {
      name: "Open recent conversation with Other",
    });
    fireEvent.click(conversationButton);

    expect(await screen.findByText("Chat with Other")).toBeInTheDocument();
    expect(await screen.findByText("No messages yet. Start the conversation.")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(await screen.findByText("New message while selected")).toBeInTheDocument();

    jest.useRealTimers();
  });

  test("pauses polling when hidden and refreshes when visible again", async () => {
    jest.useFakeTimers();

    const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState"
    );
    let visibilityState = "hidden";

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });

    let threadFetchCount = 0;
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
          json: async () => [buildConversation()],
        };
      }

      if (isThreadHistoryUrl(url)) {
        threadFetchCount += 1;

        if (threadFetchCount === 1) {
          return {
            ok: true,
            json: async () => ({ messages: [], hasMoreOlder: false }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            messages: [
              {
                _id: "m2",
                sender: "u2",
                recipient: "u1",
                text: "Message after tab is visible",
                createdAt: "2026-03-31T13:00:00.000Z",
              },
            ],
            hasMoreOlder: false,
          }),
        };
      }

      return {
        ok: false,
        json: async () => ({ message: "Unhandled request" }),
      };
    });

    render(<Chat />);

    const conversationButton = await screen.findByRole("button", {
      name: "Open recent conversation with Other",
    });
    fireEvent.click(conversationButton);

    expect(await screen.findByText("Chat with Other")).toBeInTheDocument();
    expect(threadFetchCount).toBe(1);

    await act(async () => {
      jest.advanceTimersByTime(9000);
    });

    expect(threadFetchCount).toBe(1);
    expect(
      screen.queryByText("Message after tab is visible")
    ).not.toBeInTheDocument();

    visibilityState = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(threadFetchCount).toBe(1);
    expect(
      screen.queryByText("Message after tab is visible")
    ).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(await screen.findByText("Message after tab is visible")).toBeInTheDocument();
    expect(threadFetchCount).toBeGreaterThanOrEqual(2);

    if (originalVisibilityDescriptor) {
      Object.defineProperty(document, "visibilityState", originalVisibilityDescriptor);
    }
    jest.useRealTimers();
  });

  test("sends message on Enter in composer", async () => {
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
          json: async () => [buildConversation()],
        };
      }

      if (isThreadHistoryUrl(url)) {
        return {
          ok: true,
          json: async () => ({ messages: [], hasMoreOlder: false }),
        };
      }

      if (url === "http://localhost:3001/api/messages/u2" && options.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            _id: "m-post",
            sender: "u1",
            recipient: "u2",
            text: "Hello via Enter",
            createdAt: "2026-03-31T14:00:00.000Z",
          }),
        };
      }

      return {
        ok: false,
        json: async () => ({ message: "Unhandled request" }),
      };
    });

    render(<Chat />);

    const conversationButton = await screen.findByRole("button", {
      name: "Open recent conversation with Other",
    });
    fireEvent.click(conversationButton);

    const composer = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(composer, { target: { value: "Hello via Enter" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/messages/u2",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  test("does not send message on Shift+Enter in composer", async () => {
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
          json: async () => [buildConversation()],
        };
      }

      if (isThreadHistoryUrl(url)) {
        return {
          ok: true,
          json: async () => ({ messages: [], hasMoreOlder: false }),
        };
      }

      if (url === "http://localhost:3001/api/messages/u2" && options.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            _id: "m-post-shift",
            sender: "u1",
            recipient: "u2",
            text: "Should not send",
            createdAt: "2026-03-31T14:00:00.000Z",
          }),
        };
      }

      return {
        ok: false,
        json: async () => ({ message: "Unhandled request" }),
      };
    });

    render(<Chat />);

    const conversationButton = await screen.findByRole("button", {
      name: "Open recent conversation with Other",
    });
    fireEvent.click(conversationButton);

    const composer = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(composer, { target: { value: "Should not send" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", shiftKey: true });

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalledWith(
        "http://localhost:3001/api/messages/u2",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
