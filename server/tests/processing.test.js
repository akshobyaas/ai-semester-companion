const request = require("supertest");
const mongoose = require("mongoose");

jest.setTimeout(20000);

/**
 * POST /ingestion/courses/:id/process must leave documents unprocessed when
 * the pipeline fails, so a student can retry after a temporary LLM error
 * instead of being told "No unprocessed documents found". Models and the
 * agent runtime are mocked, same style as api.test.js.
 */

const { User, Course, Document, Unit, Topic, Roadmap } = require("../src/models");
const { agentRuntime } = require("../src/agents");
const { LearningPhase } = require("../src/agents/runtime");
const vectorStore = require("../src/services/vectorStore");
const { createAccessToken } = require("../src/auth/security");

const oid = () => new mongoose.Types.ObjectId();

describe("POST /ingestion/courses/:courseId/process", () => {
  const me = { _id: oid() };
  const auth = { Authorization: `Bearer ${createAccessToken({ sub: me._id.toString() })}` };
  const course = { _id: oid(), userId: me._id };
  const docs = [
    { _id: oid(), filePath: "a.txt", docType: "syllabus" },
    { _id: oid(), filePath: "b.txt", docType: "notes" },
  ];

  let app;
  let saved;
  let events;

  beforeAll(() => {
    app = require("../server");
  });

  beforeEach(() => {
    events = [];
    saved = {
      userFindById: User.findById,
      courseFindOne: Course.findOne,
      docFind: Document.find,
      docUpdateMany: Document.updateMany,
      unitFind: Unit.find,
      unitDeleteMany: Unit.deleteMany,
      unitCreate: Unit.create,
      topicDeleteMany: Topic.deleteMany,
      roadmapUpsert: Roadmap.findOneAndUpdate,
      executePipeline: agentRuntime.executePipeline,
      deleteChunks: vectorStore.deleteDocumentChunks,
    };

    User.findById = async () => me;
    Course.findOne = async () => course;
    Document.find = async () => docs;
    Document.updateMany = jest.fn(async () => events.push("markProcessed"));
    Unit.find = () => ({ distinct: async () => [] });
    Unit.deleteMany = async () => {};
    Unit.create = async () => ({ _id: oid() });
    Topic.deleteMany = async () => {};
    Roadmap.findOneAndUpdate = jest.fn(async () => events.push("persistRoadmap"));
    vectorStore.deleteDocumentChunks = jest.fn(async () => events.push("clearChunks"));
  });

  afterEach(() => {
    User.findById = saved.userFindById;
    Course.findOne = saved.courseFindOne;
    Document.find = saved.docFind;
    Document.updateMany = saved.docUpdateMany;
    Unit.find = saved.unitFind;
    Unit.deleteMany = saved.unitDeleteMany;
    Unit.create = saved.unitCreate;
    Topic.deleteMany = saved.topicDeleteMany;
    Roadmap.findOneAndUpdate = saved.roadmapUpsert;
    agentRuntime.executePipeline = saved.executePipeline;
    vectorStore.deleteDocumentChunks = saved.deleteChunks;
  });

  const succeeding = () => ({
    [LearningPhase.INGESTION]: { success: true, error: null },
    [LearningPhase.KNOWLEDGE_EXTRACTION]: { success: true, error: null },
    [LearningPhase.WEIGHTAGE_ANALYSIS]: { success: true, error: null },
    [LearningPhase.ROADMAP_GENERATION]: { success: true, error: null },
  });

  const post = () => request(app).post(`/api/v1/ingestion/courses/${course._id}/process`).set(auth);

  test("a failed pipeline returns 502 and leaves documents unprocessed", async () => {
    agentRuntime.executePipeline = jest.fn(async () => {
      events.push("pipeline");
      return {
        [LearningPhase.INGESTION]: { success: true, error: null },
        [LearningPhase.KNOWLEDGE_EXTRACTION]: { success: false, error: "503 high demand" },
      };
    });

    const res = await post();

    expect(res.status).toBe(502);
    expect(res.body.detail).toMatch(/knowledge_extraction.*503 high demand/);
    expect(Document.updateMany).not.toHaveBeenCalled();
    expect(Roadmap.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("a retry after a failure can run again, then marks documents processed", async () => {
    const outcomes = [
      { [LearningPhase.INGESTION]: { success: false, error: "boom" } },
      succeeding(),
    ];
    agentRuntime.executePipeline = jest.fn(async (phases, context) => {
      const out = outcomes.shift();
      if (out[LearningPhase.ROADMAP_GENERATION]) context.set("roadmap_agent.roadmap", { phases: [] });
      return out;
    });

    const first = await post();
    const second = await post();

    expect(first.status).toBe(502);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("success");
    expect(Document.updateMany).toHaveBeenCalledTimes(1);
    expect(Document.updateMany).toHaveBeenCalledWith({ _id: { $in: docs.map((d) => d._id) } }, { processed: true });
  });

  test("clears old chunks before running, and marks processed only after saving the roadmap", async () => {
    agentRuntime.executePipeline = jest.fn(async (phases, context) => {
      events.push("pipeline");
      context.set("roadmap_agent.roadmap", { phases: [] });
      return succeeding();
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(vectorStore.deleteDocumentChunks).toHaveBeenCalledWith(docs.map((d) => d._id));
    expect(events).toEqual(["clearChunks", "pipeline", "persistRoadmap", "markProcessed"]);
  });

  test("if saving the roadmap fails, documents stay unprocessed", async () => {
    agentRuntime.executePipeline = jest.fn(async (phases, context) => {
      context.set("roadmap_agent.roadmap", { phases: [] });
      return succeeding();
    });
    Roadmap.findOneAndUpdate = jest.fn(async () => {
      throw new Error("db down");
    });

    const res = await post();

    expect(res.status).toBe(500);
    expect(Document.updateMany).not.toHaveBeenCalled();
  });
});
