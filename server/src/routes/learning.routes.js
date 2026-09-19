const express = require("express");
const { Topic, Unit, UserProgress, Roadmap } = require("../models");
const { requireAuth } = require("../middleware/auth.middleware");
const { agentRuntime } = require("../agents");
const { AgentContext } = require("../agents/base");
const { findOwnedCourse, findOwnedTopic } = require("../services/ownership");

const router = express.Router();

/**
 * GAP FIX (Phase 16, not Phase 12 — flagged): these four routes
 * (roadmap/units/progress/next-topic) were promised by Phase 12's title
 * ("... + remaining learning/routes.py") but never actually built — that
 * phase only registered the three pipeline agents. Caught before wiring
 * the frontend to them, rather than repeating the exact mistake this whole
 * migration flagged in the original app (pages wired to endpoints that
 * don't exist). Built now, faithfully, from the real learning/routes.py.
 */

// GET /learning/courses/:courseId/roadmap
router.get("/courses/:courseId/roadmap", requireAuth, async (req, res, next) => {
  try {
    if (!(await findOwnedCourse(req.params.courseId, req.user._id))) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const roadmap = await Roadmap.findOne({ courseId: req.params.courseId });
    if (!roadmap) {
      return res.status(404).json({ detail: "Roadmap not generated yet. Process the course first." });
    }
    return res.json({
      id: roadmap._id,
      course_id: roadmap.courseId,
      structure: roadmap.structure,
      total_topics: roadmap.totalTopics,
      estimated_hours: roadmap.estimatedHours,
    });
  } catch (err) {
    next(err);
  }
});

