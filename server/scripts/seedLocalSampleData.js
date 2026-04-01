const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

const User = require("../models/User");
const Swap = require("../models/Swap");
const Message = require("../models/Message");
const PasswordResetToken = require("../models/PasswordResetToken");

dotenv.config();

const DEFAULT_PASSWORD = "SkillSwap!123";
const STRESS_MODE = process.argv.includes("--stress");
const EDGE_MODE = process.argv.includes("--edge");

const SAMPLE_USERS = [
  {
    key: "ava",
    name: "Ava Thompson",
    username: "avathompson",
    email: "ava@skillswap.local",
    city: "Seattle",
    timeZone: "UTC-08:00",
    phoneNumber: "206-555-0111",
    bio: "Frontend developer who mentors beginners and wants to improve Spanish conversation skills.",
    locationVisibility: "visible",
    showOthersLocations: true,
    notificationPreferences: {
      swapRequestEmail: true,
      swapConfirmedEmail: true,
      swapCancelledEmail: true,
    },
    availability: [
      { day: "Monday", timeRange: "6:00 PM - 8:00 PM" },
      { day: "Wednesday", timeRange: "7:00 PM - 9:00 PM" },
      { day: "Saturday", timeRange: "10:00 AM - 12:00 PM" },
    ],
    skills: [
      { skillName: "React", category: "Tech & Programming", level: "Expert" },
      { skillName: "UI Design", category: "Creative & Arts", level: "Proficient" },
      { skillName: "Public Speaking", category: "Career & Professional", level: "Proficient" },
    ],
    skillsWanted: [
      { skillName: "Spanish Conversation", category: "Languages", level: "Novice" },
      { skillName: "Guitar", category: "Hobbies & Misc", level: "Novice" },
    ],
  },
  {
    key: "ben",
    name: "Ben Carter",
    username: "bencarter",
    email: "ben@skillswap.local",
    city: "San Diego",
    timeZone: "UTC-08:00",
    phoneNumber: "619-555-0112",
    bio: "Data analyst who enjoys helping with SQL and wants to improve fitness planning.",
    locationVisibility: "visible",
    showOthersLocations: true,
    notificationPreferences: {
      swapRequestEmail: true,
      swapConfirmedEmail: true,
      swapCancelledEmail: true,
    },
    availability: [
      { day: "Tuesday", timeRange: "6:30 PM - 8:30 PM" },
      { day: "Thursday", timeRange: "6:30 PM - 8:30 PM" },
      { day: "Sunday", timeRange: "1:00 PM - 3:00 PM" },
    ],
    skills: [
      { skillName: "SQL", category: "Tech & Programming", level: "Expert" },
      { skillName: "Excel", category: "Career & Professional", level: "Expert" },
      { skillName: "Spanish Conversation", category: "Languages", level: "Proficient" },
    ],
    skillsWanted: [
      { skillName: "Strength Training", category: "Fitness & Wellness", level: "Novice" },
      { skillName: "Python", category: "Tech & Programming", level: "Novice" },
    ],
  },
  {
    key: "chloe",
    name: "Chloe Rivera",
    username: "chloerivera",
    email: "chloe@skillswap.local",
    city: "Austin",
    timeZone: "UTC-06:00",
    phoneNumber: "512-555-0113",
    bio: "Graphic designer and illustrator; wants to become better at backend APIs.",
    locationVisibility: "visible",
    showOthersLocations: true,
    notificationPreferences: {
      swapRequestEmail: true,
      swapConfirmedEmail: true,
      swapCancelledEmail: false,
    },
    availability: [
      { day: "Monday", timeRange: "5:30 PM - 7:30 PM" },
      { day: "Friday", timeRange: "6:00 PM - 9:00 PM" },
      { day: "Saturday", timeRange: "2:00 PM - 5:00 PM" },
    ],
    skills: [
      { skillName: "Illustration", category: "Creative & Arts", level: "Expert" },
      { skillName: "Figma", category: "Creative & Arts", level: "Expert" },
      { skillName: "Branding", category: "Career & Professional", level: "Proficient" },
    ],
    skillsWanted: [
      { skillName: "Node.js", category: "Tech & Programming", level: "Novice" },
      { skillName: "System Design", category: "Tech & Programming", level: "Novice" },
    ],
  },
  {
    key: "diego",
    name: "Diego Morales",
    username: "diegomorales",
    email: "diego@skillswap.local",
    city: "Miami",
    timeZone: "UTC-05:00",
    phoneNumber: "305-555-0114",
    bio: "Personal trainer and nutrition coach learning web accessibility and UX writing.",
    locationVisibility: "visible",
    showOthersLocations: true,
    notificationPreferences: {
      swapRequestEmail: true,
      swapConfirmedEmail: true,
      swapCancelledEmail: true,
    },
    availability: [
      { day: "Tuesday", timeRange: "7:00 AM - 9:00 AM" },
      { day: "Thursday", timeRange: "7:00 AM - 9:00 AM" },
      { day: "Saturday", timeRange: "9:00 AM - 11:00 AM" },
    ],
    skills: [
      { skillName: "Strength Training", category: "Fitness & Wellness", level: "Expert" },
      { skillName: "Meal Planning", category: "Life Skills", level: "Proficient" },
      { skillName: "Motivation Coaching", category: "Career & Professional", level: "Proficient" },
    ],
    skillsWanted: [
      { skillName: "Accessibility", category: "Tech & Programming", level: "Novice" },
      { skillName: "UX Writing", category: "Creative & Arts", level: "Novice" },
    ],
  },
  {
    key: "emma",
    name: "Emma Li",
    username: "emmali",
    email: "emma@skillswap.local",
    city: "Boston",
    timeZone: "UTC-05:00",
    phoneNumber: "617-555-0115",
    bio: "Graduate student who teaches calculus and machine learning basics.",
    locationVisibility: "hidden",
    showOthersLocations: true,
    notificationPreferences: {
      swapRequestEmail: false,
      swapConfirmedEmail: true,
      swapCancelledEmail: true,
    },
    availability: [
      { day: "Wednesday", timeRange: "6:00 PM - 8:00 PM" },
      { day: "Friday", timeRange: "6:00 PM - 8:00 PM" },
      { day: "Sunday", timeRange: "11:00 AM - 1:00 PM" },
    ],
    skills: [
      { skillName: "Calculus", category: "Academic & Tutoring", level: "Expert" },
      { skillName: "Machine Learning", category: "Tech & Programming", level: "Proficient" },
      { skillName: "Python", category: "Tech & Programming", level: "Expert" },
    ],
    skillsWanted: [
      { skillName: "Public Speaking", category: "Career & Professional", level: "Novice" },
      { skillName: "Illustration", category: "Creative & Arts", level: "Novice" },
    ],
  },
  {
    key: "farah",
    name: "Farah Ahmed",
    username: "farahahmed",
    email: "farah@skillswap.local",
    city: "Toronto",
    timeZone: "UTC-05:00",
    phoneNumber: "416-555-0116",
    bio: "Product manager who can coach interview prep and roadmap planning.",
    locationVisibility: "visible",
    showOthersLocations: false,
    notificationPreferences: {
      swapRequestEmail: true,
      swapConfirmedEmail: false,
      swapCancelledEmail: true,
    },
    availability: [
      { day: "Monday", timeRange: "7:00 PM - 9:00 PM" },
      { day: "Thursday", timeRange: "7:00 PM - 9:00 PM" },
      { day: "Saturday", timeRange: "3:00 PM - 5:00 PM" },
    ],
    skills: [
      { skillName: "Interview Prep", category: "Career & Professional", level: "Expert" },
      { skillName: "Product Strategy", category: "Career & Professional", level: "Expert" },
      { skillName: "Agile Coaching", category: "Career & Professional", level: "Proficient" },
    ],
    skillsWanted: [
      { skillName: "SQL", category: "Tech & Programming", level: "Novice" },
      { skillName: "Spanish Conversation", category: "Languages", level: "Novice" },
    ],
  },
  {
    key: "grace",
    name: "Grace Kim",
    username: "gracekim",
    email: "grace@skillswap.local",
    city: "Portland",
    timeZone: "UTC-08:00",
    phoneNumber: "503-555-0117",
    bio: "Music teacher and hobby game dev who wants to improve backend scalability.",
    locationVisibility: "visible",
    showOthersLocations: true,
    notificationPreferences: {
      swapRequestEmail: true,
      swapConfirmedEmail: true,
      swapCancelledEmail: true,
    },
    availability: [
      { day: "Tuesday", timeRange: "5:00 PM - 7:00 PM" },
      { day: "Friday", timeRange: "5:00 PM - 7:00 PM" },
      { day: "Sunday", timeRange: "10:00 AM - 12:00 PM" },
    ],
    skills: [
      { skillName: "Guitar", category: "Hobbies & Misc", level: "Expert" },
      { skillName: "Music Theory", category: "Academic & Tutoring", level: "Proficient" },
      { skillName: "Unity Basics", category: "Tech & Programming", level: "Proficient" },
    ],
    skillsWanted: [
      { skillName: "Node.js", category: "Tech & Programming", level: "Novice" },
      { skillName: "API Testing", category: "Tech & Programming", level: "Novice" },
    ],
  },
  {
    key: "henry",
    name: "Henry Okafor",
    username: "henryokafor",
    email: "henry@skillswap.local",
    city: "Chicago",
    timeZone: "UTC-06:00",
    phoneNumber: "312-555-0118",
    bio: "Backend engineer mentoring API design and cloud basics.",
    locationVisibility: "visible",
    showOthersLocations: true,
    notificationPreferences: {
      swapRequestEmail: true,
      swapConfirmedEmail: true,
      swapCancelledEmail: true,
    },
    availability: [
      { day: "Monday", timeRange: "8:00 PM - 10:00 PM" },
      { day: "Wednesday", timeRange: "8:00 PM - 10:00 PM" },
      { day: "Saturday", timeRange: "1:00 PM - 3:00 PM" },
    ],
    skills: [
      { skillName: "Node.js", category: "Tech & Programming", level: "Expert" },
      { skillName: "System Design", category: "Tech & Programming", level: "Expert" },
      { skillName: "API Testing", category: "Tech & Programming", level: "Proficient" },
    ],
    skillsWanted: [
      { skillName: "Product Strategy", category: "Career & Professional", level: "Novice" },
      { skillName: "Guitar", category: "Hobbies & Misc", level: "Novice" },
    ],
  },
];

