import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CalendarPage from "./Calendar";

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ state: {} }),
}), { virtual: true });

jest.mock("react-calendar", () => () => <div data-testid="react-calendar" />);

jest.mock("../components/LoadingState", () => ({ message }) => <div>{message}</div>);

jest.mock("../utils/loading", () => ({
  withMinimumDelay: (taskOrPromise) =>
    typeof taskOrPromise === "function" ? taskOrPromise() : taskOrPromise,
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const fetchWithAuth = require("../utils/api").default;

describe("CalendarPage review prompt", () => {
  const currentUser = {
    id: "current-user",
    name: "Current User",
    username: "currentuser",
  };

  const pendingSwap = {
    _id: "swap-1",
    status: "confirmed",
    scheduledDate: "2030-01-10T18:00:00.000Z",
    duration: 60,
    requester: {
      _id: "partner-1",
      name: "Taylor",
      username: "taylor",
    },
    recipient: {
      _id: "current-user",
      name: "Current User",
      username: "currentuser",
    },
    requesterConfirmedAt: "2030-01-09T10:00:00.000Z",
    recipientConfirmedAt: null,
    reviews: {},
    milestones: [],
    skillOffered: "Guitar",
    skillWanted: "Spanish",
  };

  const completedSwap = {
    ...pendingSwap,
    status: "completed",
    recipientConfirmedAt: "2030-01-10T18:30:00.000Z",
    completedAt: "2030-01-10T18:30:00.000Z",
  };

  const confirmedSwap = {
    ...pendingSwap,
    status: "confirmed",
    recipientConfirmedAt: "2030-01-10T18:15:00.000Z",
    completedAt: null,
  };

  const reviewedSwap = {
    ...completedSwap,
    reviews: {
      recipientReview: {
        rating: 4,
        comment: "Helpful session",
        submittedAt: "2030-01-10T18:45:00.000Z",
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem("token", "fake-token");
    window.localStorage.setItem("user", JSON.stringify(currentUser));
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  // Run mock responses logic.
  function mockResponses() {
    const swapListResponses = [
      [pendingSwap],
      [completedSwap],
      [reviewedSwap],
    ];
    let reviewPayload = null;

    fetchWithAuth.mockImplementation((url, options = {}) => {
      const method = options.method || "GET";

      if (url.includes("/api/swaps/swap-1/confirm-session") && method === "PATCH") {
        return Promise.resolve({
          ok: true,
          json: async () => completedSwap,
        });
      }

      if (url.includes("/api/swaps/swap-1/review") && method === "PATCH") {
        reviewPayload = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => reviewedSwap,
        });
      }

      if (url.includes("/api/swaps") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: async () => swapListResponses.shift() || [reviewedSwap],
        });
      }

      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });

    return {
      getReviewPayload: () => reviewPayload,
    };
  }

  // Run mock first confirmation responses logic.
  function mockFirstConfirmationResponses() {
    const swapListResponses = [[pendingSwap], [confirmedSwap], [confirmedSwap]];
    let reviewPayload = null;

    fetchWithAuth.mockImplementation((url, options = {}) => {
      const method = options.method || "GET";

      if (url.includes("/api/swaps/swap-1/confirm-session") && method === "PATCH") {
        return Promise.resolve({
          ok: true,
          json: async () => confirmedSwap,
        });
      }

      if (url.includes("/api/swaps/swap-1/review") && method === "PATCH") {
        reviewPayload = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => confirmedSwap,
        });
      }

      if (url.includes("/api/swaps") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: async () => swapListResponses.shift() || [confirmedSwap],
        });
      }

      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });

    return {
      getReviewPayload: () => reviewPayload,
    };
  }

  test("prompts for a rating immediately after a swap is completed", async () => {
    mockResponses();

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm Session Done" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Session Done" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /rate your swap with taylor/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/swap completed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maybe later" })).toBeInTheDocument();
  });

  test("prompts the first confirmer to review before the swap is fully completed", async () => {
    mockFirstConfirmationResponses();

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm Session Done" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Session Done" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /leave your review for taylor/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/you can leave your rating now while you wait for the other person to confirm/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Review" })).toBeInTheDocument();
  });

  test("submits the prompted rating and optional review", async () => {
    const { getReviewPayload } = mockResponses();

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm Session Done" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Session Done" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /rate your swap with taylor/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "4" } });
    fireEvent.change(screen.getByPlaceholderText("Optional feedback"), {
      target: { value: "Helpful session" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Review" }));

    await waitFor(() => {
      expect(getReviewPayload()).toEqual({ rating: 4, comment: "Helpful session" });
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /rate your swap with taylor/i })).not.toBeInTheDocument();
    });
  });
});