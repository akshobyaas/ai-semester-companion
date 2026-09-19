const { Course, Unit, Topic, Quiz, Flashcard } = require("../models");

/**
 * Ownership lookups. Every course-scoped resource (Unit, Topic, Quiz,
 * Flashcard, RevisionLog, Chunk, ...) hangs off a Course, and Course is the
 * only model that carries a userId — so "does this user own X" always means
 * resolving X back to its Course.
 *
 * Every helper returns null for "doesn't exist", "malformed id", AND "belongs
 * to someone else". Callers turn that into a 404 either way, so a user can't
 * tell another user's resources apart from nonexistent ones.
 */

async function findOwnedCourse(courseId, userId) {
  if (!courseId) return null;
  return Course.findOne({ _id: courseId, userId }).catch(() => null);
}

async function findOwnedTopic(topicId, userId) {
  if (!topicId) return null;
  const topic = await Topic.findById(topicId).catch(() => null);
  if (!topic) return null;
  const unit = await Unit.findById(topic.unitId);
  if (!unit) return null;
  const course = await findOwnedCourse(unit.courseId, userId);
  if (!course) return null;
  return { topic, unit, course };
}

async function findOwnedQuiz(quizId, userId) {
  if (!quizId) return null;
  const quiz = await Quiz.findById(quizId).catch(() => null);
  if (!quiz) return null;
  const owned = await findOwnedTopic(quiz.topicId, userId);
  if (!owned) return null;
  return { quiz, ...owned };
}

async function findOwnedFlashcard(flashcardId, userId) {
  if (!flashcardId) return null;
  const flashcard = await Flashcard.findById(flashcardId).catch(() => null);
  if (!flashcard) return null;
  const course = await findOwnedCourse(flashcard.courseId, userId);
  if (!course) return null;
  return { flashcard, course };
}

module.exports = { findOwnedCourse, findOwnedTopic, findOwnedQuiz, findOwnedFlashcard };