const EDGE_USERS = [
  {
    key: "ivy",
    name: "Ivy Zero",
    username: "ivyzero",
    email: "ivy@skillswap.local",
    city: "",
    timeZone: "UTC+00:00",
    phoneNumber: "",
    bio: "Edge case user with intentionally sparse profile data.",
    locationVisibility: "hidden",
    showOthersLocations: false,
    notificationPreferences: {
      swapRequestEmail: false,
      swapConfirmedEmail: false,
      swapCancelledEmail: false,
    },
    availability: [],
    skills: [],
    skillsWanted: [],
  },
  {
    key: "noah",
    name: "Noah Sparse",
    username: "noahsparse",
    email: "noah@skillswap.local",
    city: "Remote",
    timeZone: "UTC+13:00",
    phoneNumber: "",
    bio: "Edge case user with narrow availability and uncommon timezone.",
    locationVisibility: "visible",
    showOthersLocations: true,
    notificationPreferences: {
      swapRequestEmail: true,
      swapConfirmedEmail: false,
      swapCancelledEmail: true,
    },
    availability: [{ day: "Sunday", timeRange: "11:45 PM - 11:59 PM" }],
    skills: [{ skillName: "Timeboxing", category: "Life Skills", level: "Novice" }],
    skillsWanted: [{ skillName: "Node.js", category: "Tech & Programming", level: "Novice" }],
  },
];

