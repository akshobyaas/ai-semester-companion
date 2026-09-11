const { BaseAgent, AgentResult } = require("./base");
const llmService = require("../services/llmService");

class KnowledgeExtractionAgent extends BaseAgent {
  constructor() {
    super("knowledge_extraction_agent", "Extracts structured knowledge graph from documents");
  }

  async execute(context) {
    const processedDocs = context.get("ingestion_agent.processed_documents", []);

    if (!processedDocs.length) {
      return new AgentResult({ success: false, error: "No processed documents available" });
    }

    let syllabusText = "";
    let notesText = "";
    let pyqText = "";

    for (const doc of processedDocs) {
      if (doc.doc_type === "syllabus") syllabusText += doc.extracted_text + "\n\n";
      else if (doc.doc_type === "notes") notesText += doc.extracted_text + "\n\n";
      else if (doc.doc_type === "pyq") pyqText += doc.extracted_text + "\n\n";
    }

    const knowledgeStructure = await this._extractStructure(syllabusText, notesText);

    if (knowledgeStructure) {
      const dependencies = await this._buildDependencies(knowledgeStructure);
      knowledgeStructure.dependencies = dependencies;
    }

    return new AgentResult({
      success: true,
      data: {
        knowledge_structure: knowledgeStructure,
        syllabus_text: syllabusText,
        notes_text: notesText,
        pyq_text: pyqText,
      },
      nextAgent: "weightage_analysis_agent",
    });
  }

  async _extractStructure(syllabus, notes) {
    const systemPrompt = `You are an expert curriculum analyst. Extract the complete 
        knowledge structure from the given syllabus and notes.
        
        Return a JSON object with this exact structure:
        {
            "units": [
                {
                    "title": "Unit Title",
                    "description": "Brief description",
                    "order": 1,
                    "topics": [
                        {
                            "title": "Topic Title",
                            "description": "Brief description",
                            "order": 1,
                            "difficulty": "beginner|intermediate|advanced",
                            "estimated_minutes": 30,
                            "subtopics": [
                                {
                                    "title": "Subtopic Title",
                                    "order": 1
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        
        Be thorough and extract ALL units, topics, and subtopics mentioned.`;

    const prompt = `Extract the complete knowledge structure from these documents:

SYLLABUS:
${syllabus.slice(0, 4000)}

NOTES (excerpt):
${notes.slice(0, 4000)}

Return the complete hierarchical structure as JSON.`;

    return llmService.generateJson(prompt, { systemPrompt, temperature: 0.2, maxTokens: 4000 });
  }

  async _buildDependencies(structure) {
    const topics = [];
    for (const unit of structure.units || []) {
      for (const topic of unit.topics || []) {
        topics.push(topic.title);
      }
    }

    if (!topics.length) return [];

    const systemPrompt = `You are an expert in curriculum design. Given a list of topics,
        identify prerequisite relationships between them.
        
        Return a JSON object:
        {
            "dependencies": [
                {"topic": "Topic B", "requires": ["Topic A"]},
                {"topic": "Topic C", "requires": ["Topic A", "Topic B"]}
            ]
        }
        
        Only include dependencies where one topic truly requires knowledge of another.`;

    const prompt = `Topics: ${topics.join(", ")}\n\nIdentify prerequisites:`;

    const result = await llmService.generateJson(prompt, { systemPrompt, temperature: 0.2 });
    return result.dependencies || [];
  }
}

module.exports = KnowledgeExtractionAgent;
