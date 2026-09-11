const mongoose = require("mongoose");

const DifficultyLevel = ["beginner", "intermediate", "advanced"];

/**
 * Ported as-is from the Python model even though no route read so far
 * (Phase 0) actually writes to it — /adaptive/recommend computes its stats
 * fresh from QuizAttempt + UserProgress every call rather than reading this.
 * Keeping the schema in case agents/runtime.py (Phase 8) or adaptive_agent.py
 * (Phase 13) turns out to persist it as a cache. Flagged, not dropped.
 */
const learningStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    currentTopicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", default: null },
    currentDifficulty: { type: String, enum: DifficultyLevel, default: "beginner" },
    overallScore: { type: Number, default: 0.0 },
    topicsCompleted: { type: Number, default: 0 },
    topicsTotal: { type: Number, default: 0 },
    weakTopics: { type: mongoose.Schema.Types.Mixed, default: [] },
    strongTopics: { type: mongoose.Schema.Types.Mixed, default: [] },
    recommendedNext: { type: mongoose.Schema.Types.Mixed, default: null },
    revisionQueue: { type: mongoose.Schema.Types.Mixed, default: [] },
    stateData: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } } // Python model only has updated_at
);

learningStateSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model("LearningState", learningStateSchema);