function getActiveUsers() {
  return EDGE_MODE ? [...SAMPLE_USERS, ...EDGE_USERS] : SAMPLE_USERS;
}

function buildUserLookup(users) {
  return users.reduce((acc, user) => {
    acc[user.key] = user;
    return acc;
  }, {});
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days, hours = 18) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, 0, 0, 0);
  return d;
}

function withOffset(baseDate, minutesOffset) {
  return new Date(baseDate.getTime() + minutesOffset * 60 * 1000);
}

function buildSwapSeeds(userIds) {
  return [
    {
      requester: userIds.ava,
      recipient: userIds.ben,
      skillOffered: "React",
      skillWanted: "Spanish Conversation",
      scheduledDate: daysFromNow(2, 19),
      duration: 60,
      location: "Zoom Room A",
      notes: "Focus on speaking exercises and frontend components.",
      totalSessions: 3,
      milestones: [
        { title: "Intro and goals alignment", completed: true, completedAt: daysAgo(1) },
        { title: "React state management practice", completed: true, completedAt: daysAgo(1) },
        { title: "Spanish speaking drill", completed: false },
      ],
      status: "confirmed",
      requesterConfirmedAt: daysAgo(1),
      recipientConfirmedAt: null,
      completedAt: null,
      reviews: {},
    },
    {
      requester: userIds.chloe,
      recipient: userIds.henry,
      skillOffered: "Illustration",
      skillWanted: "Node.js",
      scheduledDate: daysAgo(12),
      duration: 90,
      location: "Discord Call",
      notes: "Portfolio review plus backend fundamentals.",
      totalSessions: 2,
      milestones: [
        { title: "Character sketch critique", completed: true, completedAt: daysAgo(13) },
        { title: "Build first Express endpoint", completed: true, completedAt: daysAgo(12) },
      ],
      status: "completed",
      requesterConfirmedAt: daysAgo(12),
      recipientConfirmedAt: daysAgo(12),
      completedAt: daysAgo(12),
      reviews: {
        requesterReview: {
          rating: 5,
          comment: "Henry explained backend concepts clearly.",
          submittedAt: daysAgo(11),
        },
        recipientReview: {
          rating: 5,
          comment: "Great visual feedback and practical design tips.",
          submittedAt: daysAgo(11),
        },
      },
    },
    {
      requester: userIds.farah,
      recipient: userIds.emma,
      skillOffered: "Interview Prep",
      skillWanted: "Machine Learning",
      scheduledDate: daysAgo(4),
      duration: 60,
      location: "Google Meet",
      notes: "Mock interview and model evaluation walkthrough.",
      totalSessions: 2,
      milestones: [
        { title: "Behavioral interview mock", completed: true, completedAt: daysAgo(5) },
        { title: "ML model metrics review", completed: true, completedAt: daysAgo(4) },
      ],
      status: "completed",
      requesterConfirmedAt: daysAgo(4),
      recipientConfirmedAt: daysAgo(4),
      completedAt: daysAgo(4),
      reviews: {
        requesterReview: {
          rating: 4,
          comment: "Very helpful ML explanation.",
          submittedAt: daysAgo(3),
        },
        recipientReview: {
          rating: 5,
          comment: "Great interview coaching with actionable feedback.",
          submittedAt: daysAgo(3),
        },
      },
    },
    {
      requester: userIds.ben,
      recipient: userIds.diego,
      skillOffered: "SQL",
      skillWanted: "Strength Training",
      scheduledDate: daysFromNow(5, 18),
      duration: 60,
      location: "Local Gym + Follow-up Zoom",
      notes: "Need beginner training plan and SQL optimization tips.",
      totalSessions: 2,
      milestones: [
        { title: "SQL query tuning walkthrough", completed: false },
        { title: "Beginner training routine", completed: false },
      ],
      status: "pending",
      requesterConfirmedAt: null,
      recipientConfirmedAt: null,
      completedAt: null,
      reviews: {},
    },
    {
      requester: userIds.grace,
      recipient: userIds.ava,
      skillOffered: "Guitar",
      skillWanted: "UI Design",
      scheduledDate: daysFromNow(9, 17),
      duration: 90,
      location: "Studio Room 3",
      notes: "Song arrangement and design critique exchange.",
      totalSessions: 3,
      milestones: [
        { title: "Chord progression lesson", completed: false },
        { title: "Wireframe feedback", completed: false },
        { title: "Demo showcase", completed: false },
      ],
      status: "cancelled",
      requesterConfirmedAt: null,
      recipientConfirmedAt: null,
      completedAt: null,
      reviews: {},
    },
    {
      requester: userIds.henry,
      recipient: userIds.ava,
      skillOffered: "Node.js",
      skillWanted: "UI Design",
      scheduledDate: daysAgo(20),
      duration: 120,
      location: "Virtual Lab",
      notes: "API architecture and component UX review.",
      totalSessions: 3,
      milestones: [
        { title: "Architecture deep-dive", completed: true, completedAt: daysAgo(22) },
        { title: "Accessibility pass", completed: true, completedAt: daysAgo(21) },
        { title: "Final implementation review", completed: true, completedAt: daysAgo(20) },
      ],
      status: "completed",
      requesterConfirmedAt: daysAgo(20),
      recipientConfirmedAt: daysAgo(20),
      completedAt: daysAgo(20),
      reviews: {
        requesterReview: {
          rating: 5,
          comment: "Ava provided crisp UX improvements.",
          submittedAt: daysAgo(19),
        },
        recipientReview: {
          rating: 4,
          comment: "Solid backend mentorship and clear explanations.",
          submittedAt: daysAgo(19),
        },
      },
    },
    {
      requester: userIds.emma,
      recipient: userIds.farah,
      skillOffered: "Calculus",
      skillWanted: "Interview Prep",
      scheduledDate: daysFromNow(1, 16),
      duration: 60,
      location: "Zoom Room B",
      notes: "Practice technical interview communication.",
      totalSessions: 1,
      milestones: [{ title: "One-hour mock interview", completed: false }],
      status: "pending",
      requesterConfirmedAt: null,
      recipientConfirmedAt: null,
      completedAt: null,
      reviews: {},
    },
    {
      requester: userIds.diego,
      recipient: userIds.chloe,
      skillOffered: "Meal Planning",
      skillWanted: "Branding",
      scheduledDate: daysAgo(7),
      duration: 75,
      location: "Coffee Chat + Miro",
      notes: "Nutrition planning for designers plus personal brand tune-up.",
      totalSessions: 2,
      milestones: [
        { title: "Weekly meal plan template", completed: true, completedAt: daysAgo(8) },
        { title: "Brand tone refinement", completed: true, completedAt: daysAgo(7) },
      ],
      status: "completed",
      requesterConfirmedAt: daysAgo(7),
      recipientConfirmedAt: daysAgo(7),
      completedAt: daysAgo(7),
      reviews: {
        requesterReview: {
          rating: 4,
          comment: "Branding advice was practical and immediate.",
          submittedAt: daysAgo(6),
        },
        recipientReview: {
          rating: 5,
          comment: "Diego's meal structure was easy to follow.",
          submittedAt: daysAgo(6),
        },
      },
    },
  ];
}

