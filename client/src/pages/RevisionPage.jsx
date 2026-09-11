import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Sparkles } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import { revisionAPI } from "../api/client.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

const TYPES = [
  { value: "cheat_sheet", label: "Cheat sheet" },
  { value: "formula_sheet", label: "Formula sheet" },
  { value: "quick_notes", label: "Quick notes" },
  { value: "exam_summary", label: "Exam summary" },
];

export default function RevisionPage() {
  usePageTitle("Revision");
  const { courseId } = useParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("cheat_sheet");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const load = () => {
    revisionAPI
      .list(courseId)
      .then((res) => setLogs(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [courseId]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError("");
    try {
      const res = await revisionAPI.generate({ course_id: courseId, revision_type: type, topic: topic || undefined });
      setLogs([res.data, ...logs]);
      setSelected(res.data);
      setTopic("");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't generate revision notes.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-4 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <form onSubmit={handleGenerate} className="bg-white border border-primary-100 rounded-3xl p-5 mb-4 space-y-3">
            <h2 className="font-display font-semibold text-ink-900">New revision notes</h2>
            {error && <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs">{error}</div>}
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl border border-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (optional)"
              className="w-full px-3 py-2.5 rounded-2xl border border-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100 text-sm"
            />
            <button
              type="submit"
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm transition disabled:opacity-50"
            >
              <Sparkles size={14} />
              {generating ? "Generating…" : "Generate"}
            </button>
          </form>

          <div className="space-y-2">
            {logs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelected(log)}
                className={`w-full text-left px-4 py-3 rounded-2xl border transition ${
                  selected?.id === log.id ? "border-primary-500 bg-primary-50" : "border-primary-100 bg-white hover:border-primary-300"
                }`}
              >
                <p className="text-sm font-medium text-ink-900 truncate">{log.topic}</p>
                <p className="text-xs text-ink-400">{TYPES.find((t) => t.value === log.revision_type)?.label}</p>
              </button>
            ))}
            {!loading && logs.length === 0 && <p className="text-ink-400 text-sm px-2">No revision notes yet.</p>}
          </div>
        </div>

        <div className="md:col-span-2">
          {selected ? (
            <div className="bg-white border border-primary-100 rounded-3xl p-8">
              <div className="flex items-center gap-2 mb-4 text-primary-600">
                <FileText size={18} />
                <span className="text-sm font-medium">{TYPES.find((t) => t.value === selected.revision_type)?.label}</span>
              </div>
              <div className="whitespace-pre-wrap text-ink-900 leading-relaxed">{selected.content}</div>
            </div>
          ) : (
            <div className="text-center py-20 text-ink-400 bg-white border border-dashed border-primary-200 rounded-3xl">
              Generate or select a set of notes to view it here.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
