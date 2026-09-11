import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import { learningAPI, quizAPI } from "../api/client.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

/**
 * Per-question correctness can't be revealed until the whole quiz is
 * submitted — the backend deliberately never sends correct_answer in the
 * quiz payload (confirmed in Phase 11's security test), so instant
 * per-question feedback would require exposing answers early. The
 * "instant feedback" moment here is the results screen right after
 * submit, where the backend DOES return full per-question feedback.
 */
export default function QuizPage() {
  usePageTitle("Quiz");
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedTopic = searchParams.get("topic");

  const [stage, setStage] = useState("picking"); // picking -> taking -> results
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState(preselectedTopic || "");
  const [quiz, setQuiz] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    learningAPI
      .getUnits(courseId)
      .then((res) => setTopics(res.data.flatMap((u) => u.topics)))
      .catch(() => {});
  }, [courseId]);

  const startQuiz = async () => {
    if (!topicId) {
      setError("Pick a topic first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await quizAPI.generateQuiz({ topic_id: topicId, num_questions: 5 });
      setQuiz(res.data);
      setAnswers({});
      setCurrent(0);
      setStage("taking");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't generate a quiz for this topic.");
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        quiz_id: quiz.id,
        answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })),
      };
      const res = await quizAPI.submitQuiz(payload);
      setResult(res.data);
      setStage("results");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit the quiz.");
    } finally {
      setLoading(false);
    }
  };

  if (stage === "picking") {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 sm:px-8 py-10">
          <h1 className="font-display text-2xl font-bold text-ink-900 mb-6">Start a quiz</h1>
          {error && <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100 mb-4"
          >
            <option value="">Choose a topic…</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            onClick={startQuiz}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-display font-semibold text-lg transition disabled:opacity-50"
          >
            {loading ? "Building your quiz…" : "Start quiz"}
          </button>
        </div>
      </AppShell>
    );
  }

  if (stage === "taking") {
    const q = quiz.questions[current];
    const isLast = current === quiz.questions.length - 1;
    const answered = answers[q.id] != null && answers[q.id] !== "";

    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 sm:px-8 py-10">
          <div className="w-full h-2 bg-primary-50 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all"
              style={{ width: `${((current + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>

          <p className="text-ink-400 text-sm mb-2">
            Question {current + 1} of {quiz.questions.length}
          </p>
          <h2 className="font-display font-semibold text-xl text-ink-900 mb-6">{q.question_text}</h2>

          {q.question_type === "mcq" && q.options ? (
            <div className="space-y-3 mb-8">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                  className={`w-full text-left px-5 py-3.5 rounded-2xl border-2 transition ${
                    answers[q.id] === opt
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-primary-100 hover:border-primary-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              value={answers[q.id] || ""}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              rows={4}
              placeholder="Type your answer…"
              className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100 mb-8"
            />
          )}

          {error && <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</div>}

          <button
            onClick={() => (isLast ? submitQuiz() : setCurrent(current + 1))}
            disabled={!answered || loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-display font-semibold text-lg transition disabled:opacity-50"
          >
            {loading ? "Scoring…" : isLast ? "Submit quiz" : "Next"}
            {!loading && <ArrowRight size={20} />}
          </button>
        </div>
      </AppShell>
    );
  }

  // results
  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 sm:px-8 py-10">
        <div className="text-center mb-8">
          <p className="font-display text-5xl font-bold text-primary-600">{Math.round(result.percentage)}%</p>
          <p className="text-ink-400 mt-1">
            {result.score} / {result.max_score} points
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {result.feedback.map((f, i) => (
            <div key={i} className={`p-4 rounded-2xl border ${f.is_correct ? "bg-primary-50 border-primary-100" : "bg-red-50 border-red-100"}`}>
              <div className="flex items-start gap-2">
                {f.is_correct ? (
                  <CheckCircle2 className="text-primary-500 shrink-0 mt-0.5" size={18} />
                ) : (
                  <XCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                )}
                <div>
                  <p className="font-medium text-ink-900 text-sm">{f.question}</p>
                  {!f.is_correct && <p className="text-ink-600 text-sm mt-1">Correct answer: {f.correct_answer}</p>}
                  {f.feedback && <p className="text-ink-400 text-xs mt-1">{f.feedback}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Link
          to={`/course/${courseId}`}
          className="block text-center py-3.5 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-display font-semibold transition"
        >
          Back to course
        </Link>
      </div>
    </AppShell>
  );
}
