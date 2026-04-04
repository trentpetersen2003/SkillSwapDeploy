const User = require("../../models/User");
const { sendProfileCompletionReminders } = require("../../services/profileReminders");
const { sendProfileCompletionReminderEmail } = require("../../services/email");

jest.mock("../../models/User");
jest.mock("../../services/email", () => ({
  sendProfileCompletionReminderEmail: jest.fn(),
}));

describe("Profile reminder service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EMAIL_PROFILE_REMINDER_COOLDOWN_DAYS;
  });

  test("sends reminder to eligible incomplete profiles", async () => {
    const save = jest.fn().mockResolvedValue(true);
    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        {
          name: "User One",
          email: "user1@example.com",
          city: "",
          state: "MA",
          timeZone: "UTC-05:00",
          availability: [{ day: "Monday", timeRange: "8:00 AM - 9:00 AM" }],
          skills: [{ skillName: "React" }],
          skillsWanted: [{ skillName: "Python" }],
          notificationPreferences: { profileReminderEmail: true },
          lastProfileReminderAt: null,
          save,
        },
      ]),
    });

    sendProfileCompletionReminderEmail.mockResolvedValue({ sent: true });

    const summary = await sendProfileCompletionReminders({ limit: 10 });

    expect(sendProfileCompletionReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user1@example.com",
      })
    );
    expect(save).toHaveBeenCalled();
    expect(summary.sent).toBe(1);
  });

  test("skips users who are inside cooldown", async () => {
    process.env.EMAIL_PROFILE_REMINDER_COOLDOWN_DAYS = "7";

    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        {
          name: "User Two",
          email: "user2@example.com",
          city: "",
          state: "MA",
          timeZone: "UTC-05:00",
          availability: [{ day: "Monday", timeRange: "8:00 AM - 9:00 AM" }],
          skills: [{ skillName: "React" }],
          skillsWanted: [{ skillName: "Python" }],
          notificationPreferences: { profileReminderEmail: true },
          lastProfileReminderAt: new Date(),
          save: jest.fn(),
        },
      ]),
    });

    const summary = await sendProfileCompletionReminders({ limit: 10 });

    expect(sendProfileCompletionReminderEmail).not.toHaveBeenCalled();
    expect(summary.sent).toBe(0);
    expect(summary.skipped).toBe(1);
  });
});
