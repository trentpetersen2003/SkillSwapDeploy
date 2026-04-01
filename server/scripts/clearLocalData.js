const mongoose = require("mongoose");
const dotenv = require("dotenv");

const User = require("../models/User");
const Swap = require("../models/Swap");
const Message = require("../models/Message");
const PasswordResetToken = require("../models/PasswordResetToken");

dotenv.config();

const FORCE = process.argv.includes("--force");

async function connectToDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
}

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

    const [usersDeleted, swapsDeleted, messagesDeleted, resetTokensDeleted] = await Promise.all([
      User.deleteMany({}),
      Swap.deleteMany({}),
      Message.deleteMany({}),
      PasswordResetToken.deleteMany({}),
    ]);

    console.log("\nLocal database cleared.");
    console.log(`- Users removed: ${usersDeleted.deletedCount}`);
    console.log(`- Swaps removed: ${swapsDeleted.deletedCount}`);
    console.log(`- Messages removed: ${messagesDeleted.deletedCount}`);
    console.log(`- Password reset tokens removed: ${resetTokensDeleted.deletedCount}`);
  } catch (error) {
    console.error("Failed to clear local data:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();
