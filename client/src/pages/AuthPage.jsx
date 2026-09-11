import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../api/client.js";
import { useAppStore } from "../store/useAppStore.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

/**
 * Ports the login/register flow from frontend/src/app/auth/page.tsx —
 * same request sequence (login -> store token -> getMe -> navigate), just
 * without framer-motion/react-hot-toast/Next-router, and a fresh visual
 * design rather than the original's dark-gradient SaaS-card look.
 */
export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "", full_name: "" });
  usePageTitle(isLogin ? "Sign in" : "Create account");
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const res = await authAPI.login({ email: formData.email, password: formData.password });
        localStorage.setItem("access_token", res.data.access_token);

        const userRes = await authAPI.getMe();
        setUser(userRes.data);

        navigate("/dashboard");
      } else {
        await authAPI.register(formData);
        setIsLogin(true);
        setError("");
        setFormData({ ...formData, password: "" });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-cream">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-primary-100 p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-500 text-white flex items-center justify-center mx-auto mb-4 font-display text-2xl font-bold">
            AI
          </div>
          <h1 className="font-display text-2xl font-bold text-ink-900">
            {isLogin ? "Welcome back" : "Let's get started"}
          </h1>
          <p className="text-ink-400 mt-1">
            {isLogin ? "Pick up where you left off." : "Create your account to begin."}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-ink-600 mb-1">Full name</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required={!isLogin}
                placeholder="Jordan Lee"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1">Email</label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1">Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-primary-500 hover:bg-primary-600 active:scale-[0.99] text-white font-display font-semibold text-lg transition disabled:opacity-50"
          >
            {loading ? "One moment…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            {isLogin ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
