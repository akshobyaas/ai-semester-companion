const mongoose = require("mongoose");

const TopicStatus = ["not_started", "in_progress", "completed", "revision"];

const userProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
    },
    status: { type: String, enum: TopicStatus, default: "not_started" },
    score: { type: Number, default: 0.0 },
    timeSpentMinutes: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    lastAccessed: { type: Date, default: Date.now },
    notes: { type: String, default: null },
    weakAreas: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

// Every route that reads/writes progress does so via (userId, topicId) —
// this compound unique index is what makes the "upsert" pattern in
// _update_progress (Phase 10/learning routes) safe from race conditions.
userProgressSchema.index({ userId: 1, topicId: 1 }, { unique: true });

module.exports = {
  UserProgress: mongoose.model("UserProgress", userProgressSchema),
  TopicStatus,
};
