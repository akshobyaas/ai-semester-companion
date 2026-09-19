const request = require("supertest");
const mongoose = require("mongoose");

jest.setTimeout(20000);

/**
 * Covers two things: (1) POST /adaptive/doubt needs a course or topic and
 * returns a clear error instead of a 500 when it has neither, and (2) every
 * course-scoped route treats another user's resources as not found.
 * Models are mocked the same way api.test.js mocks User — no database.
 */

const { User, Course, Unit, Topic, Quiz, Flashcard, ChatMessage } = require("../src/models");
const { createAccessToken } = require("../src/auth/security");
const vectorStore = require("../src/services/vectorStore");
const llmService = require("../src/services/llmService");

const oid = () => new mongoose.Types.ObjectId();

describe("ownership checks and doubt validation", () => {
  const me = { _id: oid(), email: "me@example.com" };
  const token = createAccessToken({ sub: me._id.toString() });
  const auth = { Authorization: `Bearer ${token}` };

  const courseId = oid();
  const unit = { _id: oid(), courseId };
  const topic = { _id: oid(), unitId: unit._id, title: "Design Patterns" };

  let app;
  let saved;

  beforeAll(() => {
    app = require("../server");
  });

  beforeEach(() => {
    saved = {
      userFindById: User.findById,
      courseFindOne: Course.findOne,
      unitFindById: Unit.findById,
      topicFindById: Topic.findById,
      quizFindById: Quiz.findById,
      flashcardFindById: Flashcard.findById,
      flashcardDeleteOne: Flashcard.deleteOne,
      chatFind: ChatMessage.find,
      chatCreate: ChatMessage.create,
      search: vectorStore.search,
      generate: llmService.generate,
    };
    User.findById = async () => me;
    // Default: caller owns nothing. Tests opt in to ownership per resource.
    Course.findOne = async () => null;
    Unit.findById = async () => unit;
    Topic.findById = async () => topic;
  });

  afterEach(() => {
    User.findById = saved.userFindById;
    Course.findOne = saved.courseFindOne;
    Unit.findById = saved.unitFindById;
    Topic.findById = saved.topicFindById;
    Quiz.findById = saved.quizFindById;
    Flashcard.findById = saved.flashcardFindById;
    Flashcard.deleteOne = saved.flashcardDeleteOne;
    ChatMessage.find = saved.chatFind;
    ChatMessage.create = saved.chatCreate;
    vectorStore.search = saved.search;
    llmService.generate = saved.generate;
  });

  const ownCourse = () => {
    Course.findOne = jest.fn(async () => ({ _id: courseId, userId: me._id }));
  };

  describe("POST /adaptive/doubt", () => {
    test("returns 422, not 500, when neither course_id nor topic_id is sent", async () => {
      const res = await request(app).post("/api/v1/adaptive/doubt").set(auth).send({ message: "What is MVC?" });

      expect(res.status).toBe(422);
      expect(res.body.detail).toMatch(/course_id or topic_id/);
    });

    test("404 for a course the caller doesn't own", async () => {
      const res = await request(app)
        .post("/api/v1/adaptive/doubt")
        .set(auth)
        .send({ message: "What is MVC?", course_id: courseId.toString() });

      expect(res.status).toBe(404);
    });

    test("404 for a topic in a course the caller doesn't own", async () => {
      const res = await request(app)
        .post("/api/v1/adaptive/doubt")
        .set(auth)
        .send({ message: "What is MVC?", topic_id: topic._id.toString() });

      expect(res.status).toBe(404);
      expect(res.body.detail).toBe("Topic not found");
    });

    test("answers a course-level question and searches only that course", async () => {
      ownCourse();
      ChatMessage.find = () => ({ sort: () => ({ limit: async () => [] }) });
      const created = [];
      ChatMessage.create = async (doc) => created.push(doc);
      vectorStore.search = jest.fn(async () => []);
      llmService.generate = jest.fn(async () => "MVC is a pattern.");

      const res = await request(app)
        .post("/api/v1/adaptive/doubt")
        .set(auth)
        .send({ message: "What is MVC?", course_id: courseId.toString() });

      expect(res.status).toBe(200);
      expect(res.body.answer).toBe("MVC is a pattern.");
      expect(vectorStore.search.mock.calls[0][0]).toBe(courseId.toString());
      expect(Course.findOne).toHaveBeenCalledWith({ _id: courseId.toString(), userId: me._id });
      expect(created).toHaveLength(2);
      expect(created.every((m) => m.courseId === courseId.toString())).toBe(true);
    });

    test("answers a topic question when the caller owns the topic's course", async () => {
      ownCourse();
      ChatMessage.find = () => ({ sort: () => ({ limit: async () => [] }) });
      ChatMessage.create = async () => {};
      vectorStore.search = jest.fn(async () => []);
      llmService.generate = jest.fn(async () => "Answer.");

      const res = await request(app)
        .post("/api/v1/adaptive/doubt")
        .set(auth)
        .send({ message: "What is MVC?", topic_id: topic._id.toString() });

      expect(res.status).toBe(200);
      expect(vectorStore.search.mock.calls[0][0]).toBe(courseId.toString());
    });
  });

  describe("other users' resources are 404", () => {
    test.each([
      ["GET", "/api/v1/learning/courses/:c/roadmap"],
      ["GET", "/api/v1/learning/courses/:c/units"],
      ["GET", "/api/v1/learning/courses/:c/progress"],
      ["GET", "/api/v1/learning/courses/:c/next-topic"],
      ["GET", "/api/v1/adaptive/recommend/:c"],
      ["GET", "/api/v1/adaptive/analytics/:c"],
      ["GET", "/api/v1/quiz/attempts/:c"],
      ["GET", "/api/v1/flashcards/:c"],
      ["GET", "/api/v1/revision/:c"],
    ])("%s %s", async (method, path) => {
      const res = await request(app)
        [method.toLowerCase()](path.replace(":c", courseId.toString()))
        .set(auth);

      expect(res.status).toBe(404);
    });

    test("GET /learning/topics/:id", async () => {
      const res = await request(app).get(`/api/v1/learning/topics/${topic._id}`).set(auth);
      expect(res.status).toBe(404);
    });

    test("POST /learning/topics/:id/complete", async () => {
      const res = await request(app).post(`/api/v1/learning/topics/${topic._id}/complete`).set(auth);
      expect(res.status).toBe(404);
    });

    test("POST /quiz/generate", async () => {
      const res = await request(app).post("/api/v1/quiz/generate").set(auth).send({ topic_id: topic._id.toString() });
      expect(res.status).toBe(404);
    });

    test("GET /quiz/:id and POST /quiz/submit", async () => {
      const quiz = { _id: oid(), topicId: topic._id, questions: [] };
      Quiz.findById = async () => quiz;

      const get = await request(app).get(`/api/v1/quiz/${quiz._id}`).set(auth);
      const submit = await request(app).post("/api/v1/quiz/submit").set(auth).send({ quiz_id: quiz._id.toString() });

      expect(get.status).toBe(404);
      expect(submit.status).toBe(404);
    });

    test("POST /flashcards/generate and /revision/generate", async () => {
      const fc = await request(app).post("/api/v1/flashcards/generate").set(auth).send({ course_id: courseId.toString() });
      const rev = await request(app).post("/api/v1/revision/generate").set(auth).send({ course_id: courseId.toString() });

      expect(fc.status).toBe(404);
      expect(rev.status).toBe(404);
    });

    test("flashcard review and delete leave the card untouched", async () => {
      const card = { _id: oid(), courseId, repetitions: 0, save: jest.fn() };
      Flashcard.findById = async () => card;
      Flashcard.deleteOne = jest.fn();

      const review = await request(app)
        .post("/api/v1/flashcards/review")
        .set(auth)
        .send({ flashcard_id: card._id.toString(), quality: 5 });
      const del = await request(app).delete(`/api/v1/flashcards/${card._id}`).set(auth);

      expect(review.status).toBe(404);
      expect(del.status).toBe(404);
      expect(card.save).not.toHaveBeenCalled();
      expect(Flashcard.deleteOne).not.toHaveBeenCalled();
    });
  });
});
