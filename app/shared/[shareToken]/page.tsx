'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { FileText, Calendar, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';

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

interface SharedData {
  patientId: string;
  shareToken: string;
  reports: Report[];
  reportCount: number;
  lastReportAt: string | null;
}

export default function SharedProfilePage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = use(params);
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSharedData();
  }, [shareToken]);

  const fetchSharedData = async () => {
    try {
      const res = await fetch(`/api/shared/${shareToken}`);
      const result = await res.json();
      
      if (!res.ok) {
        setError(result.error || 'Failed to load shared profile');
        return;
      }
      
      setData(result);
    } catch (err) {
      setError('Failed to load shared profile');
    } finally {
      setLoading(false);
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
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-light-slate font-medium">Loading clinical profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl border border-surface-200 p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-dark-slate mb-2">Unable to Load Profile</h3>
          <p className="text-light-slate font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-3xl border border-surface-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary-blue/10">
              <FileText className="w-7 h-7 text-primary-blue" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-dark-slate tracking-tight">Shared Clinical Profile</h1>
              <p className="text-light-slate font-medium mt-0.5">View-only access to diagnostic history</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-700">View Only</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-surface-200 p-4">
            <p className="text-xs font-bold text-light-slate mb-1">Total Reports</p>
            <p className="text-2xl font-black text-dark-slate">{data?.reportCount || 0}</p>
          </div>
          <div className="bg-white rounded-2xl border border-surface-200 p-4">
            <p className="text-xs font-bold text-light-slate mb-1">Last Updated</p>
            <p className="text-sm font-bold text-dark-slate">
              {data?.lastReportAt 
                ? new Date(data.lastReportAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Never'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-surface-200 p-4 col-span-2 md:col-span-1">
            <p className="text-xs font-bold text-light-slate mb-1">Profile ID</p>
            <p className="text-sm font-bold text-dark-slate font-mono">{data?.shareToken.slice(0, 8)}...</p>
          </div>
        </div>

        {/* Reports List */}
        {data?.reports && data.reports.length > 0 ? (
          <div className="space-y-4">
            {data.reports.map((report, index) => (
              <motion.div
                key={report.reportId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-3xl border border-surface-200 p-6"
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
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>

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
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-surface-200 p-12 text-center">
            <FileText className="w-16 h-16 text-surface-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-dark-slate mb-2">No reports shared yet</h3>
            <p className="text-light-slate font-medium">The patient hasn't uploaded any reports yet</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-light-slate">
          <p>This is a view-only shared profile. Changes cannot be made.</p>
          <p className="mt-1">Powered by PathRare</p>
        </div>
      </div>
    </div>
  );
}
