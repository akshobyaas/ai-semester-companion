const { AgentResult, log } = require("./base");

const LearningPhase = Object.freeze({
  INGESTION: "ingestion",
  KNOWLEDGE_EXTRACTION: "knowledge_extraction",
  WEIGHTAGE_ANALYSIS: "weightage_analysis",
  ROADMAP_GENERATION: "roadmap_generation",
  TEACHING: "teaching",
  DOUBT_RESOLUTION: "doubt_resolution",
  QUIZ: "quiz",
  EVALUATION: "evaluation",
  ADAPTATION: "adaptation",
});

class TransitionRule {
  constructor({ fromPhase, toPhase, condition = null, priority = 0 }) {
    this.fromPhase = fromPhase;
    this.toPhase = toPhase;
    this.condition = condition;
    this.priority = priority;
  }
}

/**
 * Ports AgentRuntime. Two behaviors worth calling out because they're easy
 * to get backwards:
 *   - Transition rules sort by priority DESCENDING (higher priority first).
 *   - HiCLaw rules (below) sort by declared-order-of-priority-level
 *     ASCENDING (CRITICAL before HIGH before MEDIUM before LOW) — a
 *     different sort direction on a conceptually similar "priority" field.
 *     Kept them visibly separate rather than sharing a comparator.
 */
class AgentRuntime {
  constructor() {
    this._agents = new Map();
    this._phaseAgents = new Map();
    this._transitions = [];
    this._currentPhase = LearningPhase.INGESTION;
  }

  registerAgent(agent, phase = null) {
    this._agents.set(agent.name, agent);
    if (phase) this._phaseAgents.set(phase, agent.name);
    log("agent_registered", { name: agent.name, phase });
  }

  addTransition(rule) {
    this._transitions.push(rule);
    this._transitions.sort((a, b) => b.priority - a.priority); // descending
  }

  getAgent(name) {
    return this._agents.get(name) || null;
  }

  async executeAgent(agentName, context) {
    const agent = this._agents.get(agentName);
    if (!agent) {
      return new AgentResult({ success: false, error: `Agent '${agentName}' not found` });
    }

    log("executing_agent", { agent: agentName });
    const result = await agent.run(context);

    // Namespace every result field into context as "agentName.key" —
    // this is how later phases/agents see earlier agents' output.
    for (const [key, value] of Object.entries(result.data)) {
      context.set(`${agentName}.${key}`, value);
    }

    return result;
  }

  async executePhase(phase, context) {
    const agentName = this._phaseAgents.get(phase);
    if (!agentName) {
      return new AgentResult({ success: false, error: `No agent for phase '${phase}'` });
    }
    this._currentPhase = phase;
    return this.executeAgent(agentName, context);
  }

  /**
   * Sequential, break-on-first-failure — matches the Python version and
   * resolves Phase 0's open question about pipeline branching: there
   * isn't any here, it's a straight-line loop. Branching only exists via
   * executeAdaptiveLoop()/getNextPhase() below, which no current route
   * calls (ingestion's /process passes an explicit phases list to
   * execute_pipeline, not the adaptive loop).
   */
  async executePipeline(phases, context) {
    const results = {};
    for (const phase of phases) {
      const result = await this.executePhase(phase, context);
      results[phase] = result;
      if (!result.success) {
        log("pipeline_failed", { phase, error: result.error });
        break;
      }
    }
    return results;
  }

  getNextPhase(context) {
    for (const rule of this._transitions) {
      if (rule.fromPhase === this._currentPhase) {
        if (!rule.condition || rule.condition(context)) {
          return rule.toPhase;
        }
      }
    }
    return null;
  }

  async executeAdaptiveLoop(context) {
    const results = [];
    const maxIterations = 50;

    for (let i = 0; i < maxIterations; i++) {
      const nextPhase = this.getNextPhase(context);
      if (nextPhase === null) break;

      const result = await this.executePhase(nextPhase, context);
      results.push(result);

      if (!result.success) break;
      if (context.get("stop_loop", false)) break;
    }

    return results;
  }
}

// ─── HiCLaw — Hierarchical Control Logic ───────────────────────────────

const HiCLawPriority = Object.freeze({
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
});

// Declaration order stands in for Python's `list(HiCLawPriority).index(...)`
// sort key — JS enums have no inherent order, so this array is that order.
const HICLAW_PRIORITY_ORDER = [
  HiCLawPriority.CRITICAL,
  HiCLawPriority.HIGH,
  HiCLawPriority.MEDIUM,
  HiCLawPriority.LOW,
];

class HiCLawRule {
  constructor({ name, priority, condition, action, description = "", metadata = {} }) {
    this.name = name;
    this.priority = priority;
    this.condition = condition;
    this.action = action;
    this.description = description;
    this.metadata = metadata;
  }
}

class HiCLaw {
  constructor() {
    this._rules = [];
  }

