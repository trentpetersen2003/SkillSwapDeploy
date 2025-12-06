// server/routes/swaps.js
const express = require("express");
const router = express.Router();
const Swap = require("../models/Swap");
const auth = require("../middleware/auth");

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
    } = req.body;

    if (!recipientId || !skillOffered || !skillWanted || !scheduledDate) {
      return res.status(400).json({
        message: "Recipient, skills offered/wanted, and scheduled date are required",
      });
    }

    // Don't allow swapping with yourself
    if (recipientId === req.userId) {
      return res.status(400).json({ message: "Cannot create a swap with yourself" });
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

    if (
      ["cancelled", "completed"].includes(status) &&
      swap.requester.toString() !== req.userId &&
      swap.recipient.toString() !== req.userId
    ) {
      return res.status(403).json({ message: "Unauthorized" });
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