import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TrendingUp, Target, Clock } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import { adaptiveAPI } from "../api/client.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export default function AnalyticsPage() {
  usePageTitle("Analytics");
  const { courseId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adaptiveAPI
      .getAnalytics(courseId)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <AppShell>
        <div className="px-4 sm:px-8 py-10 text-ink-400">Loading analytics…</div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="px-4 sm:px-8 py-10 text-ink-400">No analytics available yet.</div>
      </AppShell>
    );
  }

  const maxHistoryScore = Math.max(...(data.score_history.map((h) => h.score) || [100]), 100);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-8">Your progress</h1>

        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-white border border-primary-100 rounded-3xl p-6">
            <Target className="text-primary-500 mb-2" size={20} />
            <p className="font-display text-2xl font-bold text-ink-900">{data.completion_percentage}%</p>
            <p className="text-ink-400 text-sm">
              {data.completed_topics}/{data.total_topics} topics
            </p>
          </div>
          <div className="bg-white border border-primary-100 rounded-3xl p-6">
            <TrendingUp className="text-primary-500 mb-2" size={20} />
            <p className="font-display text-2xl font-bold text-ink-900">{data.average_score}%</p>
            <p className="text-ink-400 text-sm">avg. score</p>
          </div>
          <div className="bg-white border border-primary-100 rounded-3xl p-6">
            <Clock className="text-primary-500 mb-2" size={20} />
            <p className="font-display text-2xl font-bold text-ink-900">{data.total_time_spent_minutes}</p>
            <p className="text-ink-400 text-sm">minutes studied</p>
          </div>
        </div>

        {data.score_history.length > 0 && (
          <div className="bg-white border border-primary-100 rounded-3xl p-6 mb-8">
            <h2 className="font-display font-semibold text-ink-900 mb-4">Quiz scores over time</h2>
            <div className="flex items-end gap-2 h-32">
              {data.score_history.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div
                    className="w-full bg-primary-400 rounded-t-lg transition-all"
                    style={{ height: `${(h.score / maxHistoryScore) * 100}%`, minHeight: "4px" }}
                    title={`${h.score}%`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-primary-100 rounded-3xl p-6">
            <h3 className="font-display font-semibold text-ink-900 mb-3">Strong areas</h3>
            {data.strong_areas.length === 0 ? (
              <p className="text-ink-400 text-sm">None yet — keep going!</p>
            ) : (
              <ul className="space-y-1.5">
                {data.strong_areas.map((a, i) => (
                  <li key={i} className="text-sm text-primary-700 bg-primary-50 rounded-xl px-3 py-1.5">
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white border border-primary-100 rounded-3xl p-6">
            <h3 className="font-display font-semibold text-ink-900 mb-3">Needs work</h3>
            {data.weak_areas.length === 0 ? (
              <p className="text-ink-400 text-sm">Nothing flagged.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.weak_areas.map((a, i) => (
                  <li key={i} className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-1.5">
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
