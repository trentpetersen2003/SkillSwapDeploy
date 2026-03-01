import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LoadingState, { BlockingLoader, InlineLoading } from "./LoadingState";

describe("LoadingState components", () => {
  test("shows retry button and triggers callback", () => {
    const onRetry = jest.fn();
    render(<LoadingState message="Failed to load" onRetry={onRetry} />);

    expect(screen.getByText("Failed to load")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("renders inline loading message", () => {
    render(<InlineLoading message="Saving settings..." />);
    expect(screen.getByText("Saving settings...")).toBeInTheDocument();
  });

  test("renders blocking loader with busy state", () => {
    render(<BlockingLoader message="Logging out..." />);
    expect(screen.getByText("Logging out...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});
