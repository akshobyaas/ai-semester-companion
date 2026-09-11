const { BaseAgent, AgentResult } = require("./base");
const llmService = require("../services/llmService");
const vectorStore = require("../services/vectorStore");

const DEPTH_GUIDE = {
  beginner: "Use simple language, lots of analogies, step-by-step explanations.",
  intermediate: "Balanced depth, include technical details with clear explanations.",
  advanced: "Deep technical content, advanced concepts, edge cases.",
};

class TeachingAgent extends BaseAgent {
  constructor() {
    super("teaching_agent", "Generates topic explanations grounded in uploaded materials");
  }

  async execute(context) {
    const courseId = context.courseId;
    const topicTitle = context.get("topic_title", "");
    const topicDescription = context.get("topic_description", "");
    const difficulty = context.get("difficulty", "intermediate");
    const subtopics = context.get("subtopics", []);

    if (!topicTitle) {
      return new AgentResult({ success: false, error: "No topic specified" });
    }

    const relevantContent = await vectorStore.search(courseId, `${topicTitle} ${topicDescription}`, 8);
    const sourceContent = relevantContent
      .filter((r) => r.score > 0.3)
      .map((r) => r.text)
      .join("\n\n");

    const explanation = await this._generateExplanation(
      topicTitle,
      topicDescription,
      subtopics,
      sourceContent,
      difficulty
    );
    const keyPoints = await this._generateKeyPoints(topicTitle, sourceContent);
    const examples = await this._generateExamples(topicTitle, sourceContent);
    const memoryTricks = await this._generateMemoryTricks(topicTitle, keyPoints);

    return new AgentResult({
      success: true,
      data: {
        explanation,
        key_points: keyPoints,
        examples,
        memory_tricks: memoryTricks,
        source_context: sourceContent.slice(0, 500),
      },
    });
  }

  async _generateExplanation(title, description, subtopics, source, difficulty) {
    const systemPrompt = `You are an expert teacher. Explain topics clearly and thoroughly 
        using ONLY the provided source material. Do not add information not found in the sources.
        
        Difficulty Level: ${difficulty}
        Teaching style: ${DEPTH_GUIDE[difficulty] || DEPTH_GUIDE.intermediate}
        
        Structure your explanation with:
        1. Introduction/Overview
        2. Core concepts explained
        3. Detailed breakdown of subtopics
        4. Connections between concepts
        5. Summary`;

    const subtopicsStr = subtopics.length ? subtopics.map((st) => `- ${st}`).join("\n") : "N/A";

    const prompt = `Explain the following topic comprehensively:

TOPIC: ${title}
DESCRIPTION: ${description}
SUBTOPICS:
${subtopicsStr}

SOURCE MATERIAL:
${source.slice(0, 5000)}

Generate a clear, well-structured explanation.`;

    return llmService.generate(prompt, { systemPrompt, temperature: 0.5, maxTokens: 3000 });
  }

  async _generateKeyPoints(title, source) {
    const prompt = `Extract 5-8 key points for the topic "${title}" from this content:

${source.slice(0, 3000)}

Return as JSON: {"key_points": ["point 1", "point 2", ...]}`;

    const result = await llmService.generateJson(prompt, {
      systemPrompt: "Extract concise, memorable key points.",
      temperature: 0.3,
    });
    return result.key_points || [];
  }

  async _generateExamples(title, source) {
    const prompt = `Generate 2-3 practical examples for "${title}" based on this content:

${source.slice(0, 3000)}

Return as JSON: {"examples": [{"title": "Example 1", "content": "detailed example"}]}`;

    const result = await llmService.generateJson(prompt, {
      systemPrompt: "Generate clear, practical examples that aid understanding.",
      temperature: 0.5,
    });
    return result.examples || [];
  }

  async _generateMemoryTricks(title, keyPoints) {
    const pointsStr = keyPoints
      .slice(0, 5)
      .map((p) => `- ${p}`)
      .join("\n");

    const prompt = `Generate 2-3 memory tricks/mnemonics for remembering the key concepts of "${title}":

Key Points:
${pointsStr}

Return as JSON: {"memory_tricks": ["trick 1", "trick 2"]}`;

    const result = await llmService.generateJson(prompt, {
      systemPrompt: "Create memorable mnemonics, acronyms, or memory aids.",
      temperature: 0.7,
    });
    return result.memory_tricks || [];
  }
}

module.exports = TeachingAgent;