function buildStressSwapSeeds(userIds, userLookup) {
  const keys = Object.keys(userIds);
  const statusCycle = ["pending", "confirmed", "completed", "cancelled"];
  const locations = [
    "Zoom",
    "Google Meet",
    "Discord",
    "Library Study Room",
    "Community Center",
  ];

  const swaps = [];
  for (let index = 0; index < 24; index += 1) {
    const requesterKey = keys[index % keys.length];
    const recipientKey = keys[(index + 3) % keys.length];
    const requesterProfile = userLookup[requesterKey];
    const offeredSkills = requesterProfile.skills || [];
    const wantedSkills = requesterProfile.skillsWanted || [];
    const fallbackOffered = { skillName: "General Coaching" };
    const fallbackWanted = { skillName: "Career Advice" };
    const offeredSkill =
      offeredSkills.length > 0
        ? offeredSkills[index % offeredSkills.length]
        : fallbackOffered;
    const wantedSkill =
      wantedSkills.length > 0
        ? wantedSkills[index % wantedSkills.length]
        : fallbackWanted;
    const status = statusCycle[index % statusCycle.length];
    const totalSessions = (index % 3) + 1;

    const milestones = Array.from({ length: totalSessions }, (_, milestoneIndex) => {
      const shouldComplete =
        status === "completed" || (status === "confirmed" && milestoneIndex < totalSessions - 1);

      return {
        title: `Stress milestone ${index + 1}.${milestoneIndex + 1}`,
        completed: shouldComplete,
        completedAt: shouldComplete ? daysAgo((index % 9) + 1) : null,
      };
    });

    const requesterConfirmedAt = status === "completed" ? daysAgo((index % 8) + 1) : null;
    const recipientConfirmedAt = status === "completed" ? daysAgo((index % 8) + 1) : null;

    swaps.push({
      requester: userIds[requesterKey],
      recipient: userIds[recipientKey],
      skillOffered: offeredSkill.skillName,
      skillWanted: wantedSkill.skillName,
      scheduledDate:
        status === "completed" || status === "cancelled"
          ? daysAgo((index % 14) + 3)
          : daysFromNow((index % 16) + 2, 17 + (index % 3)),
      duration: 45 + ((index % 3) * 30),
      location: locations[index % locations.length],
      notes: `Stress dataset swap #${index + 1}`,
      totalSessions,
      milestones,
      status,
      requesterConfirmedAt,
      recipientConfirmedAt,
      completedAt: status === "completed" ? daysAgo((index % 8) + 1) : null,
      reviews:
        status === "completed"
          ? {
              requesterReview: {
                rating: ((index + 3) % 5) + 1,
                comment: `Requester review for stress swap ${index + 1}`,
                submittedAt: daysAgo((index % 7) + 1),
              },
              recipientReview: {
                rating: ((index + 4) % 5) + 1,
                comment: `Recipient review for stress swap ${index + 1}`,
                submittedAt: daysAgo((index % 7) + 1),
              },
            }
          : {},
    });
  }

  return swaps;
}

