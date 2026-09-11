/**
 * Ports app/agents/base.py (the "AgentScope" base framework) as closely as
 * JS allows. Python's @dataclass defaults become plain constructor defaults;
 * structlog becomes a minimal console logger — the log *calls* are kept in
 * the same places since they're part of the observable behavior during
 * debugging, even though the log backend itself isn't load-bearing.
 */

const AgentStatus = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  WAITING: "waiting",
});

function log(event, fields = {}) {
  // Stand-in for structlog.get_logger().info/error(event, **fields).
  // Deliberately plain — swap for pino/winston later if structured log
  // aggregation becomes a real need; not worth the dependency for a
  // final-year prototype.
  console.log(`[agent] ${event}`, fields);
}

/**
 * Ports AgentContext — the shared state object threaded through every
 * agent call. `set()` also appends a history entry, exactly like the
 * Python dataclass; this is relied on by runtime.js's executeAgent(),
 * which calls context.set() once per key in an agent's result.data.
 */
class AgentContext {
  constructor({ userId = "", courseId = "", topicId = "" } = {}) {
    this.userId = userId;
    this.courseId = courseId;
    this.topicId = topicId;
    this.data = {};
    this.history = [];
    this.metadata = {};
  }

  set(key, value) {
    this.data[key] = value;
    this.history.push({
      action: "set",
      key,
      timestamp: new Date().toISOString(),
    });
  }

  get(key, defaultValue = null) {
    return key in this.data ? this.data[key] : defaultValue;
  }

  toDict() {
    return {
      user_id: this.userId,
      course_id: this.courseId,
      topic_id: this.topicId,
      data: this.data,
      metadata: this.metadata,
    };
  }
}

/**
 * Ports AgentResult. Kept as a plain class rather than a frozen object
 * since agents construct these directly (`new AgentResult({...})`).
 */
class AgentResult {
  constructor({ success, data = {}, error = null, nextAgent = null, metadata = {} } = {}) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.nextAgent = nextAgent;
    this.metadata = metadata;
  }
}

/**
 * Ports BaseAgent. Subclasses must implement execute(context). The
 * important behavior to preserve: run() NEVER throws — any exception
 * inside execute() (or pre/post hooks) is caught and converted into a
 * failed AgentResult. This is what lets callers (like the eventual
 * /adaptive/recommend route in Phase 13) treat "agent blew up" and
 * "agent legitimately failed" the same way, without a try/catch at
 * every call site.
 */
class BaseAgent {
  constructor(name, description = "") {
    if (new.target === BaseAgent) {
      throw new TypeError("BaseAgent is abstract — subclass it and implement execute()");
    }
    this.name = name;
    this.description = description;
    this.status = AgentStatus.IDLE;
  }

  // eslint-disable-next-line no-unused-vars
  async execute(context) {
    throw new Error(`${this.name}.execute() not implemented`);
  }

  async preExecute(context) {
    this.status = AgentStatus.RUNNING;
    log("agent_starting", { agent: this.name, context_keys: Object.keys(context.data) });
    return true;
  }

  async postExecute(context, result) {
    this.status = result.success ? AgentStatus.COMPLETED : AgentStatus.FAILED;
    log("agent_completed", { agent: this.name, success: result.success, error: result.error });
  }

  async run(context) {
    try {
      const shouldRun = await this.preExecute(context);
      if (!shouldRun) {
        return new AgentResult({ success: true, data: { skipped: true } });
      }

      const result = await this.execute(context);
      await this.postExecute(context, result);
      return result;
    } catch (e) {
      this.status = AgentStatus.FAILED;
      log("agent_error", { agent: this.name, error: e.message });
      return new AgentResult({ success: false, error: e.message });
    }
  }
}

module.exports = { AgentStatus, AgentContext, AgentResult, BaseAgent, log };
