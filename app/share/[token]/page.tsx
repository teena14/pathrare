'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Sparkles, Calendar, Download, AlertTriangle, CheckCircle } from 'lucide-react';

interface ShareData {
  patient: { displayName: string; primaryDisease: string | null; diagnosisStatus: string | null; location: string | null };
  reports: Array<{ id: string; fileName: string; createdAt: string; aiDiagnosis: { name: string; orpha_code: string; confidence: number; icd_codes: string[]; omim: string[] } | null; aiSummary: string; diagnosisMatchType: string; symptoms: string[] }>;
  documents: Array<{ id: string; fileName: string; fileSize: number; uploadedAt: string; storageUrl: string }>;
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }); }
function fmtSize(b: number) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB'; }

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    params.then(p => {
      setToken(p.token);
      fetch(`/api/patient/share?token=${p.token}`)
        .then(r => r.json())
        .then(d => { if (d.error) setError(d.error); else setData(d); })
        .catch(() => setError('Failed to load profile.'));
    });
  }, [params]);

  if (error) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-rose-200 p-10 text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-dark-slate mb-2">Link Unavailable</h1>
        <p className="text-light-slate">{error}</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-3xl border border-surface-200 p-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xl font-black text-primary-blue">PathRare</span>
            <span className="text-xs font-bold text-light-slate bg-surface-100 px-2 py-0.5 rounded-full">Shared Clinical Profile</span>
          </div>
          <h1 className="text-2xl font-black text-dark-slate">{data.patient.displayName}</h1>
          <div className="flex flex-wrap gap-3 mt-3">
            {data.patient.primaryDisease && <span className="px-3 py-1 bg-primary-blue/10 text-primary-blue text-xs font-bold rounded-full">{data.patient.primaryDisease}</span>}
            {data.patient.diagnosisStatus && <span className="px-3 py-1 bg-surface-100 text-light-slate text-xs font-bold rounded-full capitalize">{data.patient.diagnosisStatus}</span>}
            {data.patient.location && <span className="px-3 py-1 bg-surface-100 text-light-slate text-xs font-bold rounded-full">{data.patient.location}</span>}
          </div>
          <p className="text-xs text-light-slate mt-3 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Read-only view · {data.reports.length} AI reports · {data.documents.length} documents
          </p>
        </div>

        {/* AI Reports */}
        {data.reports.length > 0 && (
          <div>
            <h2 className="text-lg font-black text-dark-slate mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary-blue" />AI Diagnoses</h2>
            <div className="space-y-4">
              {data.reports.map(r => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border border-surface-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-dark-slate">{r.fileName}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-light-slate mt-0.5"><Calendar className="w-3 h-3" />{fmtDate(r.createdAt)}</div>
                    </div>
                    {r.diagnosisMatchType === 'differs' && <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-fit"><AlertTriangle className="w-3.5 h-3.5" /> Mismatch</span>}
                    {r.diagnosisMatchType === 'matches' && <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit"><CheckCircle className="w-3.5 h-3.5" /> Confirmed</span>}
                  </div>
                  {r.aiDiagnosis && (
                    <div className="bg-surface-50 rounded-2xl p-3 mb-3">
                      <p className="text-xs font-bold text-light-slate mb-0.5">AI Diagnosis</p>
                      <p className="font-bold text-dark-slate">{r.aiDiagnosis.name}</p>
                      <p className="text-xs text-light-slate">ORPHA:{r.aiDiagnosis.orpha_code} · {r.aiDiagnosis.confidence}%</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {r.aiDiagnosis.icd_codes?.map(c => <span key={c} className="px-2 py-0.5 bg-white text-light-slate text-xs rounded-lg border border-surface-200">ICD {c}</span>)}
                        {r.aiDiagnosis.omim?.map(c => <span key={c} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-lg border border-amber-200">OMIM {c}</span>)}
                      </div>
                    </div>
                  )}
                  {r.aiSummary && <p className="text-sm text-dark-slate leading-relaxed">{r.aiSummary}</p>}
                  {r.symptoms?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.symptoms.slice(0, 6).map((s, i) => <span key={i} className="px-2.5 py-1 bg-primary-blue/8 text-primary-blue text-xs font-bold rounded-full border border-primary-blue/15">{s}</span>)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        {data.documents.length > 0 && (
          <div>
            <h2 className="text-lg font-black text-dark-slate mb-3 flex items-center gap-2"><FileText className="w-5 h-5 text-primary-blue" />Medical Documents</h2>
            <div className="space-y-3">
              {data.documents.map(doc => (
                <div key={doc.id} className="bg-white rounded-2xl border border-surface-200 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-dark-slate text-sm">{doc.fileName}</p>
                    <p className="text-xs text-light-slate">{fmtSize(doc.fileSize)} · {fmtDate(doc.uploadedAt)}</p>
                  </div>
                  <a href={doc.storageUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-blue text-white text-xs font-bold hover:bg-blue-700 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-light-slate pb-4">This is a shared clinical profile from PathRare. For personal use only — do not distribute without patient consent.</p>
      </div>
    </div>
  );
}
