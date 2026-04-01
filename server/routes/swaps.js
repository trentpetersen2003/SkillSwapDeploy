// server/routes/swaps.js
const express = require("express");
const router = express.Router();
const Swap = require("../models/Swap");
const User = require("../models/User");
const auth = require("../middleware/auth");

function isParticipant(swap, userId) {
  return swap.requester.toString() === userId || swap.recipient.toString() === userId;
}

function isRequester(swap, userId) {
  return swap.requester.toString() === userId;
}

function hasBothConfirmations(swap) {
  return Boolean(swap.requesterConfirmedAt && swap.recipientConfirmedAt);
}

function normalizeMilestones(rawMilestones = [], totalSessions = 1) {
  const sessionCount = Number(totalSessions);
  if (!Number.isInteger(sessionCount) || sessionCount < 1 || sessionCount > 20) {
    return { error: "totalSessions must be an integer between 1 and 20" };
  }

  if (!Array.isArray(rawMilestones)) {
    return { error: "milestones must be an array" };
  }

  if (rawMilestones.length === 0) {
    const defaultMilestones = Array.from({ length: sessionCount }, (_, index) => ({
      title: `Session ${index + 1} goal`,
      dueDate: undefined,
      completed: false,
      completedAt: null,
    }));

    return { milestones: defaultMilestones, totalSessions: sessionCount };
  }

  if (rawMilestones.length !== sessionCount) {
    return { error: "milestones count must match totalSessions" };
  }

  const normalized = rawMilestones.map((milestone, index) => {
    const title = typeof milestone?.title === "string" ? milestone.title.trim() : "";
    if (!title) {
      return { error: `Milestone ${index + 1} must include a title` };
    }

    let dueDate = undefined;
    if (milestone?.dueDate) {
      const parsedDate = new Date(milestone.dueDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return { error: `Milestone ${index + 1} has an invalid dueDate` };
      }
      dueDate = parsedDate;
    }

    return {
      title,
      dueDate,
      completed: false,
      completedAt: null,
    };
  });

  const firstError = normalized.find((entry) => entry.error);
  if (firstError) {
    return { error: firstError.error };
  }

  return { milestones: normalized, totalSessions: sessionCount };
}

// Get all swaps for the authenticated user
router.get("/", auth, async (req, res) => {
  try {
    const swaps = await Swap.find({
      $or: [{ requester: req.userId }, { recipient: req.userId }],
    })
      .populate("requester", "name email username")
      .populate("recipient", "name email username")
      .sort({ scheduledDate: 1 });

    res.json(swaps);
  } catch (error) {
    console.error("Error fetching swaps:", error);
    res.status(500).json({ message: "Error fetching swaps" });
  }
});

// Get swaps for a specific date range
router.get("/range", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start and end dates are required" });
    }

    const swaps = await Swap.find({
      $or: [{ requester: req.userId }, { recipient: req.userId }],
      scheduledDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
      .populate("requester", "name email username")
      .populate("recipient", "name email username")
      .sort({ scheduledDate: 1 });

    res.json(swaps);
  } catch (error) {
    console.error("Error fetching swaps by range:", error);
    res.status(500).json({ message: "Error fetching swaps" });
  }
});

