import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Send, Sparkles } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import { adaptiveAPI } from "../api/client.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

/**
 * The backend has no streaming endpoint (confirmed dead code in Phase 14 —
 * generate_stream exists in llm_service.py but nothing calls it), so this
 * is a request/response chat, not token-by-token streaming. Designed around
 * that honestly: a clear "thinking" state instead of pretending to stream.
 */
export default function ChatPage() {
  usePageTitle("Ask a doubt");
  const { courseId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const res = await adaptiveAPI.askDoubt({ message: question, course_id: courseId });
      setMessages((m) => [...m, { role: "assistant", content: res.data.answer, sources: res.data.sources }]);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't get an answer. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-10 flex flex-col h-screen">
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-1">Ask a doubt</h1>
        <p className="text-ink-400 text-sm mb-6">Answers are grounded in your uploaded course material.</p>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center py-16 text-ink-400">
              <Sparkles className="mx-auto mb-2 text-primary-300" size={28} />
              <p>Ask anything about this course.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  m.role === "user" ? "bg-primary-500 text-white" : "bg-white border border-primary-100 text-ink-900"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl bg-white border border-primary-100 text-ink-400 text-sm">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <div className="mb-3 px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className="flex-1 px-4 py-3 rounded-2xl border border-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-5 py-3 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 transition"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
