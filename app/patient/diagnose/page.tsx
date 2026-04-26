'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Sparkles, AlertCircle, ChevronRight, X, Microscope, Download, BookOpen, CheckCircle, AlertTriangle, Edit3, RefreshCw, Check, SkipForward, Dna } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { uploadPatientDocument } from '@/lib/document-upload';
import { useLang } from '@/lib/language-context';
import { useT } from '@/lib/use-t';

// ── Types ──────────────────────────────────────────────────────────────────────
interface DiseaseMatch {
  orpha_code: string;
  name: string;
  confidence: number;
  reasoning?: string;
  icd_codes: string[];
  omim: string[];
  hpo_score?: number;
  vector_score?: number;
  gemini_confidence?: number;
  matched_hpo?: { code: string; name: string }[];
}

interface DiagnoseResult {
  symptoms_extracted: string[];
  symptoms_with_hpo?: { term: string; hpo_code: string }[];
  hpo_codes_used?: string[];
  report_text_preview: string;
  stated_disease: string | null;
  ai_summary: string;
  diagnosis_match_type: 'matches' | 'differs' | 'no_stated_disease';
  mismatch_reasoning: string;
  matches: DiseaseMatch[];
}

// ── Confidence colour helper ───────────────────────────────────────────────────
function confidenceColor(confidence: number) {
  if (confidence >= 75) return { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (confidence >= 50) return { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { bar: 'bg-rose-400', badge: 'bg-rose-50 text-rose-700 border-rose-200' };
}

// ── Second Opinion Pack generator ─────────────────────────────────────────────
function downloadSecondOpinionPack(result: DiagnoseResult, patientName: string) {
  const top = result.matches[0];
  const date = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
  const mismatchBg = result.diagnosis_match_type === 'matches' ? '#d1fae5' : result.diagnosis_match_type === 'differs' ? '#fef3c7' : '#eff6ff';
  const mismatchColor = result.diagnosis_match_type === 'matches' ? '#065f46' : result.diagnosis_match_type === 'differs' ? '#92400e' : '#1e3a8a';
  const mismatchLabel = result.diagnosis_match_type === 'matches' ? 'AI Confirms Stated Diagnosis' : result.diagnosis_match_type === 'differs' ? 'Potential Misdiagnosis Detected' : 'No Prior Diagnosis on Record';

  const matchRows = result.matches.map((m, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td style="padding:10px 14px;font-weight:700">#${i+1} ${m.name}</td>
      <td style="padding:10px 14px">ORPHA:${m.orpha_code}</td>
      <td style="padding:10px 14px;text-align:center"><span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:20px;font-weight:700">${m.confidence}%</span></td>
      <td style="padding:10px 14px;color:#6b7280;font-size:13px">${(m.icd_codes || []).join(', ') || '—'}</td>
      <td style="padding:10px 14px;color:#6b7280;font-size:13px">${(m.omim || []).slice(0,2).join(', ') || '—'}</td>
    </tr>`).join('');

  const hpoRows = (result.symptoms_with_hpo || []).map(s => `
    <tr><td style="padding:8px 14px">${s.term}</td>
    <td style="padding:8px 14px"><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:12px">${s.hpo_code || '—'}</code></td></tr>`).join('');

  const topHPO = (top?.matched_hpo || []).slice(0, 10).map(h =>
    `<li style="margin:4px 0">${h.name} <code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:12px">${h.code}</code></li>`).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>PathRare Second Opinion — ${date}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;margin:0;padding:0;background:#f9fafb}
.page{max-width:860px;margin:0 auto;padding:40px 32px;background:#fff}
 h1{font-size:28px;font-weight:900;color:#0f5de3;margin:0}h2{font-size:18px;font-weight:800;margin:28px 0 12px;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:6px}
h3{font-size:15px;font-weight:700;margin:16px 0 8px;color:#374151}table{width:100%;border-collapse:collapse;font-size:14px}th{background:#0f5de3;color:#fff;padding:10px 14px;text-align:left;font-size:13px}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-weight:700;font-size:12px}.disclaimer{margin-top:32px;padding:14px;background:#fef9c3;border:1px solid #fde68a;border-radius:10px;font-size:12px;color:#713f12}</style>
</head><body><div class="page">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
  <div><h1>PathRare Second Opinion</h1><p style="color:#6b7280;margin:4px 0 0">AI-Powered Rare Disease Diagnostic Report</p></div>
  <div style="text-align:right;font-size:13px;color:#6b7280"><div>Generated: ${date}</div><div>Patient: ${patientName}</div></div>
</div>
<div style="background:${mismatchBg};border-radius:12px;padding:16px 20px;margin-bottom:24px">
  <div style="font-size:16px;font-weight:800;color:${mismatchColor};margin-bottom:6px">${mismatchLabel}</div>
  ${result.stated_disease ? `<div style="font-size:13px;color:${mismatchColor}"><b>Patient-stated diagnosis:</b> ${result.stated_disease}</div>` : ''}
  <div style="font-size:13px;color:${mismatchColor};margin-top:4px"><b>AI primary diagnosis:</b> ${top?.name || '—'} (ORPHA:${top?.orpha_code || '—'})</div>
  ${result.mismatch_reasoning ? `<div style="font-size:13px;color:${mismatchColor};margin-top:8px">${result.mismatch_reasoning}</div>` : ''}
</div>
<h2>AI Clinical Summary</h2>
<p style="line-height:1.7;color:#374151;font-size:15px">${result.ai_summary}</p>
<h2>Extracted Symptoms with HPO Codes</h2>
<table><thead><tr><th>Symptom</th><th>HPO Code</th></tr></thead><tbody>${hpoRows || '<tr><td colspan="2" style="padding:10px 14px;color:#6b7280">No HPO-mapped symptoms extracted.</td></tr>'}</tbody></table>
<h2>Top Disease Matches</h2>
<table><thead><tr><th>Disease</th><th>ORPHA Code</th><th>Confidence</th><th>ICD Codes</th><th>OMIM</th></tr></thead><tbody>${matchRows}</tbody></table>
${topHPO ? `<h2>HPO Evidence for Top Match (${top?.name})</h2><ul style="line-height:1.8;padding-left:20px;font-size:14px">${topHPO}</ul>` : ''}
<h2>Scoring Methodology</h2>
<p style="font-size:14px;color:#374151;line-height:1.7">The PathRare diagnostic engine uses a three-source weighted scoring system:<br>
<b>45% Gemini LLM</b> — clinical reasoning from Google Gemini AI<br>
<b>35% HPO Jaccard Similarity</b> — evidence-based phenotype matching against ${(result.hpo_codes_used || []).length} extracted HPO codes from the Human Phenotype Ontology database (114,943 curated ORPHA–HPO associations)<br>
<b>20% Vertex AI Semantic Vector Search</b> — symptom text similarity against disease embeddings</p>
<div class="disclaimer"><b>Disclaimer:</b> This report is generated by an AI system and is intended to support, not replace, clinical judgment. It does not constitute a medical diagnosis. Please consult a qualified physician or specialist before making any medical decisions. All HPO, ICD, and OMIM codes reference internationally recognised clinical databases.</div>
</div></body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pathrare-second-opinion-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Constants ──────────────────────────────────────────────────────────────────
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export default function DiagnosePage() {
  const { profile } = useAuth();
  const { lang } = useLang();
  const t = useT('diagnose');
  const router = useRouter();
  const [mode, setMode] = useState<'upload' | 'text'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [diagnosisChoice, setDiagnosisChoice] = useState<'change' | 'keep' | 'skip' | null>(null);
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
    setError(''); setLoading(true); setResult(null);
    try {
      const form = new FormData();
      if (mode === 'upload' && file) form.append('file', file);
      else form.append('symptoms', symptoms);
      // Send patient's stated disease for mismatch detection
      if (profile?.primaryDisease) form.append('stated_disease', profile.primaryDisease);
      form.append('lang', lang);
      const res = await fetch('/api/diagnose', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Diagnostic request failed.');
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally { setLoading(false); }
  };

  // ── Save to Clinical Profile ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!result || !profile?.uid) { alert('Please log in to save reports'); return; }
    setSaving(true);
    try {
      // 1) If a file was uploaded, save it to Firebase Storage + Firestore documents
      if (file && mode === 'upload') {
        await uploadPatientDocument(profile.uid, file);
      }

      // 2) Save the AI diagnostic report
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: profile.uid,
          fileName: file?.name || 'Symptom Input',
          fileType: file?.type || 'text',
          reportText: result.report_text_preview,
          symptoms: result.symptoms_extracted,
          symptoms_with_hpo: result.symptoms_with_hpo || [],
          hpo_codes_used: result.hpo_codes_used || [],
          aiDiagnosis: result.matches[0] || null,
          allMatches: result.matches,
          statedDisease: result.stated_disease,
          diagnosisMatchType: result.diagnosis_match_type,
          aiSummary: result.ai_summary,
          mismatchReasoning: result.mismatch_reasoning,
          diagnosisChoice: diagnosisChoice || 'skip',
        }),
      });

      if (!res.ok) { const d = await res.json(); alert('Failed to save: ' + d.error); return; }

      // 3) If they chose to change diagnosis — update it via PATCH
      const { id: reportId } = await res.json();
      if (diagnosisChoice === 'change' && result.matches[0]?.name) {
        await fetch(`/api/reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: profile.uid, diagnosisChoice: 'change', newDiseaseName: result.matches[0].name }),
        });
      }

      router.push('/patient/clinical-profile');
    } catch (e) { alert('Failed to save. ' + String(e)); }
    finally { setSaving(false); }
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
          <h1 className="text-3xl font-black text-dark-slate tracking-tight">{t('title')}</h1>
          <p className="text-light-slate font-medium mt-0.5">{t('subtitle')}</p>
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
                  {m === 'upload' ? <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> {t('uploadReport')}</span> : <span className="flex items-center gap-2"><Edit3 className="w-4 h-4" /> {t('describeSymp')}</span>}
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
                      <p className="text-xl font-bold text-dark-slate mb-1">{t('dropHere')}</p>
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

            {/* Mismatch / Match Alert */}
            <div className={`rounded-3xl border p-6 ${
              result.diagnosis_match_type === 'matches' ? 'bg-emerald-50 border-emerald-200' :
              result.diagnosis_match_type === 'differs'  ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {result.diagnosis_match_type === 'matches'         && <CheckCircle className="w-7 h-7 text-emerald-600" />}
                {result.diagnosis_match_type === 'differs'          && <AlertTriangle className="w-7 h-7 text-amber-600" />}
                {result.diagnosis_match_type === 'no_stated_disease' && <BookOpen className="w-7 h-7 text-blue-600" />}
                <div>
                  <h2 className="text-lg font-bold text-dark-slate">
                    {result.diagnosis_match_type === 'matches'          && 'AI Confirms Your Stated Diagnosis'}
                    {result.diagnosis_match_type === 'differs'           && <span className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 inline-block text-amber-600" /> Potential Misdiagnosis Detected</span>}
                    {result.diagnosis_match_type === 'no_stated_disease' && 'AI Diagnosis Complete'}
                  </h2>
                  {result.stated_disease && <p className="text-xs text-light-slate mt-0.5">Your stated diagnosis: <b>{result.stated_disease}</b></p>}
                </div>
              </div>
              <div className="bg-white/70 rounded-2xl p-4 mb-3">
                <p className="text-xs font-bold text-light-slate mb-1">AI Primary Diagnosis</p>
                <p className="font-bold text-dark-slate text-base">{result.matches[0]?.name} <span className="text-xs text-light-slate font-medium">(ORPHA:{result.matches[0]?.orpha_code})</span></p>
              </div>
              {result.mismatch_reasoning && (
                <div className="bg-white/70 rounded-2xl p-4">
                  <p className="text-xs font-bold text-light-slate mb-1">Clinical Reasoning</p>
                  <p className="text-sm text-dark-slate leading-relaxed">{result.mismatch_reasoning}</p>
                </div>
              )}

              {/* Diagnosis choice — only shown when there's a mismatch */}
              {result.diagnosis_match_type === 'differs' && (
                <div className="mt-4 pt-4 border-t border-amber-200/60">
                  <p className="text-xs font-bold text-amber-700 mb-3">What would you like to do with this finding?</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setDiagnosisChoice('change')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition-all ${diagnosisChoice === 'change' ? 'bg-primary-blue text-white border-primary-blue' : 'bg-white text-primary-blue border-primary-blue/30 hover:border-primary-blue'}`}
                    >
                      <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Change to AI Diagnosis</span>
                    </button>
                    <button
                      onClick={() => setDiagnosisChoice('keep')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition-all ${diagnosisChoice === 'keep' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-300 hover:border-emerald-500'}`}
                    >
                      <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Keep My Diagnosis</span>
                    </button>
                    <button
                      onClick={() => setDiagnosisChoice('skip')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition-all ${diagnosisChoice === 'skip' ? 'bg-surface-600 text-white border-surface-600' : 'bg-white text-light-slate border-surface-200 hover:border-surface-400'}`}
                    >
                      <span className="flex items-center justify-center gap-2"><SkipForward className="w-4 h-4" /> Skip for Later</span>
                    </button>
                  </div>
                  {diagnosisChoice && (
                    <p className="mt-2 text-xs text-amber-700 font-medium">
                      {diagnosisChoice === 'change' && '→ Your profile diagnosis will be updated to the AI finding when you save.'}
                      {diagnosisChoice === 'keep' && '→ Mismatch alert will be dismissed in your clinical profile.'}
                      {diagnosisChoice === 'skip' && '→ This mismatch will remain visible in your clinical profile for review later.'}
                    </p>
                  )}
                </div>
              )}
            </div>


            {/* AI Summary */}
            {result.ai_summary && (
              <div className="bg-gradient-to-br from-primary-blue/5 to-indigo-50 rounded-3xl border border-primary-blue/20 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-primary-blue" />
                  <h2 className="text-base font-bold text-dark-slate">{t('aiSummary')}</h2>
                </div>
                <p className="text-sm text-dark-slate leading-relaxed">{result.ai_summary}</p>
              </div>
            )}

            {/* Symptoms */}
            <div className="bg-white rounded-3xl border border-surface-200 p-6">
              <h2 className="text-base font-bold text-dark-slate mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-blue inline-block" /> {t('sympExtracted')} ({result.symptoms_extracted.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.symptoms_extracted.map((s, i) => (
                  <span key={i} className="px-3 py-1.5 bg-primary-blue/8 text-primary-blue text-xs font-bold rounded-full border border-primary-blue/15">{s}</span>
                ))}
              </div>
            </div>

            {/* Disease matches */}
            <div className="space-y-4">
              <h2 className="text-xl font-black text-dark-slate">{t('topMatches')}</h2>
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
                      <span className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-black border ${colors.badge}`}>{match.confidence}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden mb-4">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${match.confidence}%` }} transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
                        className={`h-full rounded-full ${colors.bar}`} />
                    </div>
                    {match.reasoning && <p className="text-xs text-light-slate font-medium mb-3 italic">{match.reasoning}</p>}
                    {match.matched_hpo && match.matched_hpo.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-surface-100">
                        <p className="text-xs font-bold text-light-slate mb-2 flex items-center gap-1.5"><Dna className="w-3.5 h-3.5" /> HPO Evidence ({match.matched_hpo.length} phenotypes)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {match.matched_hpo.slice(0, 6).map((h) => (
                            <span key={h.code} className="px-2 py-0.5 bg-violet-50 text-violet-700 text-xs font-bold rounded-lg border border-violet-200" title={h.code}>{h.name || h.code}</span>
                          ))}
                          {match.matched_hpo.length > 6 && <span className="px-2 py-0.5 bg-surface-100 text-light-slate text-xs rounded-lg border border-surface-200">+{match.matched_hpo.length - 6} more</span>}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {match.icd_codes.map((code) => <span key={code} className="px-2.5 py-1 bg-surface-100 text-light-slate text-xs font-bold rounded-lg border border-surface-200">ICD {code}</span>)}
                      {match.omim.map((code) => <span key={code} className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200">OMIM {code}</span>)}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={reset} className="py-3.5 rounded-2xl border-2 border-surface-200 text-dark-slate font-bold hover:border-primary-blue/30 hover:bg-surface-50 transition-all">{t('runAnother')}</button>
              <button
                onClick={() => downloadSecondOpinionPack(result, profile?.displayName || profile?.firstName || 'Patient')}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-violet-200 bg-violet-50 text-violet-700 font-bold hover:bg-violet-100 transition-all">
                <Download className="w-4 h-4" /> Second Opinion Pack
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary-blue text-white font-bold hover:bg-blue-700 shadow-[0_4px_14px_rgba(15,93,227,0.3)] transition-all disabled:opacity-60">
                {saving ? 'Saving...' : <><ChevronRight className="w-4 h-4" /> {t('saveToProfile')}</>}
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

