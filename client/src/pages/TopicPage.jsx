import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, Lightbulb, BookOpen, Brain, ArrowRight } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import { learningAPI } from "../api/client.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export default function TopicPage() {
  const { courseId, topicId } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  usePageTitle(topic?.title || "Lesson");

  useEffect(() => {
    setLoading(true);
    // First load may take a moment — the backend lazily generates content
    // on first view via the teaching agent (Phase 10), not pre-computed.
    learningAPI
      .getTopicContent(topicId)
      .then((res) => setTopic(res.data))
      .catch(() => setError("Couldn't load this topic."))
      .finally(() => setLoading(false));
  }, [topicId]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await learningAPI.markComplete(topicId);
      const next = await learningAPI.getNextTopic(courseId, topicId);
      if (next.data.next_topic_id) {
        navigate(`/course/${courseId}/topic/${next.data.next_topic_id}`);
      } else {
        navigate(`/course/${courseId}`);
      }
    } catch {
      setError("Couldn't mark this complete. Try again.");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16 text-center text-ink-400">
          <BookOpen className="mx-auto mb-3 text-primary-300 animate-pulse" size={32} />
          <p>Preparing this lesson…</p>
        </div>
      </AppShell>
    );
  }

  if (error || !topic) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16 text-center text-ink-400">
          <p>{error || "Topic not found."}</p>
          <Link to={`/course/${courseId}`} className="text-primary-600 font-medium mt-2 inline-block">
            Back to course
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-10">
        <p className="text-primary-600 text-sm font-medium uppercase tracking-wide mb-1">{topic.difficulty}</p>
        <h1 className="font-display text-3xl font-bold text-ink-900 mb-2">{topic.title}</h1>
        {topic.description && <p className="text-ink-400 mb-8">{topic.description}</p>}

        <div className="prose prose-p:text-ink-900 prose-p:leading-relaxed max-w-none mb-8 whitespace-pre-wrap">
          {topic.content}
        </div>

        {topic.key_points?.length > 0 && (
          <div className="bg-primary-50 rounded-3xl p-6 mb-6">
            <h2 className="flex items-center gap-2 font-display font-semibold text-ink-900 mb-3">
              <BookOpen size={18} className="text-primary-600" /> Key points
            </h2>
            <ul className="space-y-2">
              {topic.key_points.map((kp, i) => (
                <li key={i} className="flex items-start gap-2 text-ink-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 shrink-0" />
                  {kp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {topic.examples?.length > 0 && (
          <div className="bg-white border border-primary-100 rounded-3xl p-6 mb-6">
            <h2 className="flex items-center gap-2 font-display font-semibold text-ink-900 mb-3">
              <Lightbulb size={18} className="text-accent-500" /> Examples
            </h2>
            <div className="space-y-4">
              {topic.examples.map((ex, i) => (
                <div key={i}>
                  <p className="font-medium text-ink-900 text-sm">{ex.title}</p>
                  <p className="text-ink-600 text-sm mt-1">{ex.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {topic.memory_tricks?.length > 0 && (
          <div className="bg-accent-400/10 rounded-3xl p-6 mb-8">
            <h2 className="flex items-center gap-2 font-display font-semibold text-ink-900 mb-3">
              <Brain size={18} className="text-accent-600" /> Memory tricks
            </h2>
            <ul className="space-y-2">
              {topic.memory_tricks.map((mt, i) => (
                <li key={i} className="text-ink-900 text-sm">
                  {mt}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</div>}

        <button
          onClick={handleComplete}
          disabled={completing}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-display font-semibold text-lg transition disabled:opacity-50"
        >
          <CheckCircle2 size={20} />
          {completing ? "Saving…" : "Mark complete & continue"}
          {!completing && <ArrowRight size={20} />}
        </button>
      </div>
    </AppShell>
  );
}