  addRule(rule) {
    this._rules.push(rule);
    this._rules.sort(
      (a, b) => HICLAW_PRIORITY_ORDER.indexOf(a.priority) - HICLAW_PRIORITY_ORDER.indexOf(b.priority)
    );
  }

  evaluate(context) {
    const matching = [];
    for (const rule of this._rules) {
      try {
        if (rule.condition(context)) {
          matching.push(rule);
          log("rule_matched", { rule: rule.name, priority: rule.priority });
        }
      } catch (e) {
        log("rule_evaluation_error", { rule: rule.name, error: e.message });
      }
    }
    return matching;
  }

  getAction(context) {
    const matching = this.evaluate(context);
    return matching.length ? matching[0].action : null;
  }

  getAllActions(context) {
    return this.evaluate(context).map((r) => r.action);
  }
}

// ─── Default Runtime & HiCLaw Setup ────────────────────────────────────

function createDefaultHiclaw() {
  const hiclaw = new HiCLaw();

  hiclaw.addRule(
    new HiCLawRule({
      name: "force_revision_on_low_score",
      priority: HiCLawPriority.CRITICAL,
      condition: (ctx) => ctx.get("last_quiz_score", 100) < 40,
      action: "revision",
      description: "Force revision when quiz score is critically low",
    })
  );

  hiclaw.addRule(
    new HiCLawRule({
      name: "suggest_revision_on_medium_score",
      priority: HiCLawPriority.HIGH,
      condition: (ctx) => {
        const s = ctx.get("last_quiz_score", 100);
        return s >= 40 && s < 60;
      },
      action: "adaptive_revision",
      description: "Suggest revision for weak areas when score is below threshold",
    })
  );

  hiclaw.addRule(
    new HiCLawRule({
      name: "continue_learning",
      priority: HiCLawPriority.MEDIUM,
      condition: (ctx) => ctx.get("last_quiz_score", 0) >= 60,
      action: "next_topic",
      description: "Continue to next topic when score is satisfactory",
    })
  );

  hiclaw.addRule(
    new HiCLawRule({
      name: "level_up_on_excellence",
      priority: HiCLawPriority.HIGH,
      condition: (ctx) => ctx.get("last_quiz_score", 0) >= 90 && ctx.get("consecutive_high_scores", 0) >= 3,
      action: "level_up",
      description: "Increase difficulty on consistently high performance",
    })
  );

  hiclaw.addRule(
    new HiCLawRule({
      name: "course_completion_check",
      priority: HiCLawPriority.MEDIUM,
      condition: (ctx) => ctx.get("topics_completed", 0) >= ctx.get("topics_total", 1),
      action: "course_complete",
      description: "Mark course as complete when all topics are done",
    })
  );

  return hiclaw;
}

function createDefaultRuntime() {
  const runtime = new AgentRuntime();

  const transitions = [
    new TransitionRule({ fromPhase: LearningPhase.INGESTION, toPhase: LearningPhase.KNOWLEDGE_EXTRACTION, priority: 10 }),
    new TransitionRule({ fromPhase: LearningPhase.KNOWLEDGE_EXTRACTION, toPhase: LearningPhase.WEIGHTAGE_ANALYSIS, priority: 10 }),
    new TransitionRule({ fromPhase: LearningPhase.WEIGHTAGE_ANALYSIS, toPhase: LearningPhase.ROADMAP_GENERATION, priority: 10 }),
    new TransitionRule({ fromPhase: LearningPhase.ROADMAP_GENERATION, toPhase: LearningPhase.TEACHING, priority: 10 }),
    new TransitionRule({
      fromPhase: LearningPhase.TEACHING,
      toPhase: LearningPhase.QUIZ,
      condition: (ctx) => ctx.get("teaching_complete", false),
      priority: 10,
    }),
    new TransitionRule({
      fromPhase: LearningPhase.QUIZ,
      toPhase: LearningPhase.EVALUATION,
      condition: (ctx) => ctx.get("quiz_submitted", false),
      priority: 10,
    }),
    new TransitionRule({ fromPhase: LearningPhase.EVALUATION, toPhase: LearningPhase.ADAPTATION, priority: 10 }),
    new TransitionRule({
      fromPhase: LearningPhase.ADAPTATION,
      toPhase: LearningPhase.TEACHING,
      condition: (ctx) => ctx.get("adaptive_action") === "continue",
      priority: 5,
    }),
    new TransitionRule({
      fromPhase: LearningPhase.ADAPTATION,
      toPhase: LearningPhase.TEACHING,
      condition: (ctx) => ctx.get("adaptive_action") === "revise",
      priority: 5,
    }),
  ];

  for (const t of transitions) runtime.addTransition(t);

  return runtime;
}

module.exports = {
  LearningPhase,
  TransitionRule,
  AgentRuntime,
  HiCLawPriority,
  HiCLawRule,
  HiCLaw,
  createDefaultHiclaw,
  createDefaultRuntime,
};
