const express = require("express");
const { ChatMessage, Topic, Unit, UserProgress, QuizAttempt } = require("../models");
const { requireAuth } = require("../middleware/auth.middleware");
const { agentRuntime } = require("../agents");
const { AgentContext } = require("../agents/base");
const { findOwnedCourse, findOwnedTopic } = require("../services/ownership");

const router = express.Router();

// POST /adaptive/doubt
router.post("/doubt", requireAuth, async (req, res, next) => {
  try {
    const { message, topic_id: topicId, course_id: bodyCourseId } = req.body;
    if (!message || !message.trim()) {
      return res.status(422).json({ detail: "message is required" });
    }
    if (!topicId && !bodyCourseId) {
      return res.status(422).json({ detail: "course_id or topic_id is required" });
    }

    // Retrieval is scoped by course, so a course must always be resolved —
    // either from the topic (Topic -> Unit -> Course) or passed directly.
    // Both paths verify the course belongs to the caller.
    let topicTitle = "";
    let courseId;
    if (topicId) {
      const owned = await findOwnedTopic(topicId, req.user._id);
      if (!owned) {
        return res.status(404).json({ detail: "Topic not found" });
      }
      topicTitle = owned.topic.title;
      courseId = owned.course._id.toString();
    } else {
      const course = await findOwnedCourse(bodyCourseId, req.user._id);
      if (!course) {
        return res.status(404).json({ detail: "Course not found" });
      }
      courseId = course._id.toString();
    }

    // Topic chats keep per-topic history; course-level chats keep per-course
    // history, so two courses' conversations never bleed into each other.
    const historyFilter = topicId
      ? { userId: req.user._id, topicId }
      : { userId: req.user._id, topicId: null, courseId };
    const recentDesc = await ChatMessage.find(historyFilter).sort({ createdAt: -1 }).limit(10);
    const chatHistory = recentDesc.reverse().map((m) => ({ role: m.role, content: m.content }));

    const context = new AgentContext({
      userId: req.user._id.toString(),
      courseId,
      topicId: topicId ? topicId.toString() : "",
    });
    context.set("question", message);
    context.set("topic_title", topicTitle);
    context.set("chat_history", chatHistory);

    const doubtAgent = agentRuntime.getAgent("doubt_agent");
    const result = await doubtAgent.run(context);

    if (!result.success) {
      // Exact string from the Python route, not result.error — the
      // original never surfaces the agent's internal error message here.
      return res.status(500).json({ detail: "Failed to process doubt" });
    }

    const answer = result.data.answer || "I couldn't find an answer to that question.";

    await ChatMessage.create({
      userId: req.user._id,
      courseId,
      topicId: topicId || null,
      role: "user",
      content: message,
    });
    await ChatMessage.create({
      userId: req.user._id,
      courseId,
      topicId: topicId || null,
      role: "assistant",
      content: answer,
      contextUsed: result.data.sources_used,
    });

    return res.json({ answer, sources: result.data.sources_used || [] });
  } catch (err) {
    next(err);
  }
});

