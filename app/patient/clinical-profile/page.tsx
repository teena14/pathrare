'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Calendar, Share2, Trash2, Plus, X, Copy, Download, AlertTriangle, CheckCircle, Sparkles, RefreshCw, Dna, SkipForward, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { uploadPatientDocument } from '@/lib/document-upload';
import { useT } from '@/lib/use-t';

interface AIReport {
  id: string; patientId: string; fileName: string; createdAt: string;
  symptoms: string[]; symptoms_with_hpo?: { term: string; hpo_code: string }[];
  aiDiagnosis: { orpha_code: string; name: string; confidence: number; icd_codes: string[]; omim: string[]; matched_hpo?: { code: string; name: string }[] } | null;
  allMatches?: unknown[]; statedDisease: string | null;
  diagnosisMatchType: 'matches' | 'differs' | 'no_stated_disease';
  diagnosisChoice?: 'change' | 'keep' | 'skip' | null;
  aiSummary: string; mismatchReasoning: string;
}
interface MedDoc {
  id: string; patientId: string; fileName: string; fileSize: number;
  fileType: string; storageUrl: string; storagePath: string; uploadedAt: string;
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }); }
function fmtSize(b: number) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB'; }

function generateSOP(report: AIReport, name: string): string {
  const top = report.aiDiagnosis;
  const date = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
  const bg = report.diagnosisMatchType === 'matches' ? '#d1fae5' : report.diagnosisMatchType === 'differs' ? '#fef3c7' : '#eff6ff';
  const color = report.diagnosisMatchType === 'matches' ? '#065f46' : report.diagnosisMatchType === 'differs' ? '#92400e' : '#1e3a8a';
  const label = report.diagnosisMatchType === 'matches' ? 'Confirmed' : report.diagnosisMatchType === 'differs' ? 'Potential Misdiagnosis' : 'New Diagnosis';
  const hpoRows = (report.symptoms_with_hpo || []).map(s => `<tr><td style="padding:6px 12px">${s.term}</td><td style="padding:6px 12px"><code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:12px">${s.hpo_code || '—'}</code></td></tr>`).join('');
  const topHPO = (top?.matched_hpo || []).slice(0, 10).map(h => `<li>${h.name} <code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:11px">${h.code}</code></li>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>PathRare Second Opinion</title>
<style>body{font-family:-apple-system,sans-serif;color:#111827;margin:0;background:#f9fafb}.page{max-width:860px;margin:0 auto;padding:40px 32px;background:#fff}
h1{font-size:26px;font-weight:900;color:#0f5de3;margin:0}h2{font-size:17px;font-weight:800;margin:24px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:5px}
table{width:100%;border-collapse:collapse;font-size:14px}th{background:#0f5de3;color:#fff;padding:8px 12px;text-align:left}td{padding:8px 12px}tr:nth-child(even){background:#f9fafb}
.disc{margin-top:28px;padding:12px;background:#fef9c3;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#713f12}</style></head>
<body><div class="page">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
  <div><h1>PathRare Second Opinion</h1><p style="color:#6b7280;margin:4px 0 0">AI-Powered Rare Disease Report</p></div>
  <div style="text-align:right;font-size:13px;color:#6b7280"><div>Date: ${date}</div><div>Patient: ${name}</div></div>
</div>
<div style="background:${bg};border-radius:10px;padding:14px 18px;margin-bottom:20px">
  <div style="font-size:15px;font-weight:800;color:${color};margin-bottom:6px">${label}</div>
  ${report.statedDisease ? `<div style="font-size:13px;color:${color}"><b>Stated:</b> ${report.statedDisease}</div>` : ''}
  <div style="font-size:13px;color:${color};margin-top:4px"><b>AI Diagnosis:</b> ${top?.name || '—'} (ORPHA:${top?.orpha_code || '—'}) — ${top?.confidence || 0}%</div>
  ${report.mismatchReasoning ? `<div style="font-size:13px;color:${color};margin-top:6px">${report.mismatchReasoning}</div>` : ''}
</div>
<h2>AI Clinical Summary</h2><p style="line-height:1.7;font-size:14px">${report.aiSummary}</p>
<h2>Extracted Symptoms</h2>
<table><thead><tr><th>Symptom</th><th>HPO Code</th></tr></thead><tbody>${hpoRows || '<tr><td colspan="2" style="color:#6b7280">No HPO-mapped symptoms.</td></tr>'}</tbody></table>
${topHPO ? `<h2>HPO Evidence — ${top?.name}</h2><ul style="font-size:14px;line-height:1.8">${topHPO}</ul>` : ''}
<h2>Clinical Codes</h2>
<p style="font-size:14px">ICD: ${(top?.icd_codes || []).join(', ') || '—'} &nbsp;|&nbsp; OMIM: ${(top?.omim || []).join(', ') || '—'}</p>
<div class="disc"><b>Disclaimer:</b> AI-generated. Consult a qualified clinician. Not a medical diagnosis.</div>
</div></body></html>`;
}

export default function ClinicalProfilePage() {
  const { profile } = useAuth();
  const t = useT('clinicalProfile');
  const [tab, setTab] = useState<'reports' | 'documents'>('reports');
  const [reports, setReports] = useState<AIReport[]>([]);
  const [docs, setDocs] = useState<MedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile?.uid) return;

    let cancelled = false;

    const loadClinicalProfile = async () => {
      setLoading(true);
      try {
        const [reportsRes, documentsRes] = await Promise.all([
          fetch(`/api/reports?patientId=${profile.uid}`, { cache: 'no-store' }),
          fetch(`/api/documents?patientId=${profile.uid}`, { cache: 'no-store' }),
        ]);

        const [r, d] = await Promise.all([reportsRes.json(), documentsRes.json()]);

        if (!reportsRes.ok) throw new Error(r.error || 'Failed to load reports');
        if (!documentsRes.ok) throw new Error(d.error || 'Failed to load documents');

        if (!cancelled) {
          setReports(r.reports || []);
          setDocs(d.documents || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadClinicalProfile();

    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this AI report?')) return;
    await fetch(`/api/reports/${id}?patientId=${profile!.uid}`, { method: 'DELETE' });
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const deleteDoc = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    const res = await fetch(`/api/documents/${id}?patientId=${profile!.uid}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert('Delete failed: ' + (data?.error || 'Unknown error'));
      return;
    }
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleChoiceUpdate = async (reportId: string, choice: 'change' | 'keep' | 'skip', aiDiseaseName?: string) => {
    await fetch(`/api/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: profile!.uid, diagnosisChoice: choice, newDiseaseName: choice === 'change' ? aiDiseaseName : undefined }),
    });
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, diagnosisChoice: choice } : r));
  };

  const generateShare = async () => {
    const res = await fetch('/api/patient/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: profile!.uid }) });
    const d = await res.json();
    setShareUrl(d.shareUrl || '');
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !profile?.uid) return;
    setUploadingDoc(true);
    try {
      const document = await uploadPatientDocument(profile.uid, f);
      setDocs(prev => [document, ...prev]);
    } catch (err) { alert('Upload failed: ' + String(err)); }
    finally { setUploadingDoc(false); if (docFileRef.current) docFileRef.current.value = ''; }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto py-16 text-center">
      <div className="animate-spin w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-light-slate font-medium">Loading clinical profile...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary-blue/10"><FileText className="w-7 h-7 text-primary-blue" /></div>
          <div>
            <h1 className="text-3xl font-black text-dark-slate">{t('title')}</h1>
            <p className="text-light-slate font-medium mt-0.5">{profile?.displayName || 'Patient'} — {reports.length} AI reports · {docs.length} documents</p>
          </div>
        </div>
        <button onClick={generateShare} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-blue text-white font-bold hover:bg-blue-700 transition-colors text-sm">
          <Share2 className="w-4 h-4" /> {t('shareProfile')}
        </button>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {shareUrl && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white rounded-3xl border border-surface-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-dark-slate">Share with Doctor / Caregiver</h3>
              <button onClick={() => setShareUrl(null)}><X className="w-5 h-5 text-light-slate hover:text-dark-slate" /></button>
            </div>
            <p className="text-xs text-light-slate mb-3">This link gives read-only access to your clinical profile for 30 days.</p>
            <div className="flex gap-2">
              <input readOnly value={shareUrl} className="flex-1 px-4 py-2.5 rounded-xl bg-surface-50 border border-surface-200 text-sm font-medium text-dark-slate" />
              <button onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-blue text-white font-bold text-sm hover:bg-blue-700 transition-colors">
                {copied ? <><CheckCircle className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="inline-flex p-1 bg-surface-100 rounded-2xl gap-1">
        {(['reports', 'documents'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${tab === tabKey ? 'bg-white text-dark-slate shadow-sm' : 'text-light-slate hover:text-dark-slate'}`}>
            {tabKey === 'reports' ? <span className="flex items-center gap-2"><Dna className="w-4 h-4" /> {t('tabDiagnoses')} ({reports.length})</span> : <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> {t('tabDocuments')} ({docs.length})</span>}
          </button>
        ))}
      </div>

      {/* AI Reports Tab */}
      {tab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-white rounded-3xl border border-surface-200 p-12 text-center">
              <Sparkles className="w-12 h-12 text-surface-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-dark-slate mb-2">{t('noDiagnoses')}</h3>
              <p className="text-light-slate mb-6">Run the diagnostic engine to get your first AI-powered diagnosis.</p>
              <a href="/patient/diagnose" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-blue text-white font-bold hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4" /> {t('startDiagnosis')}
              </a>
            </div>
          ) : reports.map(report => {
            const showMismatch = report.diagnosisMatchType === 'differs' && report.diagnosisChoice !== 'keep';
            return (
              <motion.div key={report.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-surface-200 p-6 hover:border-primary-blue/30 transition-all">
                {/* Card header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-dark-slate">{report.fileName}</h3>
                      {report.diagnosisMatchType === 'matches' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Confirmed</span>}
                      {showMismatch && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Mismatch</span>}
                      {report.diagnosisChoice === 'keep' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-surface-100 text-light-slate border border-surface-200">Kept Initial</span>}
                      {report.diagnosisChoice === 'change' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary-blue/10 text-primary-blue border border-primary-blue/20">Changed to AI</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-light-slate"><Calendar className="w-3.5 h-3.5" />{fmtDate(report.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const h = generateSOP(report, profile?.displayName || 'Patient'); const b = new Blob([h], { type: 'text/html' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `second-opinion-${report.id}.html`; a.click(); URL.revokeObjectURL(u); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold border border-violet-200 hover:bg-violet-100 transition-colors">
                      <Download className="w-3.5 h-3.5" /> SOP
                    </button>
                    <button onClick={() => deleteReport(report.id)} className="p-2 rounded-xl hover:bg-rose-50 text-light-slate hover:text-rose-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* AI Diagnosis */}
                {report.aiDiagnosis && (
                  <div className="bg-surface-50 rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-light-slate mb-0.5">AI Diagnosis</p>
                        <p className="font-bold text-dark-slate">{report.aiDiagnosis.name}</p>
                        <p className="text-xs text-light-slate mt-0.5">ORPHA:{report.aiDiagnosis.orpha_code} · {report.aiDiagnosis.confidence}% confidence</p>
                      </div>
                      {report.statedDisease && report.diagnosisMatchType === 'differs' && (
                        <div className="text-right">
                          <p className="text-xs font-bold text-light-slate mb-0.5">Stated Diagnosis</p>
                          <p className="font-bold text-dark-slate text-sm">{report.statedDisease}</p>
                        </div>
                      )}
                    </div>
                    {(report.aiDiagnosis.icd_codes?.length > 0 || report.aiDiagnosis.omim?.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {report.aiDiagnosis.icd_codes?.map(c => <span key={c} className="px-2 py-0.5 bg-white text-light-slate text-xs font-bold rounded-lg border border-surface-200">ICD {c}</span>)}
                        {report.aiDiagnosis.omim?.map(c => <span key={c} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200">OMIM {c}</span>)}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Summary */}
                {report.aiSummary && (
                  <div className="bg-gradient-to-br from-primary-blue/5 to-indigo-50 rounded-2xl p-4 mb-4 border border-primary-blue/10">
                    <div className="flex items-center gap-1.5 mb-2"><Sparkles className="w-4 h-4 text-primary-blue" /><p className="text-xs font-bold text-primary-blue">AI Summary</p></div>
                    <p className="text-sm text-dark-slate leading-relaxed">{report.aiSummary}</p>
                  </div>
                )}

                {/* Mismatch Alert */}
                {showMismatch && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5 text-amber-600" /><p className="font-bold text-amber-800 text-sm">Potential Misdiagnosis Detected</p></div>
                    {report.mismatchReasoning && <p className="text-xs text-amber-700 leading-relaxed mb-3">{report.mismatchReasoning}</p>}
                    <p className="text-xs font-bold text-amber-700 mb-2">Update your diagnosis decision:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['change', 'keep', 'skip'] as const).map(c => (
                        <button key={c} onClick={() => handleChoiceUpdate(report.id, c, report.aiDiagnosis?.name)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border-2 transition-all ${report.diagnosisChoice === c ? (c === 'change' ? 'bg-primary-blue text-white border-primary-blue' : c === 'keep' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-surface-500 text-white border-surface-500') : 'bg-white border-amber-200 text-amber-700 hover:border-amber-400'}`}>
                          {c === 'change' ? <span className="flex items-center justify-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/> Change to AI</span> : c === 'keep' ? <span className="flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5"/> Keep Initial</span> : <span className="flex items-center justify-center gap-1.5"><SkipForward className="w-3.5 h-3.5"/> Skip for Later</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Symptoms */}
                {report.symptoms?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {report.symptoms.slice(0, 8).map((s, i) => <span key={i} className="px-2.5 py-1 bg-primary-blue/8 text-primary-blue text-xs font-bold rounded-full border border-primary-blue/15">{s}</span>)}
                    {report.symptoms.length > 8 && <span className="px-2.5 py-1 bg-surface-100 text-light-slate text-xs rounded-full">+{report.symptoms.length - 8} more</span>}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Medical Documents Tab */}
      {tab === 'documents' && (
        <div className="space-y-4">
          {/* Upload button */}
          <div className="bg-white rounded-3xl border-2 border-dashed border-surface-200 p-6 flex items-center justify-between hover:border-primary-blue/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary-blue/10"><Plus className="w-5 h-5 text-primary-blue" /></div>
              <div>
                <p className="font-bold text-dark-slate text-sm">{t('uploadDoc')}</p>
                <p className="text-xs text-light-slate">PDF, images — stored securely in your profile</p>
              </div>
            </div>
            <input ref={docFileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleDocUpload} />
            <button onClick={() => docFileRef.current?.click()} disabled={uploadingDoc}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-blue text-white font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60">
              {uploadingDoc ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</> : <><Plus className="w-4 h-4" /> Choose File</>}
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="bg-white rounded-3xl border border-surface-200 p-12 text-center">
              <FileText className="w-12 h-12 text-surface-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-dark-slate mb-2">{t('noDocs')}</h3>
              <p className="text-light-slate">Upload your medical reports, prescriptions, or test results.</p>
            </div>
          ) : docs.map(doc => (
            <motion.div key={doc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-surface-200 p-5 flex items-center justify-between hover:border-primary-blue/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-light-slate" />
                </div>
                <div>
                  <p className="font-bold text-dark-slate text-sm">{doc.fileName}</p>
                  <p className="text-xs text-light-slate mt-0.5">{fmtSize(doc.fileSize)} · {fmtDate(doc.uploadedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={doc.storageUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 text-dark-slate text-xs font-bold border border-surface-200 hover:bg-surface-200 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button onClick={() => deleteDoc(doc.id)} className="p-2 rounded-xl hover:bg-rose-50 text-light-slate hover:text-rose-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
