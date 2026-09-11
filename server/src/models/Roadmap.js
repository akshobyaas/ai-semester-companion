const mongoose = require("mongoose");

const roadmapSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      unique: true, // Python model: course_id unique=True (1–1 relationship)
      index: true,
    },
    structure: { type: mongoose.Schema.Types.Mixed, default: null },
    totalTopics: { type: Number, default: 0 },
    estimatedHours: { type: Number, default: 0.0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Roadmap", roadmapSchema);
