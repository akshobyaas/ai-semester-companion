const express = require("express");
const { Flashcard, Course } = require("../models");
const { requireAuth } = require("../middleware/auth.middleware");
const vectorStore = require("../services/vectorStore");
const llmService = require("../services/llmService");

const router = express.Router();

/**
 * NEW IN PHASE 17 (by explicit request, after flagging the gap in Phase 3):
 * ports the flashcard subset of legacy backend/routes/revision.py +
 * backend/agents/orchestrator.py's generate_flashcards. The legacy
 * "revision"/cheat-sheet generation (RevisionLog, /revision/generate,
 * /revision/{course_id}) is NOT ported — only flashcards were asked for.
 * Retrieval uses this app's own vectorStore.search (Phase 6) in place of
 * the legacy orchestrator's ChromaDB-based _get_context — same role,
 * different implementation, already tested.
 */

const FLASHCARD_SYSTEM_PROMPT = `You are a Flashcard Generation Agent. Create effective flashcards for spaced repetition learning.

Guidelines:
1. One concept per card
2. Use clear, concise questions
3. Answers should be brief but complete
4. Include key formulas, definitions, concepts
5. Vary question types (what, why, how, compare)
6. Tag with topic and difficulty

Output MUST be valid JSON:
{
    "flashcards": [
        {
            "question": "What is...",
            "answer": "It is...",
            "topic": "Topic Name",
            "difficulty": "easy|medium|hard"
        }
    ]
}`;

// POST /flashcards/generate
router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const { course_id: courseId, topic, num_cards: numCards = 10 } = req.body;

    const course = await Course.findOne({ _id: courseId, userId: req.user._id }).catch(() => null);
    if (!course) {
      return res.status(404).json({ detail: "Course not found" });
    }

    const query = topic || "key concepts definitions formulas";
    const relevantContent = await vectorStore.search(courseId, query, 8);
    const context = relevantContent.map((r) => r.text).join("\n\n");

    let prompt = `Generate ${numCards} flashcards`;
    if (topic) prompt += ` for the topic: ${topic}`;
    prompt += "\nFocus on key concepts, definitions, formulas, and important facts.";

    const systemPrompt = context
      ? `${FLASHCARD_SYSTEM_PROMPT}\n\nCOURSE MATERIALS:\n${context.slice(0, 5000)}`
      : FLASHCARD_SYSTEM_PROMPT;

    const result = await llmService.generateJson(prompt, { systemPrompt, temperature: 0.5 });
    const cards = result.flashcards || [];

    const savedCards = await Flashcard.insertMany(
      cards.map((card) => ({
        courseId,
        question: card.question || "",
        answer: card.answer || "",
        topic: card.topic || topic || "General",
        difficulty: card.difficulty || "medium",
        nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }))
    );

    return res.json({
      generated: savedCards.length,
      flashcards: savedCards.map(flashcardResponse),
    });
  } catch (err) {
    next(err);
  }
});

// GET /flashcards/:courseId?due_only=true
router.get("/:courseId", requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { due_only: dueOnly } = req.query;

    const query = { courseId };
    if (dueOnly === "true") {
      query.nextReview = { $lte: new Date() };
    }

    const cards = await Flashcard.find(query).sort({ nextReview: 1 });
    return res.json(cards.map(flashcardResponse));
  } catch (err) {
    next(err);
  }
});

// POST /flashcards/review — SM-2 spaced repetition, kept identical to the legacy formula
router.post("/review", requireAuth, async (req, res, next) => {
  try {
    const { flashcard_id: flashcardId, quality } = req.body;

    const fc = await Flashcard.findById(flashcardId).catch(() => null);
    if (!fc) {
      return res.status(404).json({ detail: "Flashcard not found" });
    }

    if (quality >= 3) {
      if (fc.repetitions === 0) {
        fc.reviewInterval = 1;
      } else if (fc.repetitions === 1) {
        fc.reviewInterval = 6;
      } else {
        fc.reviewInterval = Math.round(fc.reviewInterval * fc.easeFactor);
      }
      fc.repetitions += 1;
    } else {
      fc.repetitions = 0;
      fc.reviewInterval = 1;
    }

    fc.easeFactor = Math.max(1.3, fc.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    fc.nextReview = new Date(Date.now() + fc.reviewInterval * 24 * 60 * 60 * 1000);

    await fc.save();

    return res.json({
      flashcard_id: fc._id,
      next_review: fc.nextReview.toISOString(),
      review_interval: fc.reviewInterval,
      ease_factor: fc.easeFactor,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /flashcards/:flashcardId
router.delete("/:flashcardId", requireAuth, async (req, res, next) => {
  try {
    const fc = await Flashcard.findById(req.params.flashcardId).catch(() => null);
    if (!fc) {
      return res.status(404).json({ detail: "Flashcard not found" });
    }
    await Flashcard.deleteOne({ _id: fc._id });
    return res.json({ message: "Flashcard deleted" });
  } catch (err) {
    next(err);
  }
});

function flashcardResponse(fc) {
  return {
    id: fc._id,
    question: fc.question,
    answer: fc.answer,
    topic: fc.topic,
    difficulty: fc.difficulty,
    review_interval: fc.reviewInterval,
    next_review: fc.nextReview,
    repetitions: fc.repetitions,
  };
}

module.exports = router;
