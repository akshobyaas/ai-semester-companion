const express = require("express");
const { RevisionLog } = require("../models");
const { requireAuth } = require("../middleware/auth.middleware");
const vectorStore = require("../services/vectorStore");
const llmService = require("../services/llmService");
const { findOwnedCourse } = require("../services/ownership");

const router = express.Router();

const REVISION_SYSTEM_PROMPT = `You are a Revision Agent that creates study materials for exam preparation.

Types of revision content:
1. cheat_sheet: Condensed key points, formulas, definitions (1-2 pages)
2. formula_sheet: All important formulas/equations organized by topic
3. quick_notes: Brief revision notes with highlights
4. exam_summary: "Night before exam" summary - most critical points

Guidelines:
- Be extremely concise but comprehensive
- Use bullet points and tables
- Highlight most important points
- Include common exam traps
- Add memory tricks/mnemonics where helpful
- Use markdown formatting
- For math, use LaTeX: $inline$ or $$block$$`;

const TYPE_DESCRIPTIONS = {
  cheat_sheet: "a concise cheat sheet with all key points, formulas, and definitions",
  formula_sheet: "a comprehensive formula sheet organized by topic",
  quick_notes: "quick revision notes highlighting the most important concepts",
  exam_summary: "a 'night before exam' summary with the most critical information",
};

// POST /revision/generate
router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const { course_id: courseId, revision_type: revisionType = "cheat_sheet", topic } = req.body;

    const course = await findOwnedCourse(courseId, req.user._id);
    if (!course) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const query = topic || "complete syllabus overview all topics";
    const relevantContent = await vectorStore.search(courseId, query, 10);
    const context = relevantContent.map((r) => r.text).join("\n\n");

    let prompt = `Create ${TYPE_DESCRIPTIONS[revisionType] || "revision notes"}`;
    if (topic) prompt += ` for the topic: ${topic}`;

    const systemPrompt = context
      ? `${REVISION_SYSTEM_PROMPT}\n\nCOURSE MATERIALS:\n${context.slice(0, 6000)}`
      : REVISION_SYSTEM_PROMPT;

    const content = await llmService.generate(prompt, { systemPrompt, temperature: 0.3 });

    const log = await RevisionLog.create({
      courseId,
      topic: topic || "General",
      revisionType,
      content,
    });

    return res.json({
      id: log._id,
      topic: log.topic,
      revision_type: log.revisionType,
      content: log.content,
      created_at: log.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// GET /revision/:courseId
router.get("/:courseId", requireAuth, async (req, res, next) => {
  try {
    if (!(await findOwnedCourse(req.params.courseId, req.user._id))) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const logs = await RevisionLog.find({ courseId: req.params.courseId }).sort({ createdAt: -1 });
    return res.json(
      logs.map((log) => ({
        id: log._id,
        topic: log.topic,
        revision_type: log.revisionType,
        content: log.content,
        created_at: log.createdAt,
      }))
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