// GET /adaptive/recommend/:courseId
router.get("/recommend/:courseId", requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;

    if (!(await findOwnedCourse(courseId, req.user._id))) {
      return res.status(404).json({ detail: "Course not found" });
    }

    // QUIRK PRESERVED (flagged, not silently scoped): the Python route
    // queries recent quiz attempts and progress records by user_id ONLY —
    // never filtered by course_id. Only total_topics below is actually
    // scoped to this course. That means the recommendation, last_score,
    // average_score, and topics_completed here can reflect the student's
    // activity in a DIFFERENT course entirely. This is the same pattern
    // as /analytics's score_history below — worth deciding deliberately
    // whether this is intentional ("overall momentum") or a real bug,
    // rather than inheriting it by accident.
    const recentAttempts = await QuizAttempt.find({ userId: req.user._id }).sort({ completedAt: -1 }).limit(5);
    const progressRecords = await UserProgress.find({ userId: req.user._id });

    const lastScore = recentAttempts.length ? recentAttempts[0].percentage : 0;
    const avgScore = recentAttempts.length
      ? recentAttempts.reduce((sum, a) => sum + a.percentage, 0) / recentAttempts.length
      : 0;
    const consecutiveHigh = recentAttempts.filter((a) => a.percentage >= 80).length;
    const topicsCompleted = progressRecords.filter((p) => p.status === "completed").length;

    // total_topics IS correctly scoped to this course via Unit -> Topic.
    const unitIds = await Unit.find({ courseId }).distinct("_id");
    const totalTopics = await Topic.countDocuments({ unitId: { $in: unitIds } });

    const context = new AgentContext({ userId: req.user._id.toString(), courseId });
    context.set("evaluation_agent.percentage", lastScore);
    context.set("evaluation_agent.weak_areas", recentAttempts.length ? recentAttempts[0].weakAreas : []);
    context.set("current_difficulty", "intermediate");
    context.set("topics_completed", topicsCompleted);
    context.set("topics_total", totalTopics);
    context.set("consecutive_high_scores", consecutiveHigh);

    const adaptiveAgent = agentRuntime.getAgent("adaptive_agent");
    const result = await adaptiveAgent.run(context);

    if (!result.success) {
      // Matches the original exactly: on agent failure, fall back to a
      // safe default rather than a 500 — the ONE endpoint in this app
      // that swallows agent failure this way (flagged back in Phase 0).
      return res.json({ action: "continue", recommendation: { reasoning: "Continue learning" } });
    }

    return res.json({
      action: result.data.action || "continue",
      recommendation: result.data.recommendation || {},
      stats: {
        last_score: lastScore,
        average_score: avgScore,
        topics_completed: topicsCompleted,
        topics_total: totalTopics,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /adaptive/analytics/:courseId
router.get("/analytics/:courseId", requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;

    if (!(await findOwnedCourse(courseId, req.user._id))) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const unitIds = await Unit.find({ courseId }).distinct("_id");
    const courseTopics = await Topic.find({ unitId: { $in: unitIds } });
    const topicMap = new Map(courseTopics.map((t) => [t._id.toString(), t.title]));
    const courseTopicIds = courseTopics.map((t) => t._id);

    // progress_records IS correctly scoped to this course.
    const progressRecords = await UserProgress.find({ userId: req.user._id, topicId: { $in: courseTopicIds } });

    // QUIRK PRESERVED: quiz_attempts (feeding score_history below) is
    // scoped by user_id ONLY, same as /recommend above — NOT filtered to
    // this course_id. score_history can include quizzes from other courses.
    const quizAttempts = await QuizAttempt.find({ userId: req.user._id }).sort({ completedAt: 1 });

    const totalTopics = courseTopics.length;
    const completed = progressRecords.filter((p) => p.status === "completed").length;
    const avgScore = progressRecords.length
      ? progressRecords.reduce((sum, p) => sum + p.score, 0) / progressRecords.length
      : 0;
    const totalTime = progressRecords.reduce((sum, p) => sum + p.timeSpentMinutes, 0);

    const scoreHistory = quizAttempts.map((a) => ({
      date: a.completedAt.toISOString(),
      score: a.percentage,
      quiz_id: a.quizId,
    }));

    const weakAreas = [];
    const strongAreas = [];
    for (const p of progressRecords) {
      const topicName = topicMap.get(p.topicId.toString()) || "Unknown";
      if (p.score < 60) weakAreas.push(topicName);
      else if (p.score >= 80) strongAreas.push(topicName);
    }

    const topicPerformance = progressRecords.map((p) => ({
      topic_id: p.topicId,
      topic: topicMap.get(p.topicId.toString()) || "Unknown",
      score: p.score,
      status: p.status,
      time_spent: p.timeSpentMinutes,
      attempts: p.attempts,
    }));

    return res.json({
      total_topics: totalTopics,
      completed_topics: completed,
      completion_percentage: Math.round((completed / Math.max(totalTopics, 1)) * 100 * 10) / 10,
      average_score: Math.round(avgScore * 10) / 10,
      total_time_spent_minutes: totalTime,
      weak_areas: weakAreas,
      strong_areas: strongAreas,
      score_history: scoreHistory,
      topic_performance: topicPerformance,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
