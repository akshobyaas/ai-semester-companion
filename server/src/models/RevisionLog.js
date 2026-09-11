const mongoose = require("mongoose");

/**
 * NEW IN PHASE 18 (by explicit request): ports legacy
 * backend/database/models.py's RevisionLog — cheat sheets / quick notes /
 * formula sheets / exam summaries, separate from Flashcard (Phase 17).
 */
const revisionLogSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    topic: { type: String, required: true },
    revisionType: {
      type: String,
      enum: ["cheat_sheet", "formula_sheet", "quick_notes", "exam_summary"],
      default: "cheat_sheet",
    },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model("RevisionLog", revisionLogSchema);
