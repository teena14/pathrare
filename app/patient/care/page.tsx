"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { HeartPulse, Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/language-context";
import { useT } from "@/lib/use-t";

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
  needsFollowUp?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "What are the key symptoms I should monitor for my condition?",
  "What government schemes are available for rare disease patients in India?",
  "What is enzyme replacement therapy and how does it work?",
  "How do I obtain a disability certificate in India?",
  "What should I do during an acute metabolic crisis?",
  "What are the first aid steps for a seizure?",
  "What specialists should I see for my disease?",
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

export default function CarePage() {
  const { profile } = useAuth();
  const { lang } = useLang();
  const t = useT('care');
  const patientId = profile?.uid ?? null;
  const patientDisease = profile?.primaryDisease ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Voice Input (STT) state ──────────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ── Read Aloud (TTS) state ───────────────────────────────────────────────────
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Build welcome message personalised to disease
  useEffect(() => {
    const disease = patientDisease;
    const welcomeText = disease
      ? `Hello! I'm your Care Assistant, personalised for **${disease}**.\n\nI'll answer all your questions with your condition in mind. I reference:\n• **Orphanet & OMIM** — rare disease-specific clinical data\n• **WHO & NIH** — international clinical guidelines\n• **CDC** — disease prevention and care protocols\n• **Red Cross** — first aid & emergency procedures\n• **India NHM, PM-JAY, RPWD Act** — government schemes & disability welfare\n\nFor anything not in my local database, I draw on my full medical training — so you'll always get a complete answer. I may ask follow-up questions to personalise my advice to you.\n\nWhat would you like to know today?`
      : `Hello! I'm your Care & Medical Knowledge Assistant.\n\nI'll give you thorough, evidence-based answers by referencing:\n• **Orphanet & OMIM** — rare disease databases\n• **WHO & NIH** — international clinical guidelines\n• **CDC** — disease prevention & care protocols\n• **Red Cross** — first aid & emergency procedures\n• **India NHM, PM-JAY, RPWD Act** — government health schemes\n\nWhen my local database doesn't cover a topic, I use my full medical training to give you a complete answer — I'll never leave you without information. I may ask follow-up questions to give you more personalised advice.\n\nWhat would you like to know?`;

    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: welcomeText,
        sources: [],
        timestamp: new Date(),
      },
    ]);
  }, [patientDisease]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Voice Input ──────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append('audio', audioBlob, `voice.${mimeType.includes('webm') ? 'webm' : 'mp4'}`);
          form.append('lang', lang);
          const res = await fetch('/api/stt', { method: 'POST', body: form });
          const data = await res.json();
          if (data.text) {
            setInput((prev) => (prev ? prev + ' ' + data.text : data.text));
            inputRef.current?.focus();
          }
        } catch (err) {
          console.error('[stt]', err);
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Mic access denied:', err);
      alert('Microphone access is required for voice input. Please allow microphone access in your browser.');
    }
  }, [lang]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  // ── Read Aloud ───────────────────────────────────────────────────────────────
  const speak = useCallback((msgId: string, text: string) => {
    // If already speaking this message, stop it
    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    // Stop any current speech
    window.speechSynthesis.cancel();
    setSpeakingId(msgId);

    // Map lang code → BCP-47 for Web Speech API
    const LANG_BCP47: Record<string, string> = {
      en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', mr: 'mr-IN',
      te: 'te-IN', bn: 'bn-IN', kn: 'kn-IN', gu: 'gu-IN',
      pa: 'pa-IN', or: 'or-IN',
    };

    // Strip markdown for cleaner speech
    const cleanText = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/[#•]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = LANG_BCP47[lang] ?? 'en-IN';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  }, [speakingId, lang]);

  // Cancel speech on unmount
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const toggleSources = (id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Build conversation history for context (last 6 turns)
  const buildHistory = () =>
    messages
      .filter((m) => !m.loading && m.id !== "welcome")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

  const sendMessage = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    const loadingId = `ai-${Date.now()}`;
    const loadingMsg: Message = {
      id: loadingId,
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
        body: JSON.stringify({
          question,
          patientId: patientId ?? undefined,
          history: buildHistory(),
          lang,
        }),
      });
      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                ...m,
                content: data.error ? `[Error] ${data.error}` : data.answer,
                sources: data.sources ?? [],
                loading: false,
                needsFollowUp: data.needsFollowUp ?? false,
              }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, content: "[Error] Connection failed. Please try again.", loading: false }
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

  const showSuggestions = messages.filter((m) => m.role === "user").length === 0;

  return (
    <div className="care-page">
      {/* Header */}
      <div className="care-header">
        <div className="care-header-icon">
          <HeartPulse className="care-header-icon-svg" />
        </div>
        <div className="care-header-text">
          <h1 className="care-title">{t('title')}</h1>
          <p className="care-subtitle">
            {patientDisease
              ? `Personalised for: ${patientDisease} · WHO · NIH · CDC · Orphanet · OMIM · NHM India`
              : "WHO · NIH · CDC · Orphanet · OMIM · Red Cross · NHM India"}
          </p>
        </div>
        {patientDisease && (
          <span className="care-disease-badge">{patientDisease}</span>
        )}
      </div>

      {/* Disclaimer */}
      <div className="care-disclaimer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z" fill="currentColor" />
        </svg>
        <p>
          {t('disclaimer')}
        </p>
      </div>

      {/* Chat */}
      <div className="care-chat">
        {messages.map((msg) => (
          <div key={msg.id} className={`care-msg care-msg--${msg.role}`}>
            {msg.role === "assistant" && (
              <div className="care-avatar care-avatar--ai">
                <HeartPulse size={15} />
              </div>
            )}

            <div className="care-bubble-wrap">
              <div className={`care-bubble care-bubble--${msg.role}`}>
                {msg.loading ? (
                  <div className="care-typing">
                    <span /><span /><span />
                  </div>
                ) : (
                  <div className="care-text">
                    {msg.content.split("\n").map((line, i) => {
                      // Bold **text**
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <p key={i}>
                          {parts.map((part, j) =>
                            part.startsWith("**") && part.endsWith("**") ? (
                              <strong key={j}>{part.slice(2, -2)}</strong>
                            ) : (
                              part || <br key={j} />
                            )
                          )}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Follow-up badge */}
              {!msg.loading && msg.needsFollowUp && (
                <div className="care-followup-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Follow-up question — please reply below
                </div>
              )}

              {/* Sources */}
              {!msg.loading && msg.sources && msg.sources.length > 0 && (
                <div className="care-sources">
                  <button
                    id={`care-sources-toggle-${msg.id}`}
                    className="care-sources-btn"
                    onClick={() => toggleSources(msg.id)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      style={{ transform: expandedSources.has(msg.id) ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  {expandedSources.has(msg.id) && (
                    <div className="care-sources-list">
                      {msg.sources.map((src, i) => (
                        <a key={i} href={src.url || "#"} target="_blank" rel="noopener noreferrer" className="care-source-item">
                          <span className="care-source-badge" style={{ background: getSourceColor(src.source) }}>
                            {getSourceInitial(src.source)}
                          </span>
                          <div className="care-source-info">
                            <span className="care-source-name">{src.source}</span>
                            <span className="care-source-title">{src.title}</span>
                          </div>
                          {src.url && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Read Aloud button — only on assistant messages */}
              {!msg.loading && msg.role === 'assistant' && msg.id !== 'welcome' && (
                <button
                  onClick={() => speak(msg.id, msg.content)}
                  title={speakingId === msg.id ? 'Stop reading' : 'Read aloud'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    marginTop: 6, padding: '4px 10px', borderRadius: 20,
                    border: '1.5px solid #e2e8f0',
                    background: speakingId === msg.id ? '#eff6ff' : 'transparent',
                    cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    color: speakingId === msg.id ? '#0F5DE3' : '#94a3b8',
                    transition: 'all 0.15s',
                  }}
                >
                  {speakingId === msg.id
                    ? <><VolumeX size={12} /> Stop</>
                    : <><Volume2 size={12} /> Read aloud</>}
                </button>
              )}
            </div>

            {msg.role === "user" && (
              <div className="care-avatar care-avatar--user">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {showSuggestions && (
        <div className="care-suggestions">
          <p className="care-suggestions-label">
            {patientDisease ? `${t('suggestLabel')} — ${patientDisease}` : t('suggestLabel')}
          </p>
          <div className="care-suggestions-grid">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button key={i} id={`care-suggestion-${i}`} className="care-suggestion-btn" onClick={() => sendMessage(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="care-input-area">
        <div className="care-input-wrap">
          <textarea
            ref={inputRef}
            id="care-question-input"
            className="care-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              patientDisease
                ? `${t('placeholder').replace('…', '')} — ${patientDisease}…`
                : t('placeholder')
            }
            rows={1}
            disabled={loading}
          />
          {/* Mic button */}
          <button
            id="care-mic-btn"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing || loading}
            aria-label={recording ? 'Stop recording' : 'Start voice input'}
            title={recording ? 'Click to stop and transcribe' : 'Click to speak'}
            style={{
              flexShrink: 0,
              width: 40, height: 40,
              borderRadius: '50%',
              border: recording ? '2px solid #ef4444' : '1.5px solid #e2e8f0',
              background: recording ? '#fef2f2' : transcribing ? '#eff6ff' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: transcribing ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: recording ? '0 0 0 4px rgba(239,68,68,0.15)' : 'none',
              animation: recording ? 'micPulse 1.2s ease-in-out infinite' : 'none',
            }}
          >
            {transcribing
              ? <Loader2 size={16} color="#0F5DE3" style={{ animation: 'spin 1s linear infinite' }} />
              : recording
                ? <MicOff size={16} color="#ef4444" />
                : <Mic size={16} color="#94a3b8" />}
          </button>

          <button
            id="care-send-btn"
            className="care-send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            aria-label="Send"
          >
            {loading ? (
              <div className="care-spinner" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        <p className="care-input-hint">{t('hint')}</p>
      </div>

      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.15); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0.25); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .care-page {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 56px);
          min-height: 0;
          max-width: 860px;
          margin: 0 auto;
          width: 100%;
        }

        .care-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 0 12px;
          border-bottom: 1px solid #e8edf2;
          flex-shrink: 0;
        }

        .care-header-icon {
          width: 46px; height: 46px;
          border-radius: 13px;
          background: linear-gradient(135deg, #f43f5e, #e11d48);
          display: flex; align-items: center; justify-content: center;
          color: white; flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(244,63,94,0.28);
        }

        .care-header-icon-svg { width: 22px; height: 22px; }
        .care-header-text { flex: 1; min-width: 0; }

        .care-title {
          font-size: 1.2rem; font-weight: 800; color: #1e293b; margin: 0;
        }

        .care-subtitle {
          font-size: 0.69rem; color: #94a3b8; margin: 2px 0 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .care-disease-badge {
          flex-shrink: 0;
          padding: 4px 10px;
          background: #fff1f2;
          border: 1px solid #fecdd3;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 700;
          color: #be123c;
          white-space: nowrap;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .care-disclaimer {
          display: flex; align-items: flex-start; gap: 8px;
          margin: 8px 0 4px;
          padding: 8px 12px;
          background: #fffbeb; border: 1px solid #fde68a;
          border-radius: 8px; color: #92400e;
          font-size: 0.74rem; line-height: 1.4; flex-shrink: 0;
        }

        .care-disclaimer p { margin: 0; }
        .care-disclaimer strong { color: #7c2d12; }

        .care-chat {
          flex: 1; overflow-y: auto;
          padding: 12px 0; display: flex;
          flex-direction: column; gap: 16px; min-height: 0;
        }

        .care-chat::-webkit-scrollbar { width: 3px; }
        .care-chat::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

        .care-msg {
          display: flex; align-items: flex-start; gap: 9px;
          animation: careFadeIn 0.22s ease-out;
        }

        @keyframes careFadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .care-msg--user { flex-direction: row-reverse; }

        .care-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 2px;
        }

        .care-avatar--ai { background: linear-gradient(135deg, #f43f5e, #e11d48); color: white; }
        .care-avatar--user { background: linear-gradient(135deg, #0F5DE3, #4f46e5); color: white; }

        .care-bubble-wrap {
          display: flex; flex-direction: column; gap: 4px; max-width: 78%;
        }

        .care-msg--user .care-bubble-wrap { align-items: flex-end; }

        .care-bubble {
          padding: 11px 15px; border-radius: 14px;
          font-size: 0.875rem; line-height: 1.65;
        }

        .care-bubble--assistant {
          background: #f8fafc; border: 1px solid #e2e8f0;
          color: #1e293b; border-top-left-radius: 3px;
        }

        .care-bubble--user {
          background: linear-gradient(135deg, #0F5DE3, #4f46e5);
          color: white; border-top-right-radius: 3px;
        }

        .care-text p { margin: 0 0 4px; }
        .care-text p:last-child { margin: 0; }

        .care-typing {
          display: flex; gap: 4px; padding: 3px 0; align-items: center;
        }

        .care-typing span {
          width: 6px; height: 6px; border-radius: 50%;
          background: #f43f5e;
          animation: careBounce 1.4s ease-in-out infinite;
        }

        .care-typing span:nth-child(1) { animation-delay: 0s; }
        .care-typing span:nth-child(2) { animation-delay: 0.2s; }
        .care-typing span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes careBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        .care-followup-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px;
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: 20px; font-size: 0.69rem; font-weight: 600;
          color: #15803d;
        }

        .care-sources { display: flex; flex-direction: column; gap: 3px; }

        .care-sources-btn {
          display: flex; align-items: center; gap: 5px;
          font-size: 0.7rem; color: #f43f5e;
          background: #fff1f2; border: 1px solid #fecdd3;
          border-radius: 20px; padding: 3px 9px;
          cursor: pointer; transition: all 0.12s; align-self: flex-start;
        }

        .care-sources-btn:hover { background: #ffe4e6; }

        .care-sources-list {
          display: flex; flex-direction: column; gap: 3px;
          animation: careFadeIn 0.18s ease-out;
        }

        .care-source-item {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 10px; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 8px;
          text-decoration: none; transition: all 0.1s;
        }

        .care-source-item:hover { background: #f1f5f9; border-color: #cbd5e1; }

        .care-source-badge {
          width: 28px; height: 28px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.6rem; font-weight: 700; color: white; flex-shrink: 0;
        }

        .care-source-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }

        .care-source-name {
          font-size: 0.64rem; font-weight: 700; color: #64748b;
          text-transform: uppercase; letter-spacing: 0.04em;
        }

        .care-source-title {
          font-size: 0.73rem; color: #334155;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .care-source-item svg { flex-shrink: 0; color: #94a3b8; }

        .care-suggestions { padding: 0 0 8px; flex-shrink: 0; }

        .care-suggestions-label {
          font-size: 0.68rem; text-transform: uppercase;
          letter-spacing: 0.06em; color: #94a3b8; margin: 0 0 7px;
        }

        .care-suggestions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

        .care-suggestion-btn {
          text-align: left; padding: 8px 12px;
          background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 9px; color: #475569; font-size: 0.74rem;
          line-height: 1.35; cursor: pointer; transition: all 0.1s;
        }

        .care-suggestion-btn:hover {
          background: #fff1f2; border-color: #fecdd3; color: #be123c;
        }

        .care-input-area {
          padding: 8px 0 12px;
          border-top: 1px solid #e8edf2; flex-shrink: 0;
        }

        .care-input-wrap {
          display: flex; align-items: flex-end; gap: 8px;
          background: #f8fafc; border: 1.5px solid #e2e8f0;
          border-radius: 12px; padding: 8px 8px 8px 13px;
          transition: border-color 0.18s;
        }

        .care-input-wrap:focus-within {
          border-color: #f43f5e;
          box-shadow: 0 0 0 3px rgba(244,63,94,0.09);
        }

        .care-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: #1e293b; font-size: 0.875rem; line-height: 1.5;
          resize: none; max-height: 100px; overflow-y: auto; font-family: inherit;
        }

        .care-input::placeholder { color: #94a3b8; }

        .care-send-btn {
          width: 34px; height: 34px; border-radius: 9px;
          background: linear-gradient(135deg, #f43f5e, #e11d48);
          border: none; color: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.16s;
          box-shadow: 0 2px 8px rgba(244,63,94,0.28);
        }

        .care-send-btn:hover:not(:disabled) { transform: scale(1.07); box-shadow: 0 4px 14px rgba(244,63,94,0.42); }
        .care-send-btn:disabled { opacity: 0.36; cursor: not-allowed; }

        .care-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: careSpinAnim 0.7s linear infinite;
        }

        @keyframes careSpinAnim { to { transform: rotate(360deg); } }

        .care-input-hint { font-size: 0.66rem; color: #cbd5e1; margin: 4px 0 0 2px; }

        @media (max-width: 640px) {
          .care-suggestions-grid { grid-template-columns: 1fr; }
          .care-bubble-wrap { max-width: 90%; }
          .care-disease-badge { display: none; }
        }
      `}</style>
    </div>
  );
}
