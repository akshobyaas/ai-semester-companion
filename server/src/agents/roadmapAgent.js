const { BaseAgent, AgentResult } = require("./base");
const llmService = require("../services/llmService");

class RoadmapAgent extends BaseAgent {
  constructor() {
    super("roadmap_agent", "Creates optimized learning roadmap with priority ordering");
  }

  async execute(context) {
    const enrichedStructure = context.get("weightage_analysis_agent.enriched_structure", {});
    const knowledgeStructure = context.get("knowledge_extraction_agent.knowledge_structure", {});

    const structure =
      enrichedStructure && Object.keys(enrichedStructure).length ? enrichedStructure : knowledgeStructure;
    if (!structure || !Object.keys(structure).length) {
      return new AgentResult({ success: false, error: "No knowledge structure available" });
    }

    const roadmap = await this._generateRoadmap(structure);

    return new AgentResult({
      success: true,
      data: { roadmap },
      nextAgent: "teaching_agent",
    });
  }

  async _generateRoadmap(structure) {
    const systemPrompt = `You are an expert learning path designer. Given a knowledge 
        structure with importance scores and dependencies, create an optimized learning roadmap.
        
        Return a JSON object:
        {
            "roadmap": {
                "title": "Course Roadmap",
                "total_topics": 0,
                "estimated_hours": 0,
                "phases": [
                    {
                        "phase_name": "Foundation",
                        "description": "Core concepts",
                        "difficulty": "beginner",
                        "units": [
                            {
                                "unit_title": "Unit Name",
                                "topics": [
                                    {
                                        "title": "Topic Name",
                                        "priority": "high|medium|low",
                                        "difficulty": "beginner|intermediate|advanced",
                                        "estimated_minutes": 30,
                                        "importance_score": 0.8,
                                        "order": 1
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        
        Rules:
        1. Start with foundational/prerequisite topics
        2. Group related topics together  
        3. High importance (PYQ) topics should be covered early
        4. Progressive difficulty (beginner → advanced)
        5. Include estimated time for each topic`;

    const prompt = `Create an optimized learning roadmap from this structure:

${JSON.stringify(structure).slice(0, 6000)}

Design the roadmap with:
- Progressive difficulty levels
- Priority-based ordering (high PYQ frequency = earlier)
- Prerequisite awareness
- Time estimates`;

    const result = await llmService.generateJson(prompt, { systemPrompt, temperature: 0.3, maxTokens: 4000 });

    const roadmap = result.roadmap || result;

    let totalTopics = 0;
    let totalMinutes = 0;
    for (const phase of roadmap.phases || []) {
      for (const unit of phase.units || []) {
        for (const topic of unit.topics || []) {
          totalTopics += 1;
          totalMinutes += topic.estimated_minutes || 30;
        }
      }
    }

    roadmap.total_topics = totalTopics;
    roadmap.estimated_hours = Math.round((totalMinutes / 60) * 10) / 10;

    return roadmap;
  }
}

module.exports = RoadmapAgent;
