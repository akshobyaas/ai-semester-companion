import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BookOpen } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import { ingestionAPI, authAPI } from "../api/client.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { useAppStore } from "../store/useAppStore.js";

export default function DashboardPage() {
  usePageTitle("My Courses");
  const { courses, setCourses, addCourse, user, setUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      authAPI.getMe().then((res) => setUser(res.data)).catch(() => {});
    }
    ingestionAPI
      .listCourses()
      .then((res) => setCourses(res.data))
      .catch(() => setError("Couldn't load your courses. Try refreshing."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      setError("Course title needs to be at least 3 characters.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await ingestionAPI.createCourse({ title, description: description || undefined });
      addCourse(res.data);
      setTitle("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't create the course.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink-900">Your courses</h1>
            <p className="text-ink-400 mt-1">Pick one up, or start something new.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-display font-semibold transition active:scale-[0.98]"
          >
            <Plus size={18} />
            New course
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-8 bg-white border border-primary-100 rounded-3xl p-6 space-y-4">
            {error && <div className="px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-1">Course title</label>
              <input
                className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Data Structures & Algorithms"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-1">Description (optional)</label>
              <input
                className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="VTU 4th semester"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create course"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 rounded-2xl text-ink-600 hover:bg-primary-50 font-medium transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-ink-400">Loading your courses…</p>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-primary-200 rounded-3xl">
            <BookOpen className="mx-auto text-primary-300 mb-3" size={40} />
            <p className="text-ink-600 font-medium">No courses yet</p>
            <p className="text-ink-400 text-sm mt-1">Create your first course to start building a study roadmap.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <Link
                key={course.id}
                to={`/course/${course.id}`}
                className="block bg-white border border-primary-100 rounded-3xl p-6 hover:border-primary-300 hover:shadow-sm transition"
              >
                <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
                  <BookOpen size={20} />
                </div>
                <h3 className="font-display font-semibold text-lg text-ink-900">{course.title}</h3>
                {course.description && <p className="text-ink-400 text-sm mt-1 line-clamp-2">{course.description}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
