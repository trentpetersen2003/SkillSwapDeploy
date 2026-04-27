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

});
