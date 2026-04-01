const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const Message = require("../models/Message");
const User = require("../models/User");

const router = express.Router();
const DEFAULT_THREAD_PAGE_LIMIT = 30;
const MAX_THREAD_PAGE_LIMIT = 100;

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

async function hasBlockedRelationship(currentUserId, otherUserId) {
  const [currentUser, otherUser] = await Promise.all([
    User.findById(currentUserId).select("blockedUsers"),
    User.findById(otherUserId).select("blockedUsers"),
  ]);

  if (!currentUser || !otherUser) {
    return false;
  }

  const currentUserBlocked = new Set(
    (currentUser.blockedUsers || []).map((id) => String(id))
  );
  const otherUserBlocked = new Set(
    (otherUser.blockedUsers || []).map((id) => String(id))
  );

  return (
    currentUserBlocked.has(otherUserId) ||
    otherUserBlocked.has(currentUserId)
  );
}

function normalizeThreadPageLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_THREAD_PAGE_LIMIT;
  }
  return Math.min(parsed, MAX_THREAD_PAGE_LIMIT);
}

// GET /api/messages/conversations - list latest DM threads for current user
router.get("/conversations", auth, async (req, res) => {
  try {
    const currentUserId = String(req.userId);

    const [currentUser, usersWhoBlockedCurrent] = await Promise.all([
      User.findById(currentUserId).select("blockedUsers"),
      User.find({ blockedUsers: currentUserId }).select("_id"),
    ]);

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const blockedUserIds = new Set([
      ...(currentUser.blockedUsers || []).map((id) => String(id)),
      ...usersWhoBlockedCurrent.map((user) => String(user._id)),
    ]);

    const messages = await Message.find({
      $or: [{ sender: currentUserId }, { recipient: currentUserId }],
    })
      .populate("sender", "name username")
      .populate("recipient", "name username")
      .sort({ createdAt: -1 });

    const unreadCounts = new Map();
    messages.forEach((message) => {
      const otherUserId = getOtherUserId(message, currentUserId);
      if (blockedUserIds.has(otherUserId)) {
        return;
      }

      if (
        String(message.recipient?._id || message.recipient) === currentUserId &&
        !message.readAt
      ) {
        unreadCounts.set(otherUserId, (unreadCounts.get(otherUserId) || 0) + 1);
      }
    });

    const conversationsMap = new Map();
    messages.forEach((message) => {
      const otherUserId = getOtherUserId(message, currentUserId);
      if (blockedUserIds.has(otherUserId)) {
        return;
      }

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
router.get("/:userId/history", auth, async (req, res) => {
  try {
    const currentUserId = String(req.userId);
    const { userId } = req.params;
    const { beforeMessageId } = req.query;
    const limit = normalizeThreadPageLimit(req.query.limit);

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ message: "Cannot open a chat with yourself" });
    }

    if (beforeMessageId && !isValidObjectId(beforeMessageId)) {
      return res.status(400).json({ message: "Invalid beforeMessageId" });
    }

    const otherUser = await User.findById(userId).select("_id");
    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const isBlocked = await hasBlockedRelationship(currentUserId, userId);
    if (isBlocked) {
      return res.status(403).json({ message: "Cannot chat with a blocked user" });
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

    const filter = {
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId },
      ],
    };

    if (beforeMessageId) {
      filter._id = { $lt: beforeMessageId };
    }

    const results = await Message.find(filter)
      .populate("sender", "name username")
      .populate("recipient", "name username")
      .sort({ _id: -1 })
      .limit(limit + 1);

    const hasMoreOlder = results.length > limit;
    const page = hasMoreOlder ? results.slice(0, limit) : results;
    const messages = page.reverse();

    return res.json({
      messages,
      hasMoreOlder,
    });
  } catch (error) {
    console.error("Error fetching paginated message thread:", error);
    return res.status(500).json({ message: "Error fetching messages" });
  }
});

// GET /api/messages/:userId - fetch full thread between current user and :userId
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

    const isBlocked = await hasBlockedRelationship(currentUserId, userId);
    if (isBlocked) {
      return res.status(403).json({ message: "Cannot chat with a blocked user" });
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

    const isBlocked = await hasBlockedRelationship(currentUserId, userId);
    if (isBlocked) {
      return res.status(403).json({ message: "Cannot chat with a blocked user" });
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
