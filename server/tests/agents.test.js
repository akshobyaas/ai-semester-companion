const { BaseAgent, AgentContext, AgentResult } = require("../src/agents/base");
const { AgentRuntime, LearningPhase, createDefaultHiclaw } = require("../src/agents/runtime");

/**
 * Ports tests/test_agents.py. Same MockAgent pattern, same test names/intent
 * mapped to Jest conventions.
 */
class MockAgent extends BaseAgent {
  constructor(name = "mock", returnData = {}) {
    super(name);
    this.returnData = returnData;
  }
  async execute(context) {
    return new AgentResult({ success: true, data: this.returnData });
  }
}

describe("agent execution", () => {
  test("basic agent execution", async () => {
    const agent = new MockAgent("mock", { key: "value" });
    const context = new AgentContext({ userId: "test-user", courseId: "test-course" });

    const result = await agent.run(context);

    expect(result.success).toBe(true);
    expect(result.data.key).toBe("value");
  });

  test("agent context operations", () => {
    const context = new AgentContext({ userId: "u1", courseId: "c1" });

    context.set("key1", "value1");
    expect(context.get("key1")).toBe("value1");
    expect(context.get("nonexistent", "default")).toBe("default");
    expect(context.history.length).toBe(1);
  });
});

describe("agent runtime", () => {
  test("agent registration", () => {
    const runtime = new AgentRuntime();
    const agent = new MockAgent("test_agent");

    runtime.registerAgent(agent, LearningPhase.INGESTION);

    expect(runtime.getAgent("test_agent")).toBe(agent);
  });

  test("execute a specific agent through runtime", async () => {
    const runtime = new AgentRuntime();
    const agent = new MockAgent("test_agent", { result: 42 });
    runtime.registerAgent(agent);

    const context = new AgentContext();
    const result = await runtime.executeAgent("test_agent", context);

    expect(result.success).toBe(true);
    expect(result.data.result).toBe(42);
  });

  test("full pipeline execution", async () => {
    const runtime = new AgentRuntime();
    runtime.registerAgent(new MockAgent("agent1", { step: 1 }), LearningPhase.INGESTION);
    runtime.registerAgent(new MockAgent("agent2", { step: 2 }), LearningPhase.KNOWLEDGE_EXTRACTION);

    const context = new AgentContext();
    const results = await runtime.executePipeline(
      [LearningPhase.INGESTION, LearningPhase.KNOWLEDGE_EXTRACTION],
      context
    );

    expect(Object.keys(results).length).toBe(2);
    expect(results[LearningPhase.INGESTION].success).toBe(true);
    expect(results[LearningPhase.KNOWLEDGE_EXTRACTION].success).toBe(true);
  });
});

describe("HiCLaw rule evaluation", () => {
  test("low score triggers revision (critical rule)", () => {
    const hiclaw = createDefaultHiclaw();
    const context = new AgentContext();
    context.set("last_quiz_score", 30);

    expect(hiclaw.getAction(context)).toBe("revision");
  });

  test("high score + streak triggers level_up", () => {
    const hiclaw = createDefaultHiclaw();
    const context = new AgentContext();
    context.set("last_quiz_score", 95);
    context.set("consecutive_high_scores", 4);

    expect(hiclaw.getAction(context)).toBe("level_up");
  });

  test("medium score triggers adaptive_revision", () => {
    const hiclaw = createDefaultHiclaw();
    const context = new AgentContext();
    context.set("last_quiz_score", 50);
    context.set("consecutive_high_scores", 0);

    expect(hiclaw.getAction(context)).toBe("adaptive_revision");
  });

  // Beyond the original file: the tie-break quirk found and documented in
  // Phase 13 — worth a permanent regression test since it's easy to
  // "accidentally fix" during a future refactor without realizing it's
  // load-bearing for matching the original's real behavior.
  test("QUIRK: continue_learning wins the tie over course_completion_check (both MEDIUM priority)", () => {
    const hiclaw = createDefaultHiclaw();
    const context = new AgentContext();
    context.set("last_quiz_score", 70);
    context.set("topics_completed", 10);
    context.set("topics_total", 10);

    expect(hiclaw.getAction(context)).toBe("next_topic");
  });
});
