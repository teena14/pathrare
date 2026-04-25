'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Sparkles, AlertCircle, ChevronRight, X, Microscope } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────────
interface DiseaseMatch {
  orpha_code: string;
  name: string;
  confidence: number;
  score: number;
  icd_codes: string[];
  omim: string[];
}

interface DiagnoseResult {
  symptoms_extracted: string[];
  report_text_preview: string;
  report_diagnosis: string | null;
  ai_diagnosis: string;
  diagnosis_match_type: 'matches' | 'differs' | 'no_report_diagnosis';
  reasoning: string;
  matches: DiseaseMatch[];
}

// ── Confidence colour helper ───────────────────────────────────────────────────
function confidenceColor(confidence: number) {
  if (confidence >= 75) return { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (confidence >= 50) return { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { bar: 'bg-rose-400', badge: 'bg-rose-50 text-rose-700 border-rose-200' };
}

// ── Constants ──────────────────────────────────────────────────────────────────
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export default function DiagnosePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'upload' | 'text'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── File handling ────────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Unsupported file type. Upload a PDF or image (PNG, JPG, WebP).');
      return;
    }
    setFile(f);
    setError('');
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (mode === 'upload' && !file) { setError('Please upload a report file.'); return; }
    if (mode === 'text' && !symptoms.trim()) { setError('Please enter your symptoms.'); return; }

    setError('');
    setLoading(true);
    setResult(null);

    try {
      const form = new FormData();
      if (mode === 'upload' && file) form.append('file', file);
      else form.append('symptoms', symptoms);

      const res = await fetch('/api/diagnose', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Diagnostic request failed.');
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setFile(null); setSymptoms(''); setError(''); };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-primary-blue/10">
          <Microscope className="w-7 h-7 text-primary-blue" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-dark-slate tracking-tight">Diagnostic Inference</h1>
          <p className="text-light-slate font-medium mt-0.5">Upload a medical report or describe symptoms — our AI matches rare diseases from the Orphanet dataset.</p>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Input Panel ─────────────────────────────────────────────────────── */}
        {!result && (
          <motion.div key="input" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">

            {/* Mode toggle */}
            <div className="inline-flex p-1 bg-surface-100 rounded-2xl gap-1">
              {(['upload', 'text'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); }}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === m ? 'bg-white text-primary-blue shadow-md' : 'text-light-slate hover:text-dark-slate'}`}
                >
                  {m === 'upload' ? '📄 Upload Report' : '✍️ Describe Symptoms'}
                </button>
              ))}
            </div>

            {/* Upload zone */}
            {mode === 'upload' && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 p-12 text-center
                  ${dragOver ? 'border-primary-blue bg-primary-blue/5 scale-[1.01]' : 'border-surface-300 bg-white hover:border-primary-blue/50 hover:bg-surface-50'}
                  ${file ? 'border-emerald-400 bg-emerald-50/60' : ''}`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-emerald-600" />
                    </div>
                    <p className="font-bold text-dark-slate text-lg">{file.name}</p>
                    <p className="text-light-slate text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                    <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="mt-2 flex items-center gap-1.5 text-sm font-bold text-rose-500 hover:text-rose-700 transition-colors">
                      <X className="w-4 h-4" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <motion.div animate={{ y: dragOver ? -8 : 0 }} transition={{ type: 'spring', stiffness: 300 }}
                      className="w-20 h-20 rounded-3xl bg-primary-blue/10 flex items-center justify-center">
                      <Upload className="w-9 h-9 text-primary-blue" />
                    </motion.div>
                    <div>
                      <p className="text-xl font-bold text-dark-slate mb-1">Drop your report here</p>
                      <p className="text-light-slate text-sm">or click to browse — PDF, PNG, JPG, WebP supported</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Text input */}
            {mode === 'text' && (
              <div className="bg-white rounded-3xl border-2 border-surface-200 overflow-hidden focus-within:border-primary-blue transition-colors">
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder={"Describe the patient's symptoms in plain language...\n\nExample: abnormal blood vessel growth around the shoulder, macrocephaly, developmental delay, seizures since age 2"}
                  className="w-full h-52 p-6 text-dark-slate font-medium text-sm leading-relaxed resize-none outline-none bg-transparent placeholder:text-surface-300"
                />
                <div className="px-6 py-3 bg-surface-50 border-t border-surface-100 flex items-center justify-between">
                  <span className="text-xs text-light-slate font-medium">{symptoms.length} characters</span>
                  {symptoms.length > 0 && (
                    <button onClick={() => setSymptoms('')} className="text-xs font-bold text-light-slate hover:text-rose-500 transition-colors">Clear</button>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-primary-blue hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-full shadow-[0_4px_20px_rgba(15,93,227,0.35)] hover:shadow-[0_6px_28px_rgba(15,93,227,0.45)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                  Analysing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> Run Diagnostic Inference
                </>
              )}
            </button>

            {/* Loading pipeline animation */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-surface-200 p-6 space-y-4">
                <p className="text-sm font-bold text-dark-slate mb-4">Running inference pipeline…</p>
                {['OCR — Extracting text from document', 'Gemini — Identifying clinical symptoms', 'Vertex AI — Generating symptom embeddings', 'Matching against Orphanet disease dataset'].map((step, i) => (
                  <motion.div key={step} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.7 }}
                    className="flex items-center gap-3 text-sm text-light-slate font-medium">
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ delay: i * 0.7, duration: 0.4 }}
                      className="w-2 h-2 rounded-full bg-primary-blue shrink-0" />
                    {step}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Results Panel ────────────────────────────────────────────────────── */}
        {result && (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Diagnosis Comparison Card */}
            <div className={`rounded-3xl border p-6 ${
              result.diagnosis_match_type === 'matches' 
                ? 'bg-emerald-50 border-emerald-200' 
                : result.diagnosis_match_type === 'differs'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {result.diagnosis_match_type === 'matches' && (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-lg">✓</span>
                  </div>
                )}
                {result.diagnosis_match_type === 'differs' && (
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-amber-600 text-lg">⚠</span>
                  </div>
                )}
                {result.diagnosis_match_type === 'no_report_diagnosis' && (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 text-lg">ℹ</span>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-dark-slate">
                    {result.diagnosis_match_type === 'matches' && 'Diagnosis Confirmed'}
                    {result.diagnosis_match_type === 'differs' && 'Diagnosis Differs'}
                    {result.diagnosis_match_type === 'no_report_diagnosis' && 'No Diagnosis in Report'}
                  </h2>
                  <p className="text-sm text-light-slate mt-0.5">AI analysis comparison</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {result.report_diagnosis && (
                  <div className="bg-white/60 rounded-2xl p-4">
                    <p className="text-xs font-bold text-light-slate mb-1">Report Diagnosis</p>
                    <p className="font-bold text-dark-slate">{result.report_diagnosis}</p>
                  </div>
                )}
                <div className="bg-white/60 rounded-2xl p-4">
                  <p className="text-xs font-bold text-light-slate mb-1">AI Diagnosis</p>
                  <p className="font-bold text-dark-slate">{result.ai_diagnosis}</p>
                </div>
              </div>

              <div className="bg-white/60 rounded-2xl p-4">
                <p className="text-xs font-bold text-light-slate mb-1">Reasoning</p>
                <p className="text-sm text-dark-slate leading-relaxed">{result.reasoning}</p>
              </div>
            </div>

            {/* Symptoms extracted */}
            <div className="bg-white rounded-3xl border border-surface-200 p-6">
              <h2 className="text-base font-bold text-dark-slate mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-blue inline-block" /> Symptoms Extracted ({result.symptoms_extracted.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.symptoms_extracted.map((s, i) => (
                  <span key={i} className="px-3 py-1.5 bg-primary-blue/8 text-primary-blue text-xs font-bold rounded-full border border-primary-blue/15">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Disease matches */}
            <div className="space-y-4">
              <h2 className="text-xl font-black text-dark-slate">Top Disease Matches</h2>
              {result.matches.map((match, i) => {
                const colors = confidenceColor(match.confidence);
                return (
                  <motion.div key={match.orpha_code} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="bg-white rounded-3xl border border-surface-200 p-6 hover:border-primary-blue/30 hover:shadow-lg transition-all group">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-light-slate w-6">#{i + 1}</span>
                        <div>
                          <h3 className="font-bold text-dark-slate text-lg leading-tight group-hover:text-primary-blue transition-colors">{match.name}</h3>
                          <p className="text-xs text-light-slate font-medium mt-0.5">ORPHA:{match.orpha_code}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-black border ${colors.badge}`}>
                        {match.confidence}%
                      </span>
                    </div>

                    {/* Confidence bar */}
                    <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden mb-4">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${match.confidence}%` }} transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
                        className={`h-full rounded-full ${colors.bar}`} />
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      {match.icd_codes.map((code) => (
                        <span key={code} className="px-2.5 py-1 bg-surface-100 text-light-slate text-xs font-bold rounded-lg border border-surface-200">ICD {code}</span>
                      ))}
                      {match.omim.map((code) => (
                        <span key={code} className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200">OMIM {code}</span>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button onClick={reset}
                className="flex-1 py-3.5 rounded-2xl border-2 border-surface-200 text-dark-slate font-bold hover:border-primary-blue/30 hover:bg-surface-50 transition-all">
                ← Run Another
              </button>
              <button
                onClick={async () => {
                  if (!profile?.uid) {
                    alert('Please log in to save reports');
                    return;
                  }
                  
                  try {
                    const res = await fetch('/api/reports', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        patientId: profile.uid,
                        fileName: file?.name || 'Symptom Input',
                        fileType: file?.type || 'text',
                        reportText: result.report_text_preview,
                        symptoms: result.symptoms_extracted,
                        aiDiagnosis: result.matches[0],
                        allMatches: result.matches,
                        reportDiagnosis: result.report_diagnosis,
                        diagnosisMatchType: result.diagnosis_match_type,
                        reasoning: result.reasoning,
                      }),
                    });
                    
                    if (res.ok) {
                      router.push('/patient/clinical-profile');
                    } else {
                      const data = await res.json();
                      alert('Failed to save: ' + data.error);
                    }
                  } catch (err) {
                    alert('Failed to save report');
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary-blue text-white font-bold hover:bg-blue-700 shadow-[0_4px_14px_rgba(15,93,227,0.3)] transition-all">
                Save to Clinical Profile <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