function buildMessages(userIds) {
  const now = new Date();
  return [
    {
      sender: userIds.ava,
      recipient: userIds.ben,
      text: "Hey Ben, want to confirm our React/Spanish session agenda?",
      createdAt: withOffset(now, -4200),
      readAt: withOffset(now, -4150),
    },
    {
      sender: userIds.ben,
      recipient: userIds.ava,
      text: "Yes! I can start with conversation warm-ups then move to SQL questions.",
      createdAt: withOffset(now, -4170),
      readAt: withOffset(now, -4100),
    },
    {
      sender: userIds.ava,
      recipient: userIds.ben,
      text: "Perfect, I'll bring a mini React challenge too.",
      createdAt: withOffset(now, -4140),
      readAt: withOffset(now, -4050),
    },
    {
      sender: userIds.farah,
      recipient: userIds.ava,
      text: "Would you be open to a product strategy swap next week?",
      createdAt: withOffset(now, -3600),
      readAt: null,
    },
    {
      sender: userIds.ava,
      recipient: userIds.henry,
      text: "Thanks again for the architecture session last month.",
      createdAt: withOffset(now, -10080),
      readAt: withOffset(now, -10020),
    },
    {
      sender: userIds.henry,
      recipient: userIds.ava,
      text: "Anytime. Your accessibility notes improved my API docs flow.",
      createdAt: withOffset(now, -10020),
      readAt: withOffset(now, -9980),
    },
    {
      sender: userIds.chloe,
      recipient: userIds.henry,
      text: "I pushed new wireframes for the endpoint explorer.",
      createdAt: withOffset(now, -7200),
      readAt: withOffset(now, -7150),
    },
    {
      sender: userIds.henry,
      recipient: userIds.chloe,
      text: "Looks great. I'll pair that with example API payloads.",
      createdAt: withOffset(now, -7140),
      readAt: withOffset(now, -7100),
    },
    {
      sender: userIds.diego,
      recipient: userIds.ben,
      text: "Can we move our training session to 6:45 PM?",
      createdAt: withOffset(now, -900),
      readAt: null,
    },
    {
      sender: userIds.ben,
      recipient: userIds.diego,
      text: "That works for me. I'll bring my laptop for SQL examples.",
      createdAt: withOffset(now, -860),
      readAt: null,
    },
    {
      sender: userIds.emma,
      recipient: userIds.farah,
      text: "Excited for the interview prep swap tomorrow.",
      createdAt: withOffset(now, -240),
      readAt: null,
    },
    {
      sender: userIds.grace,
      recipient: userIds.ava,
      text: "No worries about cancelling. Let's reschedule later.",
      createdAt: withOffset(now, -4000),
      readAt: withOffset(now, -3980),
    },
    {
      sender: userIds.ava,
      recipient: userIds.grace,
      text: "Thanks for understanding. I'll send alternate slots.",
      createdAt: withOffset(now, -3970),
      readAt: withOffset(now, -3950),
    },
  ];
}

