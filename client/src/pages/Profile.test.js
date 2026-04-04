import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Profile from "./Profile";
import fetchWithAuth from "../utils/api";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../config", () => "http://localhost:3001");

jest.mock("../utils/loading", () => ({
  withMinimumDelay: async (taskOrPromise) => {
    if (typeof taskOrPromise === "function") {
      return taskOrPromise();
    }
    return taskOrPromise;
  },
}));

jest.mock("../utils/api", () => jest.fn());

describe("Profile Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("token", "test-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "u1",
        username: "testuser",
        email: "test@example.com",
      })
    );

    fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        _id: "u1",
        name: "Test User",
        email: "test@example.com",
        city: "Toronto",
        state: "ON",
        phoneNumber: "",
        timeZone: "UTC-05:00",
        swapMode: "either",
        availability: [],
        skills: [],
        skillsWanted: [],
      }),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("includes Canadian province options in the state/province dropdown", async () => {
    render(<Profile setupRequired={true} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "State" })).toBeInTheDocument();
    });

    expect(screen.getByRole("option", { name: "ON" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "BC" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "State" })).toHaveValue("ON");
  });
});
