const { BaseAgent, AgentResult } = require("./base");
const llmService = require("../services/llmService");

class EvaluationAgent extends BaseAgent {
  constructor() {
    super("evaluation_agent", "Evaluates quiz answers and identifies weak areas");
  }

  async execute(context) {
    const questions = context.get("questions", []);
    const userAnswers = context.get("user_answers", {}); // { "questionIndex": answer }
    const topicTitle = context.get("topic_title", "");

    if (!questions.length || !Object.keys(userAnswers).length) {
      return new AgentResult({ success: false, error: "No questions or answers to evaluate" });
    }

    const results = [];
    let totalScore = 0;
    let maxScore = 0;
    const weakAreas = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const qId = String(i);
      const userAnswer = userAnswers[qId] || "";
      const correctAnswer = question.correct_answer || "";
      const qType = question.type || "mcq";
      const points = question.points || 1;
      maxScore += points;

      let evaluation;
      if (qType === "mcq") {
        evaluation = this._evaluateMcq(userAnswer, correctAnswer);
      } else {
        evaluation = await this._evaluateOpenAnswer(question.question, userAnswer, correctAnswer, qType);
      }

      const score = evaluation.correct ? points : points * (evaluation.partial_credit || 0);
      totalScore += score;

      results.push({
        question_index: i,
        question: question.question,
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        is_correct: evaluation.correct,
        score,
        max_score: points,
        feedback: evaluation.feedback || "",
      });

      if (!evaluation.correct) {
        weakAreas.push({
          question: question.question,
          topic: topicTitle,
          type: qType,
          feedback: evaluation.feedback || "",
        });
      }
    }

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    return new AgentResult({
      success: true,
      data: {
        results,
        total_score: totalScore,
        max_score: maxScore,
        percentage: Math.round(percentage * 10) / 10, // matches Python's round(x, 1)
        weak_areas: weakAreas,
        topic: topicTitle,
      },
      nextAgent: "adaptive_agent",
    });
  }

  /**
   * Ports _evaluate_mcq: normalizes to first-character-uppercase match
   * OR full lowercase text match — either passes.
   */
  _evaluateMcq(userAnswer, correctAnswer) {
    const userClean = userAnswer ? userAnswer.trim().toUpperCase().slice(0, 1) : "";
    const correctClean = correctAnswer ? correctAnswer.trim().toUpperCase().slice(0, 1) : "";

    const isCorrect =
      userClean === correctClean || userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

    return {
      correct: isCorrect,
      feedback: isCorrect ? "Correct!" : `Incorrect. The correct answer is: ${correctAnswer}`,
    };
  }

  async _evaluateOpenAnswer(question, userAnswer, correctAnswer, qType) {
    if (!userAnswer.trim()) {
      return { correct: false, partial_credit: 0, feedback: "No answer provided." };
    }

    const systemPrompt = `You are an expert evaluator. Assess the student's answer against 
        the correct answer.
        
        Return a JSON object:
        {
            "correct": true/false,
            "partial_credit": 0.0 to 1.0,
            "feedback": "Specific feedback about what's right/wrong"
        }
        
        Rules:
        - Award partial credit for partially correct answers
        - Consider semantic correctness, not just exact wording
        - Be fair but maintain standards
        - Provide constructive feedback`;

    const prompt = `Question: ${question}
        
Correct Answer: ${correctAnswer}

Student's Answer: ${userAnswer}

Evaluate the student's answer:`;

    const result = await llmService.generateJson(prompt, { systemPrompt, temperature: 0.2 });

    return {
      correct: result.correct || false,
      partial_credit: result.partial_credit || 0,
      feedback: result.feedback || "",
    };
  }
}

module.exports = EvaluationAgent;
