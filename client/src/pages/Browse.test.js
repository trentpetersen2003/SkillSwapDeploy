import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Browse from "./Browse";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../utils/loading", () => ({
  withMinimumDelay: (taskOrPromise) =>
    typeof taskOrPromise === "function" ? taskOrPromise() : taskOrPromise,
}));

jest.mock("../components/SwapRequestModal", () => () => (
  <div data-testid="swap-request-modal">Swap Modal</div>
));

global.fetch = jest.fn();

describe("Browse onboarding gate", () => {
  const onOpenSetup = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem("token", "fake-token");
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          _id: "user-1",
          name: "Taylor",
          username: "taylor",
          skills: [{ skillName: "Guitar" }],
          skillsWanted: [{ skillName: "Spanish" }],
          reliability: { score: 88, tier: "Reliable" },
          matchScore: 91,
          matchReasons: ["Strong skill overlap"],
          swapMode: "either",
          city: "Boston",
          locationVisibility: "visible",
        },
      ]),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  test("blocks swap and message actions until profile setup is complete", async () => {
    render(<Browse isProfileComplete={false} onOpenSetup={onOpenSetup} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Request Swap" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Request Swap" }));

    expect(screen.getByText("Finish your profile first")).toBeInTheDocument();
    expect(
      screen.getByText("You can't request a swap yet. Finish your profile setup first.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("swap-request-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to setup" }));
    expect(onOpenSetup).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Message" }));
    expect(
      screen.getByText("You can't message people yet. Finish your profile setup first.")
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith("/chat?userId=user-1");
  });

  test("shows a setup-specific empty state when profile is incomplete", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([]),
    });

    render(<Browse isProfileComplete={false} onOpenSetup={onOpenSetup} />);

    await waitFor(() => {
      expect(screen.getByText("Complete your profile to browse other users.")).toBeInTheDocument();
    });
  });

  test("shows availability details from the browse card", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          _id: "user-1",
          name: "Taylor",
          username: "taylor",
          skills: [{ skillName: "Guitar" }],
          skillsWanted: [{ skillName: "Spanish" }],
          reliability: { score: 88, tier: "Reliable" },
          matchScore: 91,
          matchReasons: ["Strong skill overlap"],
          swapMode: "either",
          city: "Boston",
          locationVisibility: "visible",
          availability: [
            { day: "Monday", timeRange: "6pm - 8pm" },
            { day: "Wednesday", timeRange: "7pm - 9pm" },
          ],
          timeZone: "America/New_York",
        },
      ]),
    });

    render(<Browse isProfileComplete onOpenSetup={onOpenSetup} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "View Details" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "View Details" }));

    expect(screen.getByText("Availability")).toBeInTheDocument();
    expect(screen.getByText("Monday: 6pm - 8pm, Wednesday: 7pm - 9pm")).toBeInTheDocument();
    expect(screen.getByText("Time Zone")).toBeInTheDocument();
    expect(screen.getByText("America/New_York")).toBeInTheDocument();
  });
});
