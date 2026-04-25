"use client";

import { useState, useRef, useEffect } from "react";

interface Source {
  title: string;
  source: string;
  url: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
  loading?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "What government schemes are available for rare disease patients in India?",
  "What is enzyme replacement therapy and which diseases use it?",
  "How do I obtain a disability certificate in India?",
  "What should I do during a metabolic crisis emergency?",
  "What is the difference between Orphanet and OMIM?",
  "What are the first aid steps for a seizure?",
  "How does genetic counselling work for rare diseases?",
  "What is Ayushman Bharat coverage for rare diseases?",
];

const SOURCE_COLORS: Record<string, string> = {
  WHO: "#3b82f6",
  NIH: "#8b5cf6",
  CDC: "#10b981",
  "Red Cross": "#ef4444",
  Orphanet: "#f59e0b",
  OMIM: "#6366f1",
  "National Health Mission (India)": "#14b8a6",
  "Government of India — Ministry of Social Justice": "#f97316",
  "Ayushman Bharat / PM-JAY": "#06b6d4",
  "Government of India — BPPI": "#84cc16",
  "Government of India — Ministry of Health": "#a855f7",
  "Government of India — Ministry of Finance": "#ec4899",
  "PubMed / NIH": "#64748b",
};

function getSourceColor(source: string): string {
  return SOURCE_COLORS[source] ?? "#6b7280";
}

function getSourceInitial(source: string): string {
  if (source.startsWith("WHO")) return "W";
  if (source.startsWith("NIH") || source.startsWith("PubMed")) return "N";
  if (source.startsWith("CDC")) return "C";
  if (source.startsWith("Red")) return "RC";
  if (source.startsWith("Orphanet")) return "Or";
  if (source.startsWith("OMIM")) return "Om";
  if (source.includes("National Health")) return "NHM";
  if (source.includes("PM-JAY") || source.includes("Ayushman")) return "AB";
  return source.slice(0, 2).toUpperCase();
}

