import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  test("prevents duplicate skills in the offer list", async () => {
    fetchWithAuth.mockResolvedValueOnce({
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
        skills: [{ skillName: "Guitar", category: "Creative & Arts", level: "Novice" }],
        skillsWanted: [],
      }),
    });

    render(<Profile setupRequired={true} />);

    await waitFor(() => {
      expect(screen.getAllByRole("tab")).toHaveLength(5);
    });

    fireEvent.click(screen.getAllByRole("tab")[2]);

    await waitFor(() => {
      expect(screen.getByText("Skills you offer")).toBeInTheDocument();
    });

    expect(
      screen.getByText((_, element) => (
        element?.classList?.contains("profile-skill-card__text") &&
        element.textContent === "Guitar - Creative & Arts (Novice)"
      ))
    ).toBeInTheDocument();

    fireEvent.change(screen.getAllByLabelText("Skill name")[0], { target: { value: "Guitar" } });
    fireEvent.change(screen.getAllByLabelText("Category")[0], {
      target: { value: "Creative & Arts" },
    });
    fireEvent.change(screen.getAllByLabelText("Level")[0], { target: { value: "Novice" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Skill" }));

    expect(screen.getByText("Warning: That skill is already in your offer list.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  test("prevents duplicate offered skills by name only", async () => {
    fetchWithAuth.mockResolvedValueOnce({
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
        skills: [{ skillName: "Spanish", category: "Languages", level: "Novice" }],
        skillsWanted: [],
      }),
    });

    render(<Profile setupRequired={true} />);

    await waitFor(() => {
      expect(screen.getAllByRole("tab")).toHaveLength(5);
    });

    fireEvent.click(screen.getAllByRole("tab")[2]);

    await waitFor(() => {
      expect(screen.getByText("Skills you offer")).toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByLabelText("Skill name")[0], { target: { value: "Spanish" } });
    fireEvent.change(screen.getAllByLabelText("Category")[0], {
      target: { value: "Career & Professional" },
    });
    fireEvent.change(screen.getAllByLabelText("Level")[0], { target: { value: "Expert" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Skill" }));

    expect(screen.getByText("Warning: That skill is already in your offer list.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  test("removes all identical offered skills at once", async () => {
    fetchWithAuth.mockResolvedValueOnce({
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
        skills: [
          { skillName: "Guitar", category: "Creative & Arts", level: "Novice" },
          { skillName: "Guitar", category: "Creative & Arts", level: "Novice" },
        ],
        skillsWanted: [],
      }),
    });

    render(<Profile setupRequired={true} />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    await waitFor(() => {
      expect(screen.queryByText(/Guitar - Creative & Arts \(Novice\)/)).not.toBeInTheDocument();
    });
  });

  test("prevents duplicate skills in the wanted list", async () => {
    fetchWithAuth.mockResolvedValueOnce({
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
        skillsWanted: [{ skillName: "Spanish", category: "Languages", level: "Novice" }],
      }),
    });

    render(<Profile setupRequired={true} />);

    await waitFor(() => {
      expect(screen.getAllByRole("tab")).toHaveLength(5);
    });

    fireEvent.click(screen.getAllByRole("tab")[3]);

    await waitFor(() => {
      expect(screen.getByText("Skills you want")).toBeInTheDocument();
    });

    const learnSection = screen.getByText("Skills you want").closest("section");
    const learnQueries = within(learnSection);

    fireEvent.change(learnQueries.getByLabelText("Skill name"), { target: { value: "Spanish" } });
    fireEvent.change(learnQueries.getByLabelText("Category"), {
      target: { value: "Languages" },
    });
    fireEvent.change(learnQueries.getByLabelText("Level"), { target: { value: "Novice" } });
    fireEvent.click(learnQueries.getByRole("button", { name: "Add Skill Wanted" }));

    expect(screen.getByText("Warning: That skill is already in your wanted list.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  test("prevents duplicate wanted skills by name only", async () => {
    fetchWithAuth.mockResolvedValueOnce({
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
        skillsWanted: [{ skillName: "Spanish", category: "Languages", level: "Novice" }],
      }),
    });

    render(<Profile setupRequired={true} />);

    await waitFor(() => {
      expect(screen.getAllByRole("tab")).toHaveLength(5);
    });

    fireEvent.click(screen.getAllByRole("tab")[3]);

    await waitFor(() => {
      expect(screen.getByText("Skills you want")).toBeInTheDocument();
    });

    const learnSection = screen.getByText("Skills you want").closest("section");
    const learnQueries = within(learnSection);

    fireEvent.change(learnQueries.getByLabelText("Skill name"), { target: { value: "Spanish" } });
    fireEvent.change(learnQueries.getByLabelText("Category"), {
      target: { value: "Career & Professional" },
    });
    fireEvent.change(learnQueries.getByLabelText("Level"), { target: { value: "Expert" } });
    fireEvent.click(learnQueries.getByRole("button", { name: "Add Skill Wanted" }));

    expect(screen.getByText("Warning: That skill is already in your wanted list.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });
});
