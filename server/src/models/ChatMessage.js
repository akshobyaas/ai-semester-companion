const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      default: null, // Python: nullable=True
    },
    // Set on every message so course-level chats (no topic) keep separate
    // history per course. Messages saved before this field existed are null.
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    contextUsed: { type: mongoose.Schema.Types.Mixed, default: null }, // retrieved sources
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// POST /adaptive/doubt pulls "last 10 messages for user+topic, ordered by
// created_at desc then reversed" — this compound index supports that scan.
chatMessageSchema.index({ userId: 1, topicId: 1, createdAt: -1 });
chatMessageSchema.index({ userId: 1, courseId: 1, topicId: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
