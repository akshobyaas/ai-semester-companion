const mongoose = require("mongoose");

const QuestionType = ["mcq", "short_answer", "conceptual"];
const DifficultyLevel = ["beginner", "intermediate", "advanced"];

const questionSchema = new mongoose.Schema(
  {
    questionType: { type: String, enum: QuestionType, required: true },
    questionText: { type: String, required: true },
    options: { type: mongoose.Schema.Types.Mixed, default: null }, // MCQ option list
    correctAnswer: { type: String, required: true },
    explanation: { type: String, default: null },
    points: { type: Number, default: 1 },
    orderIndex: { type: Number, default: 0 },
  },
  { _id: true } // embedded but keeps its own id — question_id in submissions refers to this
);

const quizSchema = new mongoose.Schema(
  {
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
      index: true,
    },
    title: { type: String, default: null },
    difficulty: { type: String, enum: DifficultyLevel, default: "intermediate" },
    questions: [questionSchema],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
    // Denormalized from Quiz->Topic->Unit->Course so GET /quiz/attempts/{course_id}
    // doesn't need a 3-hop lookup — same tradeoff made for Chunk.courseId.
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    // { questionId: userAnswer } — Mixed rather than Map so it serializes
    // to plain JSON the same way the Python JSON column did.
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, default: 0.0 },
    maxScore: { type: Number, default: 0.0 },
    percentage: { type: Number, default: 0.0 },
    timeTakenSeconds: { type: Number, default: null },
    feedback: { type: mongoose.Schema.Types.Mixed, default: [] }, // per-question feedback
    weakAreas: { type: mongoose.Schema.Types.Mixed, default: [] },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: false } // Python model only has completed_at, no separate created/updated
);

// GET /quiz/attempts/{course_id} sorts by completed_at desc per user —
// support that access pattern directly.
quizAttemptSchema.index({ userId: 1, completedAt: -1 });

module.exports = {
  Quiz: mongoose.model("Quiz", quizSchema),
  QuizAttempt: mongoose.model("QuizAttempt", quizAttemptSchema),
  QuestionType,
};
