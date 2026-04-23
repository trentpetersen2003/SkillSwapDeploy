const {
  computeMatch,
  rankCandidates,
  getMatchingTelemetrySnapshot,
  resetMatchingTelemetry,
} = require("../../services/matching");

// Run skill logic.
function skill(skillName, category) {
  return { skillName, category };
}

describe("Matching Service", () => {
  beforeEach(() => {
    resetMatchingTelemetry();
  });

  test("prefers reciprocal exact teach/learn matches", () => {
    const currentUser = {
      skills: [skill("React", "Tech & Programming")],
      skillsWanted: [skill("Python", "Tech & Programming")],
      availability: [{ day: "Monday", timeRange: "6:00 PM - 8:00 PM" }],
      timeZone: "UTC-05:00",
    };

    const candidate = {
      skills: [skill("Python", "Tech & Programming")],
      skillsWanted: [skill("React", "Tech & Programming")],
      availability: [{ day: "Monday", timeRange: "7:00 PM - 9:00 PM" }],
      timeZone: "UTC-05:00",
      name: "Alex",
    };

    const match = computeMatch(currentUser, candidate, { score: 82, tier: "Reliable" });

    expect(match.matchScore).toBeGreaterThanOrEqual(80);
    expect(match.matchBreakdown.skillScore).toBe(100);
    expect(match.matchReasons.join(" ")).toContain("Teaches skills you want");
  });

  test("supports related skill-family matches", () => {
    const currentUser = {
      skills: [skill("Java", "Tech & Programming")],
      skillsWanted: [skill("Python", "Tech & Programming")],
      availability: [{ day: "Wednesday", timeRange: "6:00 PM - 8:00 PM" }],
      timeZone: "UTC+00:00",
    };

    const candidate = {
      skills: [skill("JavaScript", "Tech & Programming")],
      skillsWanted: [skill("TypeScript", "Tech & Programming")],
      availability: [{ day: "Wednesday", timeRange: "6:30 PM - 8:30 PM" }],
      timeZone: "UTC+01:00",
      name: "Taylor",
    };

    const match = computeMatch(currentUser, candidate, { score: 70, tier: "Reliable" });

    expect(match.matchBreakdown.skillScore).toBeGreaterThanOrEqual(30);
    expect(match.matchScore).toBeGreaterThanOrEqual(45);
    expect(match.matchReasons.length).toBeGreaterThan(0);
  });

  test("matches shorthand and free-text variants consistently", () => {
    const currentUser = {
      skills: [skill("JS", "Tech & Programming")],
      skillsWanted: [skill("Machine Learning Basics", "Tech & Programming")],
      availability: [{ day: "Tuesday", timeRange: "6:00 PM - 8:00 PM" }],
      timeZone: "UTC-05:00",
    };

    const candidate = {
      skills: [skill("ML", "Tech & Programming")],
      skillsWanted: [skill("JavaScript", "Tech & Programming")],
      availability: [{ day: "Tuesday", timeRange: "6:30 PM - 8:30 PM" }],
      timeZone: "UTC-05:00",
      name: "Jordan",
    };

    const match = computeMatch(currentUser, candidate, { score: 75, tier: "Reliable" });

    expect(match.matchBreakdown.skillScore).toBeGreaterThanOrEqual(70);
    expect(match.matchScore).toBeGreaterThanOrEqual(70);
    expect(match.matchReasons.length).toBeGreaterThan(0);
  });

  test("matches additional conservative aliases like accessibility and backend api", () => {
    const currentUser = {
      skills: [skill("Presentation Skills", "Career & Professional")],
      skillsWanted: [skill("WCAG", "Tech & Programming")],
      availability: [{ day: "Thursday", timeRange: "6:00 PM - 8:00 PM" }],
      timeZone: "UTC-05:00",
    };

    const candidate = {
      skills: [skill("Web Accessibility", "Tech & Programming")],
      skillsWanted: [skill("Backend API Development", "Tech & Programming")],
      availability: [{ day: "Thursday", timeRange: "6:30 PM - 8:30 PM" }],
      timeZone: "UTC-05:00",
      name: "Sam",
    };

    const match = computeMatch(currentUser, candidate, { score: 68, tier: "Reliable" });

    expect(match.matchBreakdown.skillScore).toBeGreaterThanOrEqual(45);
    expect(match.matchScore).toBeGreaterThanOrEqual(55);
    expect(match.matchReasons.length).toBeGreaterThan(0);
  });

  test("ranks better matches first", () => {
    const currentUser = {
      skills: [skill("React", "Tech & Programming")],
      skillsWanted: [skill("Python", "Tech & Programming")],
      availability: [{ day: "Friday", timeRange: "6:00 PM - 8:00 PM" }],
      timeZone: "UTC-05:00",
    };

    const candidates = [
      {
        _id: "u2",
        name: "Low Fit",
        skills: [skill("Public Speaking", "Career & Professional")],
        skillsWanted: [skill("Design", "Creative & Arts")],
        availability: [{ day: "Friday", timeRange: "6:00 PM - 8:00 PM" }],
        timeZone: "UTC-05:00",
      },
      {
        _id: "u1",
        name: "High Fit",
        skills: [skill("Python", "Tech & Programming")],
        skillsWanted: [skill("React", "Tech & Programming")],
        availability: [{ day: "Friday", timeRange: "7:00 PM - 8:00 PM" }],
        timeZone: "UTC-05:00",
      },
    ];

    const ranked = rankCandidates(currentUser, candidates, {
      u1: { score: 84, tier: "Reliable" },
      u2: { score: 42, tier: "At Risk" },
    });

    expect(ranked[0].name).toBe("High Fit");
    expect(ranked[0].matchScore).toBeGreaterThan(ranked[1].matchScore);
    expect(ranked[0]).toEqual(expect.objectContaining({ matchReasons: expect.any(Array) }));
  });

  test("filters out candidates without schedulable overlap", () => {
    const currentUser = {
      skills: [skill("React", "Tech & Programming")],
      skillsWanted: [skill("Python", "Tech & Programming")],
      availability: [{ day: "Monday", timeRange: "6:00 PM - 8:00 PM" }],
      timeZone: "UTC-08:00",
    };

    const candidates = [
      {
        _id: "u1",
        name: "No Overlap",
        skills: [skill("Python", "Tech & Programming")],
        skillsWanted: [skill("React", "Tech & Programming")],
        availability: [{ day: "Wednesday", timeRange: "8:00 AM - 9:00 AM" }],
        timeZone: "UTC-05:00",
      },
      {
        _id: "u2",
        name: "Has Overlap",
        skills: [skill("Python", "Tech & Programming")],
        skillsWanted: [skill("React", "Tech & Programming")],
        availability: [{ day: "Monday", timeRange: "7:00 PM - 8:30 PM" }],
        timeZone: "UTC-08:00",
      },
    ];

    const ranked = rankCandidates(currentUser, candidates, {
      u1: { score: 80, tier: "Reliable" },
      u2: { score: 80, tier: "Reliable" },
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].name).toBe("Has Overlap");
  });

  test("preserves public fields when ranking Mongoose-like documents", () => {
    const currentUser = {
      skills: [skill("React", "Tech & Programming")],
      skillsWanted: [skill("Python", "Tech & Programming")],
      availability: [{ day: "Monday", timeRange: "6:00 PM - 8:00 PM" }],
      timeZone: "UTC-05:00",
    };

    const candidateDoc = {
      toObject: () => ({
        _id: "u-ava",
        name: "Ava Thompson",
        username: "avathompson",
        city: "Seattle",
        locationVisibility: "visible",
        skills: [skill("Python", "Tech & Programming")],
        skillsWanted: [skill("React", "Tech & Programming")],
        availability: [{ day: "Monday", timeRange: "3:00 PM - 5:00 PM" }],
        timeZone: "UTC-08:00",
      }),
    };

    const ranked = rankCandidates(currentUser, [candidateDoc], {
      "u-ava": { score: 90, tier: "Reliable" },
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toEqual(
      expect.objectContaining({
        _id: "u-ava",
        name: "Ava Thompson",
        username: "avathompson",
        city: "Seattle",
        skills: expect.any(Array),
        skillsWanted: expect.any(Array),
        matchScore: expect.any(Number),
        matchReasons: expect.any(Array),
      })
    );
  });

  test("tracks low-confidence skills for synonym tuning", () => {
    const currentUser = {
      skills: [skill("Public Speaking", "Career & Professional")],
      skillsWanted: [skill("Zen Garden Design", "Hobbies & Misc")],
      availability: [{ day: "Friday", timeRange: "6:00 PM - 8:00 PM" }],
      timeZone: "UTC-05:00",
    };

    const candidate = {
      skills: [skill("Node.js", "Tech & Programming")],
      skillsWanted: [skill("Illustration", "Creative & Arts")],
      availability: [{ day: "Friday", timeRange: "7:00 PM - 8:00 PM" }],
      timeZone: "UTC-05:00",
      name: "Telemetry Candidate",
    };

    computeMatch(currentUser, candidate, { score: 60, tier: "Building" });
    const snapshot = getMatchingTelemetrySnapshot();

    expect(snapshot.totalEvaluations).toBe(1);
    expect(snapshot.unmatchedWantedSkills.length).toBeGreaterThan(0);
    expect(snapshot.unmatchedWantedSkills[0].value).toContain("zen");

    resetMatchingTelemetry();
    const resetSnapshot = getMatchingTelemetrySnapshot();
    expect(resetSnapshot.totalEvaluations).toBe(0);
    expect(resetSnapshot.unmatchedWantedSkills).toHaveLength(0);
  });
});
