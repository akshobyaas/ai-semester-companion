import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, RotateCw } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import { flashcardAPI } from "../api/client.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

// Anki-style quality buttons mapped to the SM-2 0-5 scale the backend expects.
const QUALITY_OPTIONS = [
  { label: "Again", value: 1, className: "bg-red-50 text-red-700 hover:bg-red-100" },
  { label: "Hard", value: 3, className: "bg-accent-400/10 text-accent-600 hover:bg-accent-400/20" },
  { label: "Good", value: 4, className: "bg-primary-50 text-primary-700 hover:bg-primary-100" },
  { label: "Easy", value: 5, className: "bg-primary-100 text-primary-800 hover:bg-primary-200" },
];

export default function FlashcardsPage() {
  usePageTitle("Flashcards");
  const { courseId } = useParams();
  const [cards, setCards] = useState(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const loadDue = () => {
    flashcardAPI
      .list(courseId, true)
      .then((res) => {
        setCards(res.data);
        setIndex(0);
        setFlipped(false);
      })
      .catch(() => setCards([]));
  };

  useEffect(loadDue, [courseId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      await flashcardAPI.generate({ course_id: courseId, num_cards: 10 });
      loadDue();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't generate flashcards.");
    } finally {
      setGenerating(false);
    }
  };

  const handleReview = async (quality) => {
    const card = cards[index];
    try {
      await flashcardAPI.review({ flashcard_id: card.id, quality });
    } catch {
      // best-effort — still advance so a network hiccup doesn't stall the review session
    }
    if (index + 1 < cards.length) {
      setIndex(index + 1);
      setFlipped(false);
    } else {
      setCards([]); // session complete
    }
  };

  if (cards === null) {
    return (
      <AppShell>
        <div className="px-4 sm:px-8 py-10 text-ink-400">Loading…</div>
      </AppShell>
    );
  }

  if (cards.length === 0) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto px-4 sm:px-8 py-16 text-center">
          <Sparkles className="mx-auto text-primary-300 mb-3" size={32} />
          <p className="font-display font-semibold text-lg text-ink-900">All caught up</p>
          <p className="text-ink-400 text-sm mt-1 mb-6">No cards due right now. Generate more, or come back later.</p>
          {error && <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-3 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate flashcards"}
          </button>
        </div>
      </AppShell>
    );
  }

  const card = cards[index];

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 sm:px-8 py-10">
        <div className="w-full h-2 bg-primary-50 rounded-full mb-8 overflow-hidden">
          <div className="h-full bg-primary-500 transition-all" style={{ width: `${(index / cards.length) * 100}%` }} />
        </div>

        <button
          onClick={() => setFlipped(!flipped)}
          className="w-full min-h-[220px] bg-white border border-primary-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center hover:border-primary-300 transition"
        >
          <p className="text-xs uppercase tracking-wide text-ink-400 mb-3">{flipped ? "Answer" : card.topic || "Question"}</p>
          <p className="font-display text-xl text-ink-900">{flipped ? card.answer : card.question}</p>
          {!flipped && (
            <p className="flex items-center gap-1.5 text-primary-500 text-sm mt-4">
              <RotateCw size={14} /> Tap to reveal
            </p>
          )}
        </button>

        {flipped && (
          <div className="grid grid-cols-4 gap-2 mt-6">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleReview(opt.value)}
                className={`py-3 rounded-2xl font-medium text-sm transition ${opt.className}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
