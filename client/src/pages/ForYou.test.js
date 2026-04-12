import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ForYouPage from "./ForYou";

const mockNavigate = jest.fn();
const mockSwapRequestModal = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../utils/loading", () => ({
  withMinimumDelay: (taskOrPromise) =>
    typeof taskOrPromise === "function" ? taskOrPromise() : taskOrPromise,
}));

jest.mock("../components/SwapRequestModal", () => (props) => {
  mockSwapRequestModal(props);
  return (
    <div data-testid="swap-request-modal">
      <button type="button" onClick={() => props.onSuccess({})}>
        Complete Swap Request
      </button>
      <button type="button" onClick={props.onClose}>
        Close Swap Modal
      </button>
    </div>
  );
});

global.fetch = jest.fn();

describe("ForYouPage", () => {
  // Run mock fetch data logic.
  function mockFetchData({
    users = [
      {
        _id: "user-1",
        name: "Taylor",
        username: "taylor",
        skills: [{ skillName: "Guitar" }],
        skillsWanted: [{ skillName: "Spanish" }],
        matchScore: 92,
        matchReasons: ["Teaches skills you want: Spanish"],
        reliability: { score: 88, tier: "Reliable" },
      },
    ],
    swaps = [],
  } = {}) {
    fetch.mockImplementation((url) => {
      if (url.includes("/api/for-you")) {
        return Promise.resolve({
          ok: true,
          json: async () => users,
        });
      }

      if (url.includes("/api/swaps")) {
        return Promise.resolve({
          ok: true,
          json: async () => swaps,
        });
      }

      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem("token", "fake-token");
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        id: "current-user",
        name: "Current User",
        username: "currentuser",
      })
    );
    mockFetchData();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  test("shows a dismissible success popup after sending a swap request", async () => {
    render(<ForYouPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Request Swap" })).toBeInTheDocument();
    });

    const userCard = screen.getByText("Taylor").closest(".user-card");
    expect(userCard).not.toBeNull();
    expect(userCard).toHaveTextContent(/Offers:\s+Guitar/i);
    expect(userCard).toHaveTextContent(/Wants:\s+Spanish/i);

    expect(screen.getByText("Match 92%")).toBeInTheDocument();
    expect(screen.getByText("Teaches skills you want: Spanish")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Request Swap" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Swap Request" }));

    expect(screen.getByText("Swap Request Sent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Calendar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Close notification")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith("/calendar");
  });

  test("navigates to the calendar only when the popup action is clicked", async () => {
    render(<ForYouPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Request Swap" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Request Swap" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Swap Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Go to Calendar" }));

    expect(mockNavigate).toHaveBeenCalledWith("/calendar");
    expect(screen.queryByText("Swap Request Sent")).not.toBeInTheDocument();
  });

  test("closes the success popup when the close button is clicked", async () => {
    render(<ForYouPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Request Swap" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Request Swap" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Swap Request" }));
    fireEvent.click(screen.getByLabelText("Close notification"));

    expect(screen.queryByText("Swap Request Sent")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith("/calendar");
  });

  test("shows a notification badge and menu items for current swap notifications", async () => {
    mockFetchData({
      swaps: [
        {
          _id: "swap-1",
          status: "pending",
          scheduledDate: "2030-01-10T14:00:00.000Z",
          requester: { _id: "user-1", name: "Taylor", username: "taylor" },
          recipient: { _id: "current-user", name: "Current User", username: "currentuser" },
        },
        {
          _id: "swap-2",
          status: "confirmed",
          scheduledDate: "2030-01-12T16:00:00.000Z",
          requester: { _id: "current-user", name: "Current User", username: "currentuser" },
          recipient: { _id: "user-1", name: "Taylor", username: "taylor" },
        },
      ],
    });

    render(<ForYouPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open notifications" })).toBeInTheDocument();
    });

    expect(screen.getByText("2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("Incoming swap request")).toBeInTheDocument();
    expect(screen.getByText("Swap request accepted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear All" })).toBeInTheDocument();
  });

  test("dismisses notifications individually and clears them all", async () => {
    mockFetchData({
      swaps: [
        {
          _id: "swap-1",
          status: "pending",
          scheduledDate: "2030-01-10T14:00:00.000Z",
          requester: { _id: "user-1", name: "Taylor", username: "taylor" },
          recipient: { _id: "current-user", name: "Current User", username: "currentuser" },
        },
        {
          _id: "swap-2",
          status: "cancelled",
          scheduledDate: "2030-01-12T16:00:00.000Z",
          requester: { _id: "current-user", name: "Current User", username: "currentuser" },
          recipient: { _id: "user-1", name: "Taylor", username: "taylor" },
        },
      ],
    });

    render(<ForYouPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open notifications" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss Incoming swap request" }));

    expect(screen.queryByText("Incoming swap request")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));

    expect(screen.queryByText("Swap request declined")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.getByText("No notifications right now.")).toBeInTheDocument();
  });

  test("opens the specific swap on the calendar when an actionable notification is clicked", async () => {
    mockFetchData({
      swaps: [
        {
          _id: "swap-1",
          status: "pending",
          scheduledDate: "2030-01-10T14:00:00.000Z",
          requester: { _id: "user-1", name: "Taylor", username: "taylor" },
          recipient: { _id: "current-user", name: "Current User", username: "currentuser" },
        },
      ],
    });

    render(<ForYouPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open notifications" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Incoming swap request" }));

    expect(mockNavigate).toHaveBeenCalledWith("/calendar", {
      state: {
        focusSwapId: "swap-1",
        focusView: "list",
      },
    });
  });
});
