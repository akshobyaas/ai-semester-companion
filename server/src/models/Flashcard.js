const mongoose = require("mongoose");

/**
 * IMPORTANT PROVENANCE NOTE (found during Phase 3, not Phase 0):
 * Flashcards do not exist anywhere in the canonical `app/` backend that the
 * Phase 0 API contract was built from. The only implementation is in the
 * LEGACY `backend/database/models.py` + `backend/routes/revision.py`
 * (SQLAlchemy, integer PKs, SM-2 spaced repetition). The frontend
 * (`course/[id]/flashcards/page.tsx`) clearly expects this feature though.
 *
 * This schema ports the legacy SM-2 fields exactly. When flashcard routes
 * are built (a later phase, not yet numbered in the original plan), they
 * should port `backend/routes/revision.py`'s flashcard endpoints and
 * `backend/agents/orchestrator.py`'s generate_flashcards, NOT anything
 * from app/ — there is nothing to port from there.
 */
const flashcardSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    topic: { type: String, default: null },
    difficulty: { type: String, default: "medium" }, // legacy used a free string, not an enum
    reviewInterval: { type: Number, default: 1 }, // days
    nextReview: { type: Date, default: null },
    easeFactor: { type: Number, default: 2.5 },
    repetitions: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// GET /revision/flashcards/{course_id}?due_only=true filters + sorts on this
flashcardSchema.index({ courseId: 1, nextReview: 1 });

module.exports = mongoose.model("Flashcard", flashcardSchema);
