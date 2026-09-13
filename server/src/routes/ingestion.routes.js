const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { Course, Document, DocumentType, Unit, Topic, Roadmap } = require("../models");
const { requireAuth } = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload.middleware");
const { agentRuntime } = require("../agents");
const { AgentContext } = require("../agents/base");
const { LearningPhase } = require("../agents/runtime");

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./data/uploads";
const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || "52428800", 10); // 50MB, matches settings.max_upload_size

// POST /ingestion/courses
router.post("/courses", requireAuth, async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title || title.length < 3) {
      return res.status(422).json({ detail: "title must be at least 3 characters" });
    }

    const course = await Course.create({
      userId: req.user._id,
      title,
      description: description ?? null,
    });

    return res.status(201).json(courseResponse(course));
  } catch (err) {
    next(err);
  }
});

// GET /ingestion/courses
router.get("/courses", requireAuth, async (req, res, next) => {
  try {
    const courses = await Course.find({ userId: req.user._id });
    return res.json(courses.map(courseResponse));
  } catch (err) {
    next(err);
  }
});

// POST /ingestion/courses/:courseId/upload
router.post("/courses/:courseId/upload", requireAuth, upload.array("files"), async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { doc_type: docType } = req.body;

    const course = await Course.findOne({ _id: courseId, userId: req.user._id }).catch(() => null);
    if (!course) {
      return res.status(404).json({ detail: "Course not found" });
    }

    if (!DocumentType.includes(docType)) {
      return res.status(400).json({ detail: `Invalid doc_type. Use: ${DocumentType.join(", ")}` });
    }

    const files = req.files || [];
    const courseUploadDir = path.join(UPLOAD_DIR, String(courseId));
    await fs.mkdir(courseUploadDir, { recursive: true });

    const createdDocs = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_SIZE) {
        return res.status(400).json({ detail: `File ${file.originalname} exceeds maximum size` });
      }

      const ext = path.extname(file.originalname).toLowerCase();
      const fileId = crypto.randomUUID();
      const filePath = path.join(courseUploadDir, `${fileId}${ext}`);

      await fs.writeFile(filePath, file.buffer);

      const doc = await Document.create({
        courseId: course._id,
        filename: file.originalname,
        filePath,
        fileType: ext.replace(".", ""),
        docType,
        processed: false,
      });
      createdDocs.push(doc);
    }

    return res.json(createdDocs.map(documentResponse));
  } catch (err) {
    next(err);
  }
});
// GET /ingestion/courses/:courseId/documents
router.get("/courses/:courseId/documents", requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findOne({ _id: courseId, userId: req.user._id }).catch(() => null);
    if (!course) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const documents = await Document.find({ courseId: course._id }).sort({ createdAt: -1 });
    return res.json(documents.map(documentResponse));
  } catch (err) {
    next(err);
  }
});
// POST /ingestion/courses/:courseId/process
router.post("/courses/:courseId/process", requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findOne({ _id: courseId, userId: req.user._id }).catch(() => null);
    if (!course) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const unprocessedDocs = await Document.find({ courseId: course._id, processed: false });
    if (!unprocessedDocs.length) {
      return res.status(400).json({ detail: "No unprocessed documents found" });
    }

    const context = new AgentContext({
      userId: req.user._id.toString(),
      courseId: courseId.toString(),
    });
    context.set(
      "file_paths",
      unprocessedDocs.map((d) => d.filePath)
    );
    context.set(
      "doc_types",
      unprocessedDocs.map((d) => d.docType)
    );
    // Not present in the Python context (see ingestionAgent.js note) — added
    // so chunks can carry a real documentId instead of just a file path string.
    context.set(
      "document_ids",
      unprocessedDocs.map((d) => d._id)
    );

    const pipelinePhases = [
      LearningPhase.INGESTION,
      LearningPhase.KNOWLEDGE_EXTRACTION,
      LearningPhase.WEIGHTAGE_ANALYSIS,
      LearningPhase.ROADMAP_GENERATION,
    ];

    const results = await agentRuntime.executePipeline(pipelinePhases, context);

    // QUIRK PRESERVED FROM ORIGINAL, FLAGGED NOT HIDDEN: the Python route
    // marks every document `processed = True` and commits UNCONDITIONALLY,
    // even if the pipeline failed partway through (e.g. only INGESTION
    // succeeded and KNOWLEDGE_EXTRACTION errored). That means a partially
    // failed run still gets marked "done" and won't be retried by a future
    // /process call. Kept exactly as-is per this project's rule of
    // replicating real behavior rather than silently "fixing" it — but
    // flagging it here because it's the kind of thing worth deciding
    // deliberately (e.g. only mark processed on full pipeline success)
    // rather than inheriting by accident.
    await Document.updateMany({ _id: { $in: unprocessedDocs.map((d) => d._id) } }, { processed: true });

    const roadmapData = context.get("roadmap_agent.roadmap", {});

    // MAJOR GAP FOUND & FIXED (Phase 12, NOT present in original — this is
    // new code, not a port): a full-repo search of app/ turned up ZERO
    // places that ever create a Unit/Topic/Subtopic/Roadmap database
    // record. knowledge_agent/weightage_agent/roadmap_agent generate a
    // roadmap JSON and it was only ever returned in this response — never
    // persisted. That means, as originally written, GET /learning/topics/:id
    // (built in Phase 10) and GET /learning/courses/:id/units would be
    // permanently non-functional after /process, since no Topic document
    // would ever exist to look up. This gap is severe enough (breaks the
    // entire app past ingestion) that it's addressed here deliberately,
    // not silently — only runs when ROADMAP_GENERATION actually succeeded.
    if (results[LearningPhase.ROADMAP_GENERATION] && results[LearningPhase.ROADMAP_GENERATION].success) {
      await persistRoadmap(course._id, roadmapData);
    }

    const pipelineResults = {};
    for (const [phase, result] of Object.entries(results)) {
      pipelineResults[phase] = { success: result.success, error: result.error };
    }

    return res.json({
      status: "success",
      message: "Course processed successfully",
      roadmap: roadmapData,
      pipeline_results: pipelineResults,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * NEW (Phase 12, not a port — see the note above where this is called).
 * Walks roadmap.phases[].units[].topics[] and creates real Unit + Topic
 * documents, plus upserts the Roadmap summary document. Design choices
 * made here, since there's no original behavior to match:
 *   - Clears this course's existing Unit/Topic/Roadmap before writing new
 *     ones, so re-running /process after uploading more docs doesn't pile
 *     up duplicate units/topics from the previous run.
 *   - Subtopics are NOT populated: the roadmap JSON schema (as designed in
 *     roadmap_agent.js/roadmap_agent.py) never carries subtopics through
 *     from the knowledge-extraction step — that's an existing data-loss
 *     point in the agent pipeline itself, not something this function
 *     introduces. Topic.subtopics will legitimately be empty until/unless
 *     that's addressed at the agent level.
 *   - Similarly, `prerequisites` (computed by knowledge_agent's
 *     _buildDependencies) never flows into the roadmap schema either, so
 *     Topic.prerequisites stays empty here too.
 */
async function persistRoadmap(courseId, roadmapData) {
  // Fetch this course's existing unit ids FIRST, so Topic cleanup can be
  // scoped correctly — deleting Units before reading their ids would leave
  // no way to find their Topics, and querying Topics globally (an earlier
  // draft of this function did) would wrongly delete other courses' data.
  const existingUnitIds = await Unit.find({ courseId }).distinct("_id");
  await Topic.deleteMany({ unitId: { $in: existingUnitIds } });
  await Unit.deleteMany({ courseId });

  let unitOrder = 0;
  for (const phase of roadmapData.phases || []) {
    for (const unitData of phase.units || []) {
      const unit = await Unit.create({
        courseId,
        title: unitData.unit_title || "Untitled Unit",
        orderIndex: unitOrder++,
      });

      let topicOrder = 0;
      for (const topicData of unitData.topics || []) {
        await Topic.create({
          unitId: unit._id,
          title: topicData.title || "Untitled Topic",
          difficulty: topicData.difficulty || "beginner",
          orderIndex: topicData.order ?? topicOrder++,
          estimatedMinutes: topicData.estimated_minutes || 30,
          importanceScore: topicData.importance_score || 0,
        });
      }
    }
  }

  await Roadmap.findOneAndUpdate(
    { courseId },
    {
      courseId,
      structure: roadmapData,
      totalTopics: roadmapData.total_topics || 0,
      estimatedHours: roadmapData.estimated_hours || 0,
    },
    { upsert: true, new: true }
  );
}

function courseResponse(course) {
  return {
    id: course._id,
    user_id: course.userId,
    title: course.title,
    description: course.description,
    created_at: course.createdAt,
  };
}

function documentResponse(doc) {
  return {
    id: doc._id,
    course_id: doc.courseId,
    filename: doc.filename,
    file_type: doc.fileType,
    doc_type: doc.docType,
    processed: doc.processed,
    created_at: doc.createdAt,
  };
}

module.exports = router;
