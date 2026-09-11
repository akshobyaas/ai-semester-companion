import { create } from "zustand";

/**
 * Adapts frontend/src/store/index.ts. Two deliberate departures from the
 * original, both because the original Course type (frontend/src/types/index.ts)
 * matches the LEGACY backend, not the one this migration ported:
 *   - Course objects use the `id` field the API actually returns
 *     (courseResponse() in ingestion.routes.js maps Mongo's _id -> id),
 *     not a raw Mongo `_id` and not the legacy numeric `id`.
 *   - Course only has the fields server/src/routes/ingestion.routes.js's
 *     courseResponse() actually returns: _id, user_id, title, description,
 *     created_at. The legacy fields (semester, university, color, icon,
 *     document_count, quiz_count, progress_percentage, is_archived) don't
 *     exist anywhere in the ported backend, so they're not modeled here.
 *   - `settings` is dropped entirely — there is no settings backend at all
 *     in app/ (settings routes are legacy-only), so keeping a Settings slice
 *     would just be dead state with nothing to populate it.
 */
export const useAppStore = create((set) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),

  // Courses
  courses: [],
  setCourses: (courses) => set({ courses }),
  addCourse: (course) => set((state) => ({ courses: [course, ...state.courses] })),
  removeCourse: (id) => set((state) => ({ courses: state.courses.filter((c) => c.id !== id) })),
  updateCourse: (id, data) =>
    set((state) => ({
      courses: state.courses.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),

  // Active course
  activeCourse: null,
  setActiveCourse: (course) => set({ activeCourse: course }),

  // UI state
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
