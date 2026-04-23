const mongoose = require("mongoose");
const dotenv = require("dotenv");

const User = require("../models/User");
const Swap = require("../models/Swap");
const Message = require("../models/Message");
const PasswordResetToken = require("../models/PasswordResetToken");
const EmailDailyUsage = require("../models/EmailDailyUsage");

dotenv.config();

const FORCE = process.argv.includes("--force");

// Run connect to database logic.
async function connectToDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
}

// Run run logic.
async function run() {
  try {
    if (!FORCE) {
      console.error(
        "Refusing to clear data without --force. Run: node scripts/clearLocalData.js --force"
      );
      process.exitCode = 1;
      return;
    }

    await connectToDatabase();

    const [usersDeleted, swapsDeleted, messagesDeleted, resetTokensDeleted, emailUsageDeleted] = await Promise.all([
      User.deleteMany({}),
      Swap.deleteMany({}),
      Message.deleteMany({}),
      PasswordResetToken.deleteMany({}),
      EmailDailyUsage.deleteMany({}),
    ]);

    console.log("\nLocal database cleared.");
    console.log(`- Users removed: ${usersDeleted.deletedCount}`);
    console.log(`- Swaps removed: ${swapsDeleted.deletedCount}`);
    console.log(`- Messages removed: ${messagesDeleted.deletedCount}`);
    console.log(`- Password reset tokens removed: ${resetTokensDeleted.deletedCount}`);
    console.log(`- Email daily usage rows removed: ${emailUsageDeleted.deletedCount}`);
  } catch (error) {
    console.error("Failed to clear local data:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();