export default function MedicalAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm PathRare's Medical Knowledge Assistant. I can answer questions about rare diseases, first aid protocols, India's health schemes, and more — drawing from WHO, NIH, CDC, Orphanet, OMIM, Red Cross, and Indian government health databases.\n\nWhat would you like to know today?",
      sources: [],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleSources = (id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sendMessage = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    const loadingMsg: Message = {
      id: `ai-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                content: data.error
                  ? `⚠️ ${data.error}`
                  : data.answer,
                sources: data.sources ?? [],
                loading: false,
              }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                content: "⚠️ Failed to connect to the knowledge base. Please try again.",
                loading: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="medical-assistant-page">
      {/* Header */}
      <div className="ma-header">
        <div className="ma-header-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="ma-header-text">
          <h1 className="ma-title">Medical Knowledge Assistant</h1>
          <p className="ma-subtitle">
            Grounded answers from WHO · NIH · CDC · Orphanet · OMIM · Red Cross · NHM India
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="ma-disclaimer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"
            fill="currentColor"
          />
        </svg>
        <p>
          This assistant provides educational information from authoritative medical sources. It is{" "}
          <strong>not a substitute for professional medical advice</strong>. Always consult a qualified
          healthcare provider for diagnosis and treatment.
        </p>
      </div>

      {/* Chat area */}
      <div className="ma-chat-area">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ma-message ma-message--${msg.role}`}
          >
            {msg.role === "assistant" && (
              <div className="ma-avatar ma-avatar--ai">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}

            <div className="ma-bubble-wrap">
              <div className={`ma-bubble ma-bubble--${msg.role}`}>
                {msg.loading ? (
                  <div className="ma-typing">
                    <span /><span /><span />
                  </div>
                ) : (
                  <div className="ma-text">
                    {msg.content.split("\n").map((line, i) => (
                      <p key={i}>{line || <br />}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Sources panel */}
              {!msg.loading && msg.sources && msg.sources.length > 0 && (
                <div className="ma-sources">
                  <button
                    id={`sources-toggle-${msg.id}`}
                    className="ma-sources-toggle"
                    onClick={() => toggleSources(msg.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      style={{
                        transform: expandedSources.has(msg.id) ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>

                  {expandedSources.has(msg.id) && (
                    <div className="ma-sources-list">
                      {msg.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ma-source-item"
                        >
                          <span
                            className="ma-source-badge"
                            style={{ background: getSourceColor(src.source) }}
                          >
                            {getSourceInitial(src.source)}
                          </span>
                          <div className="ma-source-info">
                            <span className="ma-source-name">{src.source}</span>
                            <span className="ma-source-title">{src.title}</span>
                          </div>
                          {src.url && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="ma-avatar ma-avatar--user">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions (only show when only welcome message) */}
      {messages.length === 1 && (
        <div className="ma-suggestions">
          <p className="ma-suggestions-label">Suggested questions</p>
          <div className="ma-suggestions-grid">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                id={`suggestion-${i}`}
                className="ma-suggestion-btn"
                onClick={() => sendMessage(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="ma-input-area">
        <div className="ma-input-wrap">
          <textarea
            ref={inputRef}
            id="medical-question-input"
            className="ma-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a medical question… (e.g. What is Fabry disease?)"
            rows={1}
            disabled={loading}
          />
          <button
            id="send-question-btn"
            className="ma-send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            aria-label="Send question"
          >
            {loading ? (
              <div className="ma-send-spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        <p className="ma-input-hint">Press Enter to send · Shift+Enter for new line</p>
      </div>

      <style>{`
        .medical-assistant-page {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          background: var(--surface, #0f172a);
        }

        .ma-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 24px 28px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .ma-header-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 4px 20px rgba(99,102,241,0.35);
        }

        .ma-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
        }

        .ma-subtitle {
          font-size: 0.75rem;
          color: #64748b;
          margin: 2px 0 0;
        }

        .ma-disclaimer {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 12px 28px;
          padding: 12px 16px;
          background: rgba(251, 191, 36, 0.08);
          border: 1px solid rgba(251, 191, 36, 0.2);
          border-radius: 10px;
          color: #fbbf24;
          font-size: 0.78rem;
          line-height: 1.5;
        }

        .ma-disclaimer svg { flex-shrink: 0; margin-top: 1px; }
        .ma-disclaimer p { margin: 0; }
        .ma-disclaimer strong { color: #fde68a; }

        .ma-chat-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-height: 0;
        }

        .ma-chat-area::-webkit-scrollbar { width: 4px; }
        .ma-chat-area::-webkit-scrollbar-track { background: transparent; }
        .ma-chat-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        .ma-message {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          animation: maFadeIn 0.25s ease-out;
        }

        @keyframes maFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ma-message--user {
          flex-direction: row-reverse;
        }

        .ma-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .ma-avatar--ai {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }

        .ma-avatar--user {
          background: linear-gradient(135deg, #0ea5e9, #6366f1);
          color: white;
        }

        .ma-bubble-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-width: 75%;
        }

        .ma-message--user .ma-bubble-wrap {
          align-items: flex-end;
        }

        .ma-bubble {
          padding: 14px 18px;
          border-radius: 16px;
          font-size: 0.9rem;
          line-height: 1.65;
        }

        .ma-bubble--assistant {
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid rgba(255,255,255,0.07);
          color: #e2e8f0;
          border-top-left-radius: 4px;
        }

        .ma-bubble--user {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          border-top-right-radius: 4px;
        }

        .ma-text p { margin: 0 0 6px; }
        .ma-text p:last-child { margin: 0; }

        .ma-typing {
          display: flex;
          gap: 5px;
          padding: 4px 0;
          align-items: center;
        }

        .ma-typing span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #6366f1;
          animation: bounce 1.4s ease-in-out infinite;
        }

        .ma-typing span:nth-child(1) { animation-delay: 0s; }
        .ma-typing span:nth-child(2) { animation-delay: 0.2s; }
        .ma-typing span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        .ma-sources {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ma-sources-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: #6366f1;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 20px;
          padding: 4px 12px;
          cursor: pointer;
          transition: all 0.2s;
          align-self: flex-start;
        }

        .ma-sources-toggle:hover {
          background: rgba(99,102,241,0.15);
          color: #818cf8;
        }

        .ma-sources-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 6px 0;
          animation: maFadeIn 0.2s ease-out;
        }

        .ma-source-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          text-decoration: none;
          transition: all 0.15s;
          cursor: pointer;
        }

        .ma-source-item:hover {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.2);
        }

        .ma-source-badge {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          letter-spacing: -0.03em;
        }

        .ma-source-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .ma-source-name {
          font-size: 0.7rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .ma-source-title {
          font-size: 0.78rem;
          color: #cbd5e1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ma-source-item svg { flex-shrink: 0; color: #475569; }

        .ma-suggestions {
          padding: 0 24px 12px;
        }

        .ma-suggestions-label {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #475569;
          margin: 0 0 10px;
        }

        .ma-suggestions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .ma-suggestion-btn {
          text-align: left;
          padding: 10px 14px;
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          color: #94a3b8;
          font-size: 0.78rem;
          line-height: 1.4;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ma-suggestion-btn:hover {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.25);
          color: #c7d2fe;
        }

        .ma-input-area {
          padding: 12px 20px 16px;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(15, 23, 42, 0.5);
        }

        .ma-input-wrap {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 10px 10px 10px 16px;
          transition: border-color 0.2s;
        }

        .ma-input-wrap:focus-within {
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .ma-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #e2e8f0;
          font-size: 0.9rem;
          line-height: 1.5;
          resize: none;
          max-height: 120px;
          overflow-y: auto;
          font-family: inherit;
        }

        .ma-input::placeholder { color: #475569; }

        .ma-send-btn {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
          box-shadow: 0 2px 10px rgba(99,102,241,0.3);
        }

        .ma-send-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 4px 16px rgba(99,102,241,0.45);
        }

        .ma-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .ma-send-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .ma-input-hint {
          font-size: 0.7rem;
          color: #334155;
          margin: 6px 0 0 4px;
        }

        @media (max-width: 640px) {
          .ma-suggestions-grid { grid-template-columns: 1fr; }
          .ma-bubble-wrap { max-width: 88%; }
          .ma-header { padding: 16px 16px 12px; }
          .ma-chat-area { padding: 12px 12px; }
          .ma-input-area { padding: 10px 12px 14px; }
          .ma-disclaimer { margin: 10px 12px; }
        }
      `}</style>
    </div>
  );
}
