const { BaseAgent, AgentResult } = require("./base");
const llmService = require("../services/llmService");

/**
 * QUIRK PRESERVED: Python's _apply_weightage does `enriched = structure.copy()`
 * — a SHALLOW copy. The nested `units`/`topics` lists/dicts are the SAME
 * objects as in the original `structure`, so mutating topic["importance_score"]
 * on the "enriched" copy also mutates the original knowledge_structure still
 * held elsewhere in context. JS's `{ ...structure }` has the identical
 * shallow-copy behavior (nested arrays/objects are shared by reference), so
 * this port reproduces the same quirk without any extra effort — flagged
 * here so it's a known fact about this code, not an accidental discovery
 * later. In practice this hasn't caused an observed problem since nothing
 * downstream reads the un-enriched knowledge_structure after this point
 * (roadmap_agent prefers enriched_structure), but it's worth knowing.
 */
class WeightageAnalysisAgent extends BaseAgent {
  constructor() {
    super("weightage_analysis_agent", "Analyzes PYQ patterns and assigns topic importance scores");
  }

  async execute(context) {
    const knowledgeStructure = context.get("knowledge_extraction_agent.knowledge_structure", {});
    const pyqText = context.get("knowledge_extraction_agent.pyq_text", "");

    if (!knowledgeStructure || !Object.keys(knowledgeStructure).length) {
      return new AgentResult({ success: false, error: "No knowledge structure available" });
    }

    const topics = [];
    for (const unit of knowledgeStructure.units || []) {
      for (const topic of unit.topics || []) {
        topics.push(topic.title);
      }
    }

    let weightage;
    if (pyqText) {
      weightage = await this._analyzePyqWeightage(topics, pyqText);
    } else {
      weightage = {};
      for (const t of topics) weightage[t] = { frequency: 0, importance: 0.5 };
    }

    const enrichedStructure = this._applyWeightage(knowledgeStructure, weightage);

    return new AgentResult({
      success: true,
      data: { weightage, enriched_structure: enrichedStructure },
      nextAgent: "roadmap_agent",
    });
  }

  async _analyzePyqWeightage(topics, pyqText) {
    const systemPrompt = `You are an expert exam analyst. Analyze the previous year 
        questions and determine how often each topic appears and its importance.
        
        Return a JSON object:
        {
            "analysis": [
                {
                    "topic": "Topic Name",
                    "frequency": 5,
                    "importance": 0.85,
                    "question_types": ["mcq", "short_answer", "long_answer"],
                    "marks_distribution": "high|medium|low"
                }
            ]
        }
        
        frequency = number of times topic appeared in PYQs
        importance = 0.0 to 1.0 score based on frequency and marks weight`;

    const prompt = `Topics to analyze:
${topics.map((t) => `- ${t}`).join("\n")}

Previous Year Questions:
${pyqText.slice(0, 6000)}

Analyze the frequency and importance of each topic based on these PYQs.`;

    const result = await llmService.generateJson(prompt, { systemPrompt, temperature: 0.2, maxTokens: 3000 });

    const weightage = {};
    for (const item of result.analysis || []) {
      weightage[item.topic] = {
        frequency: item.frequency || 0,
        importance: item.importance || 0.5,
        question_types: item.question_types || [],
        marks_distribution: item.marks_distribution || "medium",
      };
    }

    for (const t of topics) {
      if (!(t in weightage)) weightage[t] = { frequency: 0, importance: 0.5 };
    }

    return weightage;
  }

  _applyWeightage(structure, weightage) {
    const enriched = { ...structure }; // shallow copy — see class-level note

    for (const unit of enriched.units || []) {
      let unitImportance = 0;
      let topicCount = 0;
      for (const topic of unit.topics || []) {
        const topicName = topic.title;
        if (topicName in weightage) {
          const w = weightage[topicName];
          topic.importance_score = w.importance ?? 0.5;
          topic.pyq_frequency = w.frequency ?? 0;
          topic.question_types = w.question_types || [];
          unitImportance += topic.importance_score;
          topicCount += 1;
        }
      }
      unit.importance_score = unitImportance / Math.max(topicCount, 1);
    }

    return enriched;
  }
}

module.exports = WeightageAnalysisAgent;