function buildStressMessages(userIds) {
  const keys = Object.keys(userIds);
  const now = new Date();
  const messages = [];

  for (let pairIndex = 0; pairIndex < keys.length; pairIndex += 1) {
    const senderKey = keys[pairIndex];
    const recipientKey = keys[(pairIndex + 2) % keys.length];

    for (let messageIndex = 0; messageIndex < 10; messageIndex += 1) {
      const isEven = messageIndex % 2 === 0;
      const sender = isEven ? userIds[senderKey] : userIds[recipientKey];
      const recipient = isEven ? userIds[recipientKey] : userIds[senderKey];
      const createdAt = withOffset(now, -((pairIndex * 350) + (messageIndex * 11) + 500));

      messages.push({
        sender,
        recipient,
        text: `Stress message ${pairIndex + 1}.${messageIndex + 1} between ${senderKey} and ${recipientKey}`,
        createdAt,
        readAt: messageIndex >= 8 ? null : withOffset(createdAt, 6),
      });
    }
  }

  return messages;
}

function buildEdgeSwapSeeds(userIds) {
  if (!userIds.ivy || !userIds.noah) {
    return [];
  }

  return [
    {
      requester: userIds.ivy,
      recipient: userIds.noah,
      skillOffered: "Timeboxing",
      skillWanted: "Node.js",
      scheduledDate: daysFromNow(3, 23),
      duration: 15,
      location: "",
      notes: "Edge case: short swap with minimal profile fields.",
      totalSessions: 1,
      milestones: [{ title: "Micro-session goal", completed: false }],
      status: "pending",
      requesterConfirmedAt: null,
      recipientConfirmedAt: null,
      completedAt: null,
      reviews: {},
    },
    {
      requester: userIds.noah,
      recipient: userIds.ava,
      skillOffered: "Timeboxing",
      skillWanted: "React",
      scheduledDate: daysAgo(2),
      duration: 30,
      location: "Audio only",
      notes: "Edge case: completed with only one submitted review.",
      totalSessions: 1,
      milestones: [{ title: "Rapid coaching", completed: true, completedAt: daysAgo(2) }],
      status: "completed",
      requesterConfirmedAt: daysAgo(2),
      recipientConfirmedAt: daysAgo(2),
      completedAt: daysAgo(2),
      reviews: {
        requesterReview: {
          rating: 3,
          comment: "Short but useful.",
          submittedAt: daysAgo(1),
        },
      },
    },
  ];
}

