const express = require("express");
const { Quiz, QuizAttempt, Topic, Unit, UserProgress } = require("../models");
const { requireAuth } = require("../middleware/auth.middleware");
const { agentRuntime } = require("../agents");
const { AgentContext } = require("../agents/base");

const router = express.Router();

// POST /quiz/generate
router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const {
      topic_id: topicId,
      num_questions: numQuestions = 5,
      difficulty = "intermediate",
      question_types: questionTypes = ["mcq", "short_answer"],
    } = req.body;

    const topic = await Topic.findById(topicId).catch(() => null);
    if (!topic) {
      return res.status(404).json({ detail: "Topic not found" });
    }
    const unit = await Unit.findById(topic.unitId);

    const context = new AgentContext({
      userId: req.user._id.toString(),
      courseId: unit ? unit.courseId.toString() : "",
      topicId: topicId.toString(),
    });
    context.set("topic_title", topic.title);
    context.set("num_questions", numQuestions);
    context.set("difficulty", difficulty);
    context.set("question_types", questionTypes);

    const quizAgent = agentRuntime.getAgent("quiz_agent");
    const agentResult = await quizAgent.run(context);

    if (!agentResult.success) {
      return res.status(500).json({ detail: `Quiz generation failed: ${agentResult.error}` });
    }

    const generatedQuestions = agentResult.data.questions || [];

    const quiz = await Quiz.create({
      topicId: topic._id,
      title: `Quiz: ${topic.title}`,
      difficulty,
      questions: generatedQuestions.map((q, i) => ({
        questionType: q.type || "mcq",
        questionText: q.question,
        options: q.options || null,
        correctAnswer: q.correct_answer,
        explanation: q.explanation || "",
        points: q.points || 1,
        orderIndex: i,
      })),
    });

    return res.json(quizResponse(quiz));
  } catch (err) {
    next(err);
  }
});

// GET /quiz/:quizId
router.get("/:quizId", requireAuth, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).catch(() => null);
    if (!quiz) {
      return res.status(404).json({ detail: "Quiz not found" });
    }
    return res.json(quizResponse(quiz));
  } catch (err) {
    next(err);
  }
});

// POST /quiz/submit
router.post("/submit", requireAuth, async (req, res, next) => {
  try {
    const { quiz_id: quizId, answers = [], time_taken_seconds: timeTakenSeconds } = req.body;

    const quiz = await Quiz.findById(quizId).catch(() => null);
    if (!quiz) {
      return res.status(404).json({ detail: "Quiz not found" });
    }

    const topic = await Topic.findById(quiz.topicId);
    const unit = topic ? await Unit.findById(topic.unitId) : null;
    const courseId = unit ? unit.courseId : null;

    // ANSWER-INDEXING QUIRK (flagged in Phase 0, resolved more robustly here):
    // the Python original builds the index map from `quiz.questions.index(...)`
    // — the SQLAlchemy relationship's default (unordered-by-guarantee) load
    // order — while separately building the evaluation questions list
    // EXPLICITLY sorted by order_index. If those two orderings ever
    // diverged, scoring would silently misalign. This Mongo port uses ONE
    // orderIndex-sorted list for both the id->index lookup AND the
    // evaluation payload, so the two steps can't drift apart — same
    // index-based contract the evaluation agent expects, without the
    // original's latent fragility.
    const sortedQuestions = [...quiz.questions].sort((a, b) => a.orderIndex - b.orderIndex);

    const userAnswers = {};
    for (const answer of answers) {
      const idx = sortedQuestions.findIndex((q) => q._id.toString() === answer.question_id);
      if (idx !== -1) {
        userAnswers[String(idx)] = answer.answer; // unknown question_ids silently skipped, matches original
      }
    }

    const context = new AgentContext({
      userId: req.user._id.toString(),
      courseId: courseId ? courseId.toString() : "",
      topicId: topic ? topic._id.toString() : "",
    });
    context.set(
      "questions",
      sortedQuestions.map((q) => ({
        question: q.questionText,
        correct_answer: q.correctAnswer,
        type: q.questionType,
        points: q.points,
        options: q.options,
      }))
    );
    context.set("user_answers", userAnswers);
    context.set("topic_title", topic ? topic.title : "");

    const evalAgent = agentRuntime.getAgent("evaluation_agent");
    const evalResult = await evalAgent.run(context);

    if (!evalResult.success) {
      return res.status(500).json({ detail: "Evaluation failed" });
    }

    const rawAnswers = {};
    for (const a of answers) rawAnswers[a.question_id] = a.answer;

    const attempt = await QuizAttempt.create({
      userId: req.user._id,
      quizId: quiz._id,
      courseId,
      answers: rawAnswers,
      score: evalResult.data.total_score || 0,
      maxScore: evalResult.data.max_score || 0,
      percentage: evalResult.data.percentage || 0,
      timeTakenSeconds: timeTakenSeconds ?? null,
      feedback: evalResult.data.results || [],
      weakAreas: evalResult.data.weak_areas || [],
    });

    // QUIRK PRESERVED: only updates progress if a record ALREADY exists —
    // no UserProgress record is created here if one is missing (e.g. quiz
    // submitted without ever having viewed the topic first via the lazy
    // GET /learning/topics/:id flow). Matches the Python `if progress:`
    // with no else branch.
    const progress = await UserProgress.findOne({ userId: req.user._id, topicId: topic ? topic._id : null });
    if (progress) {
      progress.score = Math.max(progress.score, evalResult.data.percentage || 0);
      progress.weakAreas = evalResult.data.weak_areas || []; // overwritten, not accumulated
      await progress.save();
    }

    return res.json(quizResultResponse(attempt));
  } catch (err) {
    next(err);
  }
});

// GET /quiz/attempts/:courseId
router.get("/attempts/:courseId", requireAuth, async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ courseId: req.params.courseId, userId: req.user._id }).sort({
      completedAt: -1,
    });

    return res.json(
      attempts.map((a) => ({
        id: a._id,
        quiz_id: a.quizId,
        score: a.score,
        max_score: a.maxScore,
        percentage: a.percentage,
        completed_at: a.completedAt,
        weak_areas: a.weakAreas,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Response shaping deliberately excludes correct_answer/explanation from
// each question — confirmed against the Python QuestionResponse schema,
// which never includes them (resolves a Phase 0 open item).
function quizResponse(quiz) {
  return {
    id: quiz._id,
    topic_id: quiz.topicId,
    title: quiz.title,
    difficulty: quiz.difficulty,
    questions: quiz.questions.map((q) => ({
      id: q._id,
      question_type: q.questionType,
      question_text: q.questionText,
      options: q.options,
      points: q.points,
      order_index: q.orderIndex,
    })),
    created_at: quiz.createdAt,
  };
}

function quizResultResponse(attempt) {
  return {
    id: attempt._id,
    quiz_id: attempt.quizId,
    score: attempt.score,
    max_score: attempt.maxScore,
    percentage: attempt.percentage,
    feedback: attempt.feedback,
    weak_areas: attempt.weakAreas,
    completed_at: attempt.completedAt,
  };
}

module.exports = router;
