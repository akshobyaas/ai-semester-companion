const { BaseAgent, AgentResult } = require("./base");
const { createDefaultHiclaw } = require("./runtime");

const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"];

class AdaptiveAgent extends BaseAgent {
  constructor() {
    super("adaptive_agent", "Adapts learning path based on student performance");
    this.hiclaw = createDefaultHiclaw();
  }

  async execute(context) {
    const percentage = context.get("evaluation_agent.percentage", 0);
    const weakAreas = context.get("evaluation_agent.weak_areas", []);
    const currentDifficulty = context.get("current_difficulty", "intermediate");
    const topicsCompleted = context.get("topics_completed", 0);
    const topicsTotal = context.get("topics_total", 0);
    const consecutiveHigh = context.get("consecutive_high_scores", 0);

    context.set("last_quiz_score", percentage);
    context.set("consecutive_high_scores", consecutiveHigh);
    context.set("topics_completed", topicsCompleted);
    context.set("topics_total", topicsTotal);

    const action = this.hiclaw.getAction(context);

    const recommendation = await this._makeRecommendation({
      action,
      percentage,
      weakAreas,
      currentDifficulty,
      topicsCompleted,
      topicsTotal,
    });

    return new AgentResult({
      success: true,
      data: {
        action: action || "continue",
        recommendation,
        percentage,
        weak_areas: weakAreas,
      },
    });
  }

  async _makeRecommendation({ action, percentage, weakAreas, currentDifficulty, topicsCompleted, topicsTotal }) {
    const recommendation = {
      action: action || "continue",
      reasoning: "",
      difficulty_adjustment: null,
      revision_topics: [],
      next_steps: [],
    };

    if (action === "revision") {
      recommendation.reasoning = `Your score (${percentage}%) indicates significant gaps. Let's revisit the weak areas before moving forward.`;
      recommendation.revision_topics = weakAreas.map((w) => w.topic || "");
      recommendation.next_steps = [
        "Review the concepts you struggled with",
        "Focus on understanding, not memorization",
        "Retake the quiz after revision",
      ];
    } else if (action === "adaptive_revision") {
      recommendation.reasoning = `Your score (${percentage}%) shows some understanding but room for improvement. Let's strengthen specific areas.`;
      recommendation.revision_topics = weakAreas.slice(0, 3).map((w) => w.topic || "");
      recommendation.next_steps = ["Quick review of weak areas", "Practice targeted questions", "Then continue to next topic"];
    } else if (action === "level_up") {
      const newDifficulty = this._nextDifficulty(currentDifficulty);
      recommendation.reasoning = `Excellent performance (${percentage}%)! Increasing difficulty to ${newDifficulty}.`;
      recommendation.difficulty_adjustment = newDifficulty;
      recommendation.next_steps = [`Moving to ${newDifficulty} level content`, "More challenging questions ahead", "Keep up the great work!"];
    } else if (action === "course_complete") {
      recommendation.reasoning = `Congratulations! You've completed all ${topicsTotal} topics!`;
      recommendation.next_steps = ["Review any remaining weak areas", "Take a comprehensive final test", "Celebrate your achievement!"];
    } else {
      recommendation.reasoning = `Good performance (${percentage}%). Moving to the next topic.`;
      recommendation.next_steps = ["Proceeding to the next topic in your roadmap", `Progress: ${topicsCompleted}/${topicsTotal} topics`];
    }

    return recommendation;
  }

  _nextDifficulty(current) {
    const idx = DIFFICULTY_LEVELS.includes(current) ? DIFFICULTY_LEVELS.indexOf(current) : 1;
    return DIFFICULTY_LEVELS[Math.min(idx + 1, DIFFICULTY_LEVELS.length - 1)];
  }
}

module.exports = AdaptiveAgent;