function buildEdgeMessages(userIds) {
  if (!userIds.ivy || !userIds.noah) {
    return [];
  }

  const now = new Date();
  return [
    {
      sender: userIds.ivy,
      recipient: userIds.noah,
      text: "I only have 15 minutes, can we keep this very focused?",
      createdAt: withOffset(now, -120),
      readAt: null,
    },
    {
      sender: userIds.noah,
      recipient: userIds.ivy,
      text: "Absolutely, let's do one concrete objective.",
      createdAt: withOffset(now, -115),
      readAt: null,
    },
  ];
}

async function connectToDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
}

async function purgeExistingSampleData(activeUsers) {
  const sampleEmails = activeUsers.map((user) => user.email);
  const existingUsers = await User.find({ email: { $in: sampleEmails } }).select("_id");
  const existingIds = existingUsers.map((user) => user._id);

  if (existingIds.length > 0) {
    await Promise.all([
      Message.deleteMany({
        $or: [{ sender: { $in: existingIds } }, { recipient: { $in: existingIds } }],
      }),
      Swap.deleteMany({
        $or: [{ requester: { $in: existingIds } }, { recipient: { $in: existingIds } }],
      }),
      PasswordResetToken.deleteMany({ userId: { $in: existingIds } }),
      User.deleteMany({ _id: { $in: existingIds } }),
    ]);
  }
}

