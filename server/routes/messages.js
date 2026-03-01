const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const Message = require("../models/Message");
const User = require("../models/User");

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getOtherUserId(message, currentUserId) {
  return String(message.sender?._id || message.sender) === currentUserId
    ? String(message.recipient?._id || message.recipient)
    : String(message.sender?._id || message.sender);
}

function getOtherUser(message, currentUserId) {
  return String(message.sender?._id || message.sender) === currentUserId
    ? message.recipient
    : message.sender;
}

// GET /api/messages/conversations - list latest DM threads for current user
router.get("/conversations", auth, async (req, res) => {
  try {
    const currentUserId = String(req.userId);

    const messages = await Message.find({
      $or: [{ sender: currentUserId }, { recipient: currentUserId }],
    })
      .populate("sender", "name username")
      .populate("recipient", "name username")
      .sort({ createdAt: -1 });

    const unreadCounts = new Map();
    messages.forEach((message) => {
      if (
        String(message.recipient?._id || message.recipient) === currentUserId &&
        !message.readAt
      ) {
        const otherUserId = getOtherUserId(message, currentUserId);
        unreadCounts.set(otherUserId, (unreadCounts.get(otherUserId) || 0) + 1);
      }
    });

    const conversationsMap = new Map();
    messages.forEach((message) => {
      const otherUserId = getOtherUserId(message, currentUserId);
      if (conversationsMap.has(otherUserId)) {
        return;
      }

      const otherUser = getOtherUser(message, currentUserId);
      conversationsMap.set(otherUserId, {
        user: otherUser,
        lastMessage: {
          _id: message._id,
          text: message.text,
          sender: message.sender,
          recipient: message.recipient,
          createdAt: message.createdAt,
          readAt: message.readAt,
        },
        unreadCount: unreadCounts.get(otherUserId) || 0,
      });
    });

    return res.json(Array.from(conversationsMap.values()));
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return res.status(500).json({ message: "Error fetching conversations" });
  }
});

// GET /api/messages/:userId - fetch thread between current user and :userId
router.get("/:userId", auth, async (req, res) => {
  try {
    const currentUserId = String(req.userId);
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ message: "Cannot open a chat with yourself" });
    }

    const otherUser = await User.findById(userId).select("_id");
    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await Message.updateMany(
      {
        sender: userId,
        recipient: currentUserId,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    const thread = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId },
      ],
    })
      .populate("sender", "name username")
      .populate("recipient", "name username")
      .sort({ createdAt: 1 });

    return res.json(thread);
  } catch (error) {
    console.error("Error fetching message thread:", error);
    return res.status(500).json({ message: "Error fetching messages" });
  }
});

// POST /api/messages/:userId - send DM to :userId
router.post("/:userId", auth, async (req, res) => {
  try {
    const currentUserId = String(req.userId);
    const { userId } = req.params;
    const { text } = req.body;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ message: "Cannot send a message to yourself" });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const recipient = await User.findById(userId).select("_id");
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const message = await Message.create({
      sender: currentUserId,
      recipient: userId,
      text: text.trim(),
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name username")
      .populate("recipient", "name username");

    return res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    return res.status(500).json({ message: "Error sending message" });
  }
});

module.exports = router;
