import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Upload, Sparkles, CheckCircle2, Circle, PlayCircle, MessageCircle, BarChart3, Layers, ListChecks, FileText } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import { ingestionAPI, learningAPI } from "../api/client.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { useAppStore } from "../store/useAppStore.js";

const DOC_TYPES = [
  { value: "syllabus", label: "Syllabus" },
  { value: "notes", label: "Notes" },
  { value: "pyq", label: "Past year questions" },
  { value: "other", label: "Other" },
];

export default function CoursePage() {
  const { courseId } = useParams();
  const courses = useAppStore((s) => s.courses);
  const courseTitle = courses.find((c) => c.id === courseId)?.title;
  usePageTitle(courseTitle || "Course");
  const [units, setUnits] = useState(null);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [progress, setProgress] = useState(null);

  const [files, setFiles] = useState([]);
  const [docType, setDocType] = useState("notes");
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const loadUnits = useCallback(() => {
    setLoadingUnits(true);
    learningAPI
      .getUnits(courseId)
      .then((res) => setUnits(res.data))
      .catch(() => setUnits([]))
      .finally(() => setLoadingUnits(false));
    learningAPI
      .getProgress(courseId)
      .then((res) => setProgress(res.data))
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.length) {
      setError("Choose at least one file to upload.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      await ingestionAPI.uploadDocuments(courseId, files, docType);
      setStatusMsg(`${files.length} file(s) uploaded. Ready to build your roadmap.`);
      setFiles([]);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async () => {
    setError("");
    setProcessing(true);
    setStatusMsg("Building your roadmap — this reads your documents and designs a study path…");
    try {
      await ingestionAPI.processCourse(courseId);
      setStatusMsg("Roadmap ready!");
      loadUnits();
    } catch (err) {
      setError(err.response?.data?.detail || "Processing failed.");
      setStatusMsg("");
    } finally {
      setProcessing(false);
    }
  };

  const topicStatus = (topicId) => {
    const t = progress?.topics?.find((pt) => pt.topic_id === topicId || pt.topic_id?.toString?.() === topicId);
    return t?.status || "not_started";
  };

  const hasRoadmap = units && units.length > 0;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <Link to={`/course/${courseId}/quiz`} className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-primary-100 text-ink-600 hover:border-primary-300 transition text-sm font-medium">
            <ListChecks size={16} /> Quiz
          </Link>
          <Link to={`/course/${courseId}/flashcards`} className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-primary-100 text-ink-600 hover:border-primary-300 transition text-sm font-medium">
            <Layers size={16} /> Flashcards
          </Link>
          <Link to={`/course/${courseId}/revision`} className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-primary-100 text-ink-600 hover:border-primary-300 transition text-sm font-medium">
            <FileText size={16} /> Revision
          </Link>
          <Link to={`/course/${courseId}/chat`} className="ml-auto flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-primary-100 text-ink-600 hover:border-primary-300 transition text-sm font-medium">
            <MessageCircle size={16} /> Ask a doubt
          </Link>
          <Link to={`/course/${courseId}/analytics`} className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-primary-100 text-ink-600 hover:border-primary-300 transition text-sm font-medium">
            <BarChart3 size={16} /> Analytics
          </Link>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</div>}
        {statusMsg && !error && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-primary-50 text-primary-700 text-sm flex items-center gap-2">
            <Sparkles size={16} /> {statusMsg}
          </div>
        )}

        {/* Upload panel — always available so more material can be added later */}
        <form onSubmit={handleUpload} className="bg-white border border-primary-100 rounded-3xl p-6 mb-8">
          <h2 className="font-display font-semibold text-lg text-ink-900 mb-4">Add course material</h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="px-4 py-3 rounded-2xl border border-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files))}
              className="flex-1 text-sm text-ink-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-2xl file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition disabled:opacity-50"
            >
              <Upload size={16} />
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button
              type="button"
              onClick={handleProcess}
              disabled={processing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-semibold transition disabled:opacity-50"
            >
              <Sparkles size={16} />
              {processing ? "Building…" : "Build roadmap"}
            </button>
          </div>
        </form>

        {/* Roadmap path */}
        {loadingUnits ? (
          <p className="text-ink-400">Loading roadmap…</p>
        ) : !hasRoadmap ? (
          <div className="text-center py-16 bg-white border border-dashed border-primary-200 rounded-3xl">
            <p className="text-ink-600 font-medium">No roadmap yet</p>
            <p className="text-ink-400 text-sm mt-1">Upload your syllabus/notes above, then click "Build roadmap".</p>
          </div>
        ) : (
          <div className="space-y-10">
            {units.map((unit) => (
              <div key={unit.id}>
                <h3 className="font-display font-bold text-xl text-ink-900 mb-4">{unit.title}</h3>
                <div className="relative pl-6 border-l-2 border-primary-100 space-y-3">
                  {unit.topics.map((topic) => {
                    const status = topicStatus(topic.id);
                    const done = status === "completed";
                    const active = status === "in_progress";
                    return (
                      <Link
                        key={topic.id}
                        to={`/course/${courseId}/topic/${topic.id}`}
                        className={`flex items-center gap-3 -ml-[calc(1.5rem+1px)] pl-6 py-3 pr-4 rounded-2xl transition ${
                          done
                            ? "bg-primary-50"
                            : active
                            ? "bg-accent-400/10 border border-accent-400"
                            : "bg-white border border-primary-100 hover:border-primary-300"
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="text-primary-500 shrink-0" size={22} />
                        ) : active ? (
                          <PlayCircle className="text-accent-600 shrink-0" size={22} />
                        ) : (
                          <Circle className="text-ink-400 shrink-0" size={22} />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-ink-900 truncate">{topic.title}</p>
                          <p className="text-xs text-ink-400">
                            {topic.difficulty} · ~{topic.estimated_minutes} min
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