async function createUsers(activeUsers) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const createdUsers = [];

  for (const userData of activeUsers) {
    const created = await User.create({
      name: userData.name,
      username: userData.username,
      email: userData.email,
      passwordHash,
      city: userData.city,
      phoneNumber: userData.phoneNumber,
      timeZone: userData.timeZone,
      bio: userData.bio,
      availability: userData.availability,
      skills: userData.skills,
      skillsWanted: userData.skillsWanted,
      locationVisibility: userData.locationVisibility,
      showOthersLocations: userData.showOthersLocations,
      notificationPreferences: userData.notificationPreferences,
    });

    createdUsers.push({ ...userData, _id: created._id });
  }

  return createdUsers;
}

async function updateBlockedRelationships(userIds) {
  // Emma blocks Diego; Ben blocks Grace.
  const updates = [
    User.findByIdAndUpdate(userIds.emma, { $set: { blockedUsers: [userIds.diego] } }),
    User.findByIdAndUpdate(userIds.ben, { $set: { blockedUsers: [userIds.grace] } }),
  ];

  if (userIds.ivy && userIds.ava) {
    updates.push(
      User.findByIdAndUpdate(userIds.ivy, { $set: { blockedUsers: [userIds.ava] } })
    );
  }

  await Promise.all(updates);
}

async function createSwaps(userIds, userLookup) {
  let swaps = [...buildSwapSeeds(userIds)];
  if (STRESS_MODE) {
    swaps = swaps.concat(buildStressSwapSeeds(userIds, userLookup));
  }
  if (EDGE_MODE) {
    swaps = swaps.concat(buildEdgeSwapSeeds(userIds));
  }
  await Swap.insertMany(swaps);
}

async function createMessages(userIds) {
  let messages = [...buildMessages(userIds)];
  if (STRESS_MODE) {
    messages = messages.concat(buildStressMessages(userIds));
  }
  if (EDGE_MODE) {
    messages = messages.concat(buildEdgeMessages(userIds));
  }
  await Message.insertMany(messages);
}

function mapUserIds(createdUsers) {
  return createdUsers.reduce((acc, user) => {
    acc[user.key] = user._id;
    return acc;
  }, {});
}

function printCredentials(activeUsers) {
  const modeLabel = [
    STRESS_MODE ? "stress" : null,
    EDGE_MODE ? "edge" : null,
  ]
    .filter(Boolean)
    .join("+") || "standard";

  console.log(`\nSeed complete (${modeLabel} mode). Login credentials:`);
  activeUsers.forEach((user) => {
    console.log(`- ${user.name} (${user.username}) -> ${user.email} / ${DEFAULT_PASSWORD}`);
  });
}

async function run() {
  try {
    const activeUsers = getActiveUsers();
    const userLookup = buildUserLookup(activeUsers);

    await connectToDatabase();
    await purgeExistingSampleData(activeUsers);

    const createdUsers = await createUsers(activeUsers);
    const userIds = mapUserIds(createdUsers);

    await updateBlockedRelationships(userIds);
    await createSwaps(userIds, userLookup);
    await createMessages(userIds);

    const [userCount, swapCount, messageCount] = await Promise.all([
      User.countDocuments({ email: { $in: activeUsers.map((user) => user.email) } }),
      Swap.countDocuments({
        $or: [
          { requester: { $in: Object.values(userIds) } },
          { recipient: { $in: Object.values(userIds) } },
        ],
      }),
      Message.countDocuments({
        $or: [
          { sender: { $in: Object.values(userIds) } },
          { recipient: { $in: Object.values(userIds) } },
        ],
      }),
    ]);

    console.log("\nSample dataset created:");
    console.log(`- Users: ${userCount}`);
    console.log(`- Swaps: ${swapCount}`);
    console.log(`- Messages: ${messageCount}`);
    printCredentials(activeUsers);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();
