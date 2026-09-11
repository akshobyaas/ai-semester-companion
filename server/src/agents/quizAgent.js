const { BaseAgent, AgentResult } = require("./base");
const llmService = require("../services/llmService");
const vectorStore = require("../services/vectorStore");

const TYPE_INSTRUCTIONS = {
  mcq: "Multiple choice with 4 options (A, B, C, D). Include realistic distractors.",
  short_answer: "Questions requiring 1-3 sentence answers.",
  conceptual: "Questions testing deep understanding, application, or analysis.",
};

class QuizAgent extends BaseAgent {
  constructor() {
    super("quiz_agent", "Generates assessment quizzes from course material");
  }

  async execute(context) {
    const courseId = context.courseId;
    const topicTitle = context.get("topic_title", "");
    const numQuestions = context.get("num_questions", 5);
    const difficulty = context.get("difficulty", "intermediate");
    const questionTypes = context.get("question_types", ["mcq", "short_answer"]);

    if (!topicTitle) {
      return new AgentResult({ success: false, error: "No topic specified" });
    }

    const relevantContent = await vectorStore.search(courseId, topicTitle, 8);
    const sourceContent = relevantContent
      .filter((r) => r.score > 0.3)
      .map((r) => r.text)
      .join("\n\n");

    const questions = await this._generateQuestions(
      topicTitle,
      sourceContent,
      numQuestions,
      difficulty,
      questionTypes
    );

    return new AgentResult({
      success: true,
      data: { questions, topic: topicTitle, difficulty },
    });
  }

  async _generateQuestions(topic, source, numQuestions, difficulty, questionTypes) {
    const typesStr = questionTypes.map((qt) => `- ${qt}: ${TYPE_INSTRUCTIONS[qt] || ""}`).join("\n");

    const systemPrompt = `You are an expert question paper designer. Generate high-quality 
        assessment questions based on the provided material.
        
        Return a JSON object:
        {
            "questions": [
                {
                    "type": "mcq|short_answer|conceptual",
                    "question": "Question text",
                    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],  // only for MCQ
                    "correct_answer": "The correct answer",
                    "explanation": "Why this is correct",
                    "difficulty": "beginner|intermediate|advanced",
                    "points": 1
                }
            ]
        }
        
        IMPORTANT:
        - Questions must be answerable from the source material
        - MCQ distractors should be plausible but clearly wrong
        - Vary question complexity
        - Include explanations for each answer`;

    const prompt = `Generate ${numQuestions} questions about "${topic}"

Difficulty: ${difficulty}
Question Types Required:
${typesStr}

Source Material:
${source.slice(0, 5000)}

Generate diverse, high-quality questions:`;

    const result = await llmService.generateJson(prompt, {
      systemPrompt,
      temperature: 0.6,
      maxTokens: 4000,
    });

    const questions = result.questions || [];

    return questions.map((q, i) => {
      const cleaned = {
        type: q.type || "mcq",
        question: q.question || "",
        correct_answer: q.correct_answer || "",
        explanation: q.explanation || "",
        difficulty: q.difficulty || difficulty,
        points: q.points || 1,
        order: i + 1,
      };
      if (q.type === "mcq") {
        cleaned.options = q.options || [];
      }
      return cleaned;
    });
  }
}

module.exports = QuizAgent;
