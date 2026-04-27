import { getProfileSetupStatus } from "./profileSetup";

describe("profile setup utilities", () => {
  test("marks incomplete profiles with the expected missing fields", () => {
    const status = getProfileSetupStatus({
      name: "Taylor",
      email: "taylor@example.com",
      city: "",
      state: "",
      timeZone: "",
      availability: [],
      skills: [],
      skillsWanted: [],
    });

    expect(status.isComplete).toBe(false);
    expect(status.missingFields).toEqual([
      "location",
      "state",
      "time zone",
      "availability",
      "skills",
    ]);
  });

  test("treats an empty wanted-skills list as complete", () => {
    const status = getProfileSetupStatus({
      name: "Taylor",
      email: "taylor@example.com",
      city: "Boston",
      state: "MA",
      timeZone: "UTC-04:00",
      availability: [{ day: "Monday", timeRange: "6:00 PM - 8:00 PM" }],
      skills: [{ skillName: "Guitar" }],
      skillsWanted: [],
    });

    expect(status.isComplete).toBe(true);
    expect(status.missingFields).toEqual([]);
  });

  test("marks fully populated profiles as complete", () => {
    const status = getProfileSetupStatus({
      name: "Taylor",
      email: "taylor@example.com",
      city: "Boston",
      state: "MA",
      timeZone: "UTC-04:00",
      availability: [{ day: "Monday", timeRange: "6:00 PM - 8:00 PM" }],
      skills: [{ skillName: "Guitar" }],
      skillsWanted: [{ skillName: "Spanish" }],
    });

    expect(status.isComplete).toBe(true);
    expect(status.missingFields).toEqual([]);
  });
});
