const { BaseAgent, AgentResult } = require("./base");
const llmService = require("../services/llmService");
const vectorStore = require("../services/vectorStore");

class DoubtAgent extends BaseAgent {
  constructor() {
    super("doubt_agent", "Context-aware Q&A for student doubts");
  }

  async execute(context) {
    const courseId = context.courseId;
    const question = context.get("question", "");
    const topicTitle = context.get("topic_title", "");
    const chatHistory = context.get("chat_history", []);

    if (!question) {
      return new AgentResult({ success: false, error: "No question provided" });
    }

    const searchQuery = topicTitle ? `${topicTitle}: ${question}` : question;
    const relevantContent = await vectorStore.search(courseId, searchQuery, 6);

    const sourceContent = relevantContent
      .filter((r) => r.score > 0.25)
      .map((r) => `[Source: ${(r.metadata && r.metadata.filename) || "unknown"}]\n${r.text}`)
      .join("\n\n");

    const answer = await this._answerDoubt(question, topicTitle, sourceContent, chatHistory);

    return new AgentResult({
      success: true,
      data: {
        answer,
        sources_used: relevantContent.slice(0, 3).map((r) => ({
          text: r.text.slice(0, 200),
          score: r.score,
          file: (r.metadata && r.metadata.filename) || "",
        })),
      },
    });
  }

  async _answerDoubt(question, topic, source, history) {
    const systemPrompt = `You are a helpful tutor answering student doubts.

Rules:
1. Answer ONLY based on the provided source material
2. If the answer isn't in the sources, say so honestly
3. Be clear and concise
4. Use examples when helpful
5. If it's a follow-up question, consider the chat history`;

    let historyStr = "";
    if (history.length) {
      const recent = history.slice(-6); // last 3 exchanges
      historyStr = "\nPrevious conversation:\n";
      for (const msg of recent) {
        const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        historyStr += `${role}: ${msg.content}\n`;
      }
    }

    const prompt = `Topic: ${topic}
${historyStr}
Student's Question: ${question}

Source Material:
${source.slice(0, 4000)}

Provide a clear, helpful answer:`;

    return llmService.generate(prompt, {
      systemPrompt,
      temperature: 0.4,
      maxTokens: 1500,
      useCache: false, // doubts are contextual, don't cache — matches Python exactly
    });
  }
}

module.exports = DoubtAgent;
