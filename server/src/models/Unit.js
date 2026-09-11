const mongoose = require("mongoose");

const DifficultyLevel = ["beginner", "intermediate", "advanced"];

const subtopicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, default: null },
    orderIndex: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: true }
);

const topicSchema = new mongoose.Schema(
  {
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    content: { type: String, default: null }, // AI-generated teaching content
    orderIndex: { type: Number, default: 0 },
    difficulty: { type: String, enum: DifficultyLevel, default: "beginner" },
    importanceScore: { type: Number, default: 0.0 },
    pyqFrequency: { type: Number, default: 0 },
    estimatedMinutes: { type: Number, default: 30 },
    // Python used ARRAY(UUID) for prerequisites; ObjectId refs are the Mongo equivalent
    prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }],
    keyPoints: { type: mongoose.Schema.Types.Mixed, default: [] },
    examples: { type: mongoose.Schema.Types.Mixed, default: [] },
    memoryTricks: { type: mongoose.Schema.Types.Mixed, default: [] },
    subtopics: [subtopicSchema], // embedded — subtopics never queried independently of their topic
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const unitSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    orderIndex: { type: Number, default: 0 },
    importanceScore: { type: Number, default: 0.0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Topic stays a top-level collection (not embedded in Unit) because
// GET /learning/topics/{topic_id} looks topics up directly by id — embedding
// would force scanning every Unit to find one Topic.
module.exports = {
  Unit: mongoose.model("Unit", unitSchema),
  Topic: mongoose.model("Topic", topicSchema),
  DifficultyLevel,
};
