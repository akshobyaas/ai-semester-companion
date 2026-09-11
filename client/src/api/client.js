import axios from "axios";

/**
 * Ports frontend/src/lib/api.ts — NOT services/api.ts. Confirmed in Phase 15
 * that services/api.ts (used by dashboard, settings, and every course/[id]/*
 * page in the original) targets a completely different, LEGACY backend
 * (/courses, /chat/stream, /revision/..., /planner/..., /settings — none of
 * which exist in the app/ backend this whole migration has been porting).
 * lib/api.ts is the one that actually matches: same /api/v1/... paths, same
 * auth/ingestion/learning/quiz/adaptive grouping, confirmed endpoint-for-
 * endpoint against server/src/routes/*.js built in Phases 4-13.
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
};

export const ingestionAPI = {
  createCourse: (data) => api.post("/ingestion/courses", data),
  listCourses: () => api.get("/ingestion/courses"),
  uploadDocuments: (courseId, files, docType) => {
    const formData = new FormData();
    formData.append("doc_type", docType);
    files.forEach((file) => formData.append("files", file));
    return api.post(`/ingestion/courses/${courseId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  processCourse: (courseId) => api.post(`/ingestion/courses/${courseId}/process`),
};

export const learningAPI = {
  getRoadmap: (courseId) => api.get(`/learning/courses/${courseId}/roadmap`),
  getUnits: (courseId) => api.get(`/learning/courses/${courseId}/units`),
  getTopicContent: (topicId) => api.get(`/learning/topics/${topicId}`),
  markComplete: (topicId) => api.post(`/learning/topics/${topicId}/complete`),
  getProgress: (courseId) => api.get(`/learning/courses/${courseId}/progress`),
  getNextTopic: (courseId, currentTopicId) =>
    api.get(`/learning/courses/${courseId}/next-topic`, { params: { current_topic_id: currentTopicId } }),
};

export const quizAPI = {
  generateQuiz: (data) => api.post("/quiz/generate", data),
  getQuiz: (quizId) => api.get(`/quiz/${quizId}`),
  submitQuiz: (data) => api.post("/quiz/submit", data),
  getHistory: (courseId) => api.get(`/quiz/attempts/${courseId}`),
};

export const adaptiveAPI = {
  askDoubt: (data) => api.post("/adaptive/doubt", data),
  getRecommendation: (courseId) => api.get(`/adaptive/recommend/${courseId}`),
  getAnalytics: (courseId) => api.get(`/adaptive/analytics/${courseId}`),
};

export const flashcardAPI = {
  generate: (data) => api.post("/flashcards/generate", data),
  list: (courseId, dueOnly) => api.get(`/flashcards/${courseId}${dueOnly ? "?due_only=true" : ""}`),
  review: (data) => api.post("/flashcards/review", data),
  remove: (flashcardId) => api.delete(`/flashcards/${flashcardId}`),
};

export const revisionAPI = {
  generate: (data) => api.post("/revision/generate", data),
  list: (courseId) => api.get(`/revision/${courseId}`),
};

export const userAPI = {
  updateProfile: (data) => api.put("/users/me", data),
  changePassword: (data) => api.put("/users/me/password", data),
};

export default api;