// Create a new swap
router.post("/", auth, async (req, res) => {
  try {
    const {
      recipientId,
      skillOffered,
      skillWanted,
      scheduledDate,
      duration,
      location,
      notes,
      totalSessions,
      milestones,
    } = req.body;

    if (!recipientId || !skillOffered || !skillWanted || !scheduledDate) {
      return res.status(400).json({
        message: "Recipient, skills offered/wanted, and scheduled date are required",
      });
    }

    const normalizedMilestones = normalizeMilestones(milestones, totalSessions || 1);
    if (normalizedMilestones.error) {
      return res.status(400).json({ message: normalizedMilestones.error });
    }

    // Don't allow swapping with yourself
    if (recipientId === req.userId) {
      return res.status(400).json({ message: "Cannot create a swap with yourself" });
    }

    const [requester, recipient] = await Promise.all([
      User.findById(req.userId).select("blockedUsers"),
      User.findById(recipientId).select("blockedUsers"),
    ]);

    if (!requester || !recipient) {
      return res.status(404).json({ message: "User not found" });
    }

    const requesterBlockedRecipient = (requester.blockedUsers || []).some(
      (id) => id.toString() === recipientId
    );
    const recipientBlockedRequester = (recipient.blockedUsers || []).some(
      (id) => id.toString() === req.userId
    );

    if (requesterBlockedRecipient || recipientBlockedRequester) {
      return res.status(403).json({ message: "Cannot create swap with a blocked user" });
    }

    const newSwap = new Swap({
      requester: req.userId,
      recipient: recipientId,
      skillOffered,
      skillWanted,
      scheduledDate: new Date(scheduledDate),
      duration: duration || 60,
      location,
      notes,
      totalSessions: normalizedMilestones.totalSessions,
      milestones: normalizedMilestones.milestones,
      status: "pending",
    });

    await newSwap.save();

    const populatedSwap = await Swap.findById(newSwap._id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    res.status(201).json(populatedSwap);
  } catch (error) {
    console.error("Error creating swap:", error);
    res.status(500).json({ message: "Error creating swap" });
  }
});

// Update swap status
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const swap = await Swap.findById(id);

    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    // Only the recipient can confirm, or either party can cancel
    if (
      status === "confirmed" &&
      swap.recipient.toString() !== req.userId
    ) {
      return res.status(403).json({ message: "Only recipient can confirm" });
    }

    if (["cancelled", "completed"].includes(status) && !isParticipant(swap, req.userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (status === "completed") {
      const hasIncompleteMilestones = (swap.milestones || []).some(
        (milestone) => !milestone.completed
      );

      if (hasIncompleteMilestones) {
        return res.status(400).json({
          message: "Complete all milestones before marking this swap completed",
        });
      }

      if (!hasBothConfirmations(swap)) {
        return res.status(400).json({
          message: "Both participants must confirm the session before completion",
        });
      }

      if (!swap.completedAt) {
        swap.completedAt = new Date();
      }
    }

    if (status !== "completed") {
      swap.completedAt = null;
    }

    swap.status = status;
    await swap.save();

    const updatedSwap = await Swap.findById(id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    res.json(updatedSwap);
  } catch (error) {
    console.error("Error updating swap status:", error);
    res.status(500).json({ message: "Error updating swap" });
  }
});

// Confirm a completed live session. When both users confirm, swap auto-completes.
router.patch("/:id/confirm-session", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const swap = await Swap.findById(id);

    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    if (!isParticipant(swap, req.userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (swap.status !== "confirmed") {
      return res.status(400).json({
        message: "Only active confirmed swaps can be session-confirmed",
      });
    }

    const hasIncompleteMilestones = (swap.milestones || []).some(
      (milestone) => !milestone.completed
    );

    if (hasIncompleteMilestones) {
      return res.status(400).json({
        message: "Complete all milestones before confirming the session",
      });
    }

    if (isRequester(swap, req.userId)) {
      swap.requesterConfirmedAt = swap.requesterConfirmedAt || new Date();
    } else {
      swap.recipientConfirmedAt = swap.recipientConfirmedAt || new Date();
    }

    if (hasBothConfirmations(swap)) {
      swap.status = "completed";
      swap.completedAt = swap.completedAt || new Date();
    }

    await swap.save();

    const updatedSwap = await Swap.findById(id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    res.json(updatedSwap);
  } catch (error) {
    console.error("Error confirming session:", error);
    res.status(500).json({ message: "Error confirming session" });
  }
});

// Submit a post-session rating for the other participant.
router.patch("/:id/review", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be an integer from 1 to 5" });
    }

    const cleanComment = typeof comment === "string" ? comment.trim() : "";

    const swap = await Swap.findById(id);
    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    if (!isParticipant(swap, req.userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (swap.status !== "completed") {
      return res.status(400).json({ message: "You can only review completed swaps" });
    }

    if (!swap.reviews) {
      swap.reviews = {};
    }

    const reviewField = isRequester(swap, req.userId)
      ? "requesterReview"
      : "recipientReview";

    if (swap.reviews[reviewField]) {
      return res.status(409).json({ message: "You have already submitted a review" });
    }

    swap.reviews[reviewField] = {
      rating: numericRating,
      comment: cleanComment,
      submittedAt: new Date(),
    };

    await swap.save();

    const updatedSwap = await Swap.findById(id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    res.json(updatedSwap);
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ message: "Error submitting review" });
  }
});

// Mark a milestone as completed for an active swap
router.patch("/:id/milestones/:milestoneId/complete", auth, async (req, res) => {
  try {
    const { id, milestoneId } = req.params;

    const swap = await Swap.findById(id);
    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    const isParticipant =
      swap.requester.toString() === req.userId || swap.recipient.toString() === req.userId;

    if (!isParticipant) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (swap.status === "cancelled" || swap.status === "completed") {
      return res
        .status(400)
        .json({ message: "Cannot update milestones for closed swaps" });
    }

    const milestone = (swap.milestones || []).id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    if (!milestone.completed) {
      milestone.completed = true;
      milestone.completedAt = new Date();
      await swap.save();
    }

    const updatedSwap = await Swap.findById(id)
      .populate("requester", "name email username")
      .populate("recipient", "name email username");

    res.json(updatedSwap);
  } catch (error) {
    console.error("Error completing milestone:", error);
    res.status(500).json({ message: "Error updating milestone" });
  }
});

// Delete a swap
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const swap = await Swap.findById(id);

    if (!swap) {
      return res.status(404).json({ message: "Swap not found" });
    }

    // Only the requester can delete
    if (swap.requester.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the requester can delete this swap" });
    }

    await Swap.findByIdAndDelete(id);

    res.json({ message: "Swap deleted successfully" });
  } catch (error) {
    console.error("Error deleting swap:", error);
    res.status(500).json({ message: "Error deleting swap" });
  }
});

module.exports = router;