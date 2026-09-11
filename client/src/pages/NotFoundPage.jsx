import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle.js";

export default function NotFoundPage() {
  usePageTitle("Page not found");

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-500 flex items-center justify-center mx-auto mb-5">
          <Compass size={28} />
        </div>
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-2">Lost your way?</h1>
        <p className="text-ink-400 mb-6">The page you're looking for doesn't exist, or the link may be broken.</p>
        <Link
          to="/dashboard"
          className="inline-block px-6 py-3 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-display font-semibold transition"
        >
          Back to your courses
        </Link>
      </div>
    </div>
  );
}
