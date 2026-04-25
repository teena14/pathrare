'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Calendar, Share2, QrCode, Edit3, Trash2, Plus, Check, X, Copy, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface Report {
  reportId: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  symptoms: string[];
  aiDiagnosis: {
    orpha_code: string;
    name: string;
    confidence: number;
    icd_codes: string[];
    omim: string[];
  };
  reportDiagnosis: string | null;
  diagnosisMatchType: 'matches' | 'differs' | 'no_report_diagnosis';
  reasoning: string;
  isEdited: boolean;
}

export default function ClinicalProfilePage() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [editingReport, setEditingReport] = useState<string | null>(null);
  const [editReasoning, setEditReasoning] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');

  useEffect(() => {
    if (profile?.uid) {
      fetchReports();
    }
  }, [profile]);

  const fetchReports = async () => {
    try {
      const res = await fetch(`/api/reports?patientId=${profile?.uid}`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateShareLink = async () => {
    try {
      const res = await fetch('/api/patient/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: profile?.uid }),
      });
      const data = await res.json();
      setShareUrl(data.shareUrl);
    } catch (error) {
      alert('Failed to generate share link');
    }
  };

  const copyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  const startEdit = (report: Report) => {
    setEditingReport(report.reportId);
    setEditReasoning(report.reasoning);
    setEditDiagnosis(report.reportDiagnosis || '');
  };

  const saveEdit = async (reportId: string) => {
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: profile?.uid,
          reportDiagnosis: editDiagnosis || null,
          reasoning: editReasoning,
        }),
      });
      if (res.ok) {
        await fetchReports();
        setEditingReport(null);
      } else {
        alert('Failed to save changes');
      }
    } catch (error) {
      alert('Failed to save changes');
    }
  };

  const cancelEdit = () => {
    setEditingReport(null);
    setEditReasoning('');
    setEditDiagnosis('');
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    try {
      const res = await fetch(`/api/reports/${reportId}?patientId=${profile?.uid}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchReports();
      } else {
        alert('Failed to delete report');
      }
    } catch (error) {
      alert('Failed to delete report');
    }
  };

  const getMatchTypeColor = (type: string) => {
    switch (type) {
      case 'matches': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'differs': return 'bg-amber-50 border-amber-200 text-amber-700';
      default: return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case 'matches': return 'Confirmed';
      case 'differs': return 'Differs';
      default: return 'No Report Diagnosis';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-light-slate font-medium">Loading clinical profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary-blue/10">
            <FileText className="w-7 h-7 text-primary-blue" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-dark-slate tracking-tight">Clinical Profile</h1>
            <p className="text-light-slate font-medium mt-0.5">Your diagnostic history and reports</p>
          </div>
        </div>
        <button
          onClick={generateShareLink}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-blue text-white font-bold hover:bg-blue-700 transition-colors"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {shareUrl && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl border border-surface-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-dark-slate">Share with Doctor</h3>
              <button onClick={() => setShareUrl(null)} className="text-light-slate hover:text-dark-slate">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-50 border border-surface-200 text-sm font-medium text-dark-slate"
              />
              <button
                onClick={copyShareLink}
                className="px-4 py-2.5 rounded-xl bg-surface-100 border border-surface-200 text-dark-slate font-bold hover:bg-surface-200 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowQr(!showQr)}
                className="px-4 py-2.5 rounded-xl bg-surface-100 border border-surface-200 text-dark-slate font-bold hover:bg-surface-200 transition-colors"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
            {showQr && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 flex justify-center"
              >
                <div className="bg-white p-4 rounded-2xl border border-surface-200">
                  <div className="w-48 h-48 bg-surface-100 rounded-xl flex items-center justify-center">
                    <QrCode className="w-16 h-16 text-light-slate" />
                  </div>
                  <p className="text-center text-xs text-light-slate mt-2">Scan to view clinical profile</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-3xl border border-surface-200 p-12 text-center">
          <FileText className="w-16 h-16 text-surface-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-dark-slate mb-2">No reports yet</h3>
          <p className="text-light-slate font-medium mb-6">Upload your first medical report to get started</p>
          <a
            href="/patient/diagnose"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-blue text-white font-bold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Upload Report
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <motion.div
              key={report.reportId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-surface-200 p-6 hover:border-primary-blue/30 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-dark-slate">{report.fileName}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getMatchTypeColor(report.diagnosisMatchType)}`}>
                      {getMatchTypeLabel(report.diagnosisMatchType)}
                    </span>
                    {report.isEdited && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-surface-100 text-light-slate border border-surface-200">
                        Edited
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-light-slate">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(report.uploadedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(report)}
                    className="p-2 rounded-lg hover:bg-surface-100 text-light-slate hover:text-dark-slate transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteReport(report.reportId)}
                    className="p-2 rounded-lg hover:bg-rose-50 text-light-slate hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Edit Mode */}
              {editingReport === report.reportId ? (
                <div className="space-y-4 p-4 bg-surface-50 rounded-2xl">
                  <div>
                    <label className="text-xs font-bold text-light-slate mb-1 block">Report Diagnosis (if any)</label>
                    <input
                      type="text"
                      value={editDiagnosis}
                      onChange={(e) => setEditDiagnosis(e.target.value)}
                      placeholder="Diagnosis from the report"
                      className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-light-slate mb-1 block">Reasoning</label>
                    <textarea
                      value={editReasoning}
                      onChange={(e) => setEditReasoning(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(report.reportId)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-blue text-white text-sm font-bold hover:bg-blue-700 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 text-dark-slate text-sm font-bold hover:bg-surface-300 transition-colors"
                    >
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Diagnosis Comparison */}
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {report.reportDiagnosis && (
                      <div className="bg-surface-50 rounded-2xl p-4">
                        <p className="text-xs font-bold text-light-slate mb-1">Report Diagnosis</p>
                        <p className="font-bold text-dark-slate text-sm">{report.reportDiagnosis}</p>
                      </div>
                    )}
                    <div className="bg-surface-50 rounded-2xl p-4">
                      <p className="text-xs font-bold text-light-slate mb-1">AI Diagnosis</p>
                      <p className="font-bold text-dark-slate text-sm">{report.aiDiagnosis.name}</p>
                      <p className="text-xs text-light-slate mt-1">ORPHA:{report.aiDiagnosis.orpha_code} • {report.aiDiagnosis.confidence}% confidence</p>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="bg-surface-50 rounded-2xl p-4 mb-4">
                    <p className="text-xs font-bold text-light-slate mb-1">Reasoning</p>
                    <p className="text-sm text-dark-slate leading-relaxed">{report.reasoning}</p>
                  </div>

                  {/* Symptoms */}
                  <div className="flex flex-wrap gap-2">
                    {report.symptoms.map((symptom, i) => (
                      <span key={i} className="px-2.5 py-1 bg-primary-blue/8 text-primary-blue text-xs font-bold rounded-full border border-primary-blue/15">
                        {symptom}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