// GET /learning/courses/:courseId/units
router.get("/courses/:courseId/units", requireAuth, async (req, res, next) => {
  try {
    if (!(await findOwnedCourse(req.params.courseId, req.user._id))) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const units = await Unit.find({ courseId: req.params.courseId }).sort({ orderIndex: 1 });
    const unitIds = units.map((u) => u._id);
    const topics = await Topic.find({ unitId: { $in: unitIds } }).sort({ orderIndex: 1 });

    const topicsByUnit = new Map();
    for (const t of topics) {
      const key = t.unitId.toString();
      if (!topicsByUnit.has(key)) topicsByUnit.set(key, []);
      topicsByUnit.get(key).push({
        id: t._id,
        title: t.title,
        description: t.description,
        difficulty: t.difficulty,
        order_index: t.orderIndex,
        estimated_minutes: t.estimatedMinutes,
        importance_score: t.importanceScore,
        subtopics: t.subtopics.map((st) => ({ id: st._id, title: st.title })),
      });
    }

    return res.json(
      units.map((u) => ({
        id: u._id,
        title: u.title,
        description: u.description,
        order_index: u.orderIndex,
        importance_score: u.importanceScore,
        topics: topicsByUnit.get(u._id.toString()) || [],
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /learning/courses/:courseId/progress
router.get("/courses/:courseId/progress", requireAuth, async (req, res, next) => {
  try {
    if (!(await findOwnedCourse(req.params.courseId, req.user._id))) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const unitIds = await Unit.find({ courseId: req.params.courseId }).distinct("_id");
    const allTopics = await Topic.find({ unitId: { $in: unitIds } });
    const topicIds = allTopics.map((t) => t._id);

    const progressRecords = await UserProgress.find({ userId: req.user._id, topicId: { $in: topicIds } });
    const progressMap = new Map(progressRecords.map((p) => [p.topicId.toString(), p]));

    const avgScore = progressRecords.length
      ? progressRecords.reduce((sum, p) => sum + p.score, 0) / progressRecords.length
      : 0;

    return res.json({
      total_topics: allTopics.length,
      completed: progressRecords.filter((p) => p.status === "completed").length,
      in_progress: progressRecords.filter((p) => p.status === "in_progress").length,
      // Matches the original exactly: "not started" = topics with NO
      // progress record at all, not topics whose status === 'not_started'.
      // A topic with a 'revision' status record falls into neither
      // completed/in_progress/not_started here — same gap as the original.
      not_started: allTopics.length - progressRecords.length,
      average_score: avgScore,
      topics: allTopics.map((t) => {
        const p = progressMap.get(t._id.toString());
        return {
          topic_id: t._id,
          title: t.title,
          status: p ? p.status : "not_started",
          score: p ? p.score : 0,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// GET /learning/courses/:courseId/next-topic
router.get("/courses/:courseId/next-topic", requireAuth, async (req, res, next) => {
  try {
    if (!(await findOwnedCourse(req.params.courseId, req.user._id))) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const { current_topic_id: currentTopicId } = req.query;

    // Refetch units/topics fully ordered (order_index within each unit,
    // units in their own order_index order) — matches the SQL query's
    // ORDER BY Unit.order_index, Topic.order_index.
    const orderedUnits = await Unit.find({ courseId: req.params.courseId }).sort({ orderIndex: 1 });
    let topics = [];
    for (const u of orderedUnits) {
      const unitTopics = await Topic.find({ unitId: u._id }).sort({ orderIndex: 1 });
      topics = topics.concat(unitTopics);
    }

    if (!topics.length) {
      return res.status(404).json({ detail: "No topics found" });
    }

    if (currentTopicId) {
      const idx = topics.findIndex((t) => t._id.toString() === currentTopicId);
      if (idx !== -1 && idx + 1 < topics.length) {
        return res.json({ next_topic_id: topics[idx + 1]._id, title: topics[idx + 1].title });
      }
    }

    const completed = await UserProgress.find({ userId: req.user._id, status: "completed" }).distinct("topicId");
    const completedIds = new Set(completed.map(String));

    for (const t of topics) {
      if (!completedIds.has(t._id.toString())) {
        return res.json({ next_topic_id: t._id, title: t.title });
      }
    }

    return res.json({ next_topic_id: null, title: "All topics completed!" });
  } catch (err) {
    next(err);
  }
});

// GET /learning/topics/:topicId
// PRESERVED QUIRK: this is a read endpoint with a write side effect — it
// upserts UserProgress to IN_PROGRESS on every load. Flagged in the Phase 0
// contract; do not "clean this up" into a pure GET.
router.get("/topics/:topicId", requireAuth, async (req, res, next) => {
  try {
    const { topicId } = req.params;

    const owned = await findOwnedTopic(topicId, req.user._id);
    if (!owned) {
      return res.status(404).json({ detail: "Topic not found" });
    }
    const { topic, unit } = owned;

    if (!topic.content) {
      const context = new AgentContext({
        userId: req.user._id.toString(),
        courseId: unit.courseId.toString(),
        topicId: topicId.toString(),
      });
      context.set("topic_title", topic.title);
      context.set("topic_description", topic.description || "");
      context.set("difficulty", topic.difficulty || "intermediate");
      context.set(
        "subtopics",
        topic.subtopics.map((st) => st.title)
      );

      const teachingAgent = agentRuntime.getAgent("teaching_agent");
      const agentResult = await teachingAgent.run(context);

      if (agentResult.success) {
        topic.content = agentResult.data.explanation || "";
        topic.keyPoints = agentResult.data.key_points || [];
        topic.examples = agentResult.data.examples || [];
        topic.memoryTricks = agentResult.data.memory_tricks || [];
        await topic.save();
      }
    }

    await updateProgress(req.user._id, topicId, "in_progress");

    return res.json({
      id: topic._id,
      title: topic.title,
      description: topic.description,
      content: topic.content,
      difficulty: topic.difficulty,
      key_points: topic.keyPoints,
      examples: topic.examples,
      memory_tricks: topic.memoryTricks,
      importance_score: topic.importanceScore,
      estimated_minutes: topic.estimatedMinutes,
      subtopics: topic.subtopics.map((st) => ({
        id: st._id,
        title: st.title,
        content: st.content,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /learning/topics/:topicId/complete
router.post("/topics/:topicId/complete", requireAuth, async (req, res, next) => {
  try {
    const { topicId } = req.params;
    if (!(await findOwnedTopic(topicId, req.user._id))) {
      return res.status(404).json({ detail: "Topic not found" });
    }
    await updateProgress(req.user._id, topicId, "completed");
    return res.json({ status: "completed", topic_id: topicId });
  } catch (err) {
    next(err);
  }
});

/**
 * Ports _update_progress(db, user_id, topic_id, status) exactly, including
 * the edge case: attempts only increments on COMPLETED if a progress
 * record already existed — a brand-new record created directly as
 * COMPLETED (e.g. /complete called without ever viewing the topic first)
 * starts at attempts=0, not 1.
 */
async function updateProgress(userId, topicId, status) {
  const existing = await UserProgress.findOne({ userId, topicId });

  if (existing) {
    existing.status = status;
    if (status === "completed") {
      existing.attempts += 1;
    }
    await existing.save();
  } else {
    await UserProgress.create({ userId, topicId, status });
  }
}

module.exports = router;
