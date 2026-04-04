const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { sendProfileCompletionReminders } = require("../services/profileReminders");

dotenv.config();

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to send profile completion reminders.");
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const summary = await sendProfileCompletionReminders({});
    console.log("Profile reminder job summary:", summary);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error("Profile reminder job failed:", error);
  process.exit(1);
});
