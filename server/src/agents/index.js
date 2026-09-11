const { createDefaultRuntime, LearningPhase } = require("./runtime");
const IngestionAgent = require("./ingestionAgent");
const TeachingAgent = require("./teachingAgent");
const DoubtAgent = require("./doubtAgent");
const QuizAgent = require("./quizAgent");
const EvaluationAgent = require("./evaluationAgent");
const KnowledgeExtractionAgent = require("./knowledgeAgent");
const WeightageAnalysisAgent = require("./weightageAgent");
const RoadmapAgent = require("./roadmapAgent");
const AdaptiveAgent = require("./adaptiveAgent");

/**
 * Ports the module-level `agent_runtime = create_agent_runtime()` singleton.
 * As of Phase 13, every agent from the original app/agents/__init__.py is
 * registered — the runtime is complete.
 */
function createAgentRuntime() {
  const runtime = createDefaultRuntime();

  runtime.registerAgent(new IngestionAgent(), LearningPhase.INGESTION);
  runtime.registerAgent(new KnowledgeExtractionAgent(), LearningPhase.KNOWLEDGE_EXTRACTION);
  runtime.registerAgent(new WeightageAnalysisAgent(), LearningPhase.WEIGHTAGE_ANALYSIS);
  runtime.registerAgent(new RoadmapAgent(), LearningPhase.ROADMAP_GENERATION);
  runtime.registerAgent(new TeachingAgent(), LearningPhase.TEACHING);
  runtime.registerAgent(new DoubtAgent(), LearningPhase.DOUBT_RESOLUTION);
  runtime.registerAgent(new QuizAgent(), LearningPhase.QUIZ);
  runtime.registerAgent(new EvaluationAgent(), LearningPhase.EVALUATION);
  runtime.registerAgent(new AdaptiveAgent(), LearningPhase.ADAPTATION);

  return runtime;
}

// Global singleton, mirrors Python's module-level `agent_runtime`.
const agentRuntime = createAgentRuntime();

module.exports = { agentRuntime, createAgentRuntime };
