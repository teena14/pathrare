'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, UserRoundX, Users } from 'lucide-react';
import { useNgoDashboard } from '@/features/ngo/context/ngo-dashboard-context';
import { compactPatientConnectionSummary } from '@/services/ngo/ngo-support';

function formatRelativeTime(value?: string) {
  if (!value) return 'just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';

  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  return 'over 30 days ago';
}

export default function NgoPatientsPage() {
  const {
    loading,
    error,
    incomingPatientConnections,
    connectedPatients,
    acceptPatientConnection,
    declinePatientConnection,
  } = useNgoDashboard();
  const [actionError, setActionError] = useState('');
  const [actingRequestId, setActingRequestId] = useState('');

  const handleAction = async (requestId: string, action: 'accept' | 'decline') => {
    setActionError('');
    setActingRequestId(requestId);

    try {
      if (action === 'accept') {
        await acceptPatientConnection(requestId);
      } else {
        await declinePatientConnection(requestId);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to update patient request.');
    } finally {
      setActingRequestId('');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
      <section className="theme-card rounded-[2rem] p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="theme-heading-40 text-dark-slate">Patient Connections</h1>
            <p className="theme-body mt-2 text-light-slate">Review direct NGO requests first, then keep track of everyone already connected to your organisation.</p>
          </div>
          <div className="theme-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold">
            <Users className="h-3.5 w-3.5" />
            {incomingPatientConnections.length} incoming
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {actionError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h2 className="theme-title-24 text-dark-slate">Incoming Requests</h2>
            <p className="mt-1 text-sm font-medium text-light-slate">Accept to add the patient to your connected list, or decline to close the request.</p>
          </div>

          {loading && (
            <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
              Loading patient connection requests...
            </div>
          )}

          {!loading && incomingPatientConnections.length === 0 && (
            <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
              No incoming patient connection requests right now.
            </div>
          )}

          {incomingPatientConnections.map((request) => (
            <div key={request.id} className="theme-soft rounded-[1.8rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-dark-slate">{request.patientName}</h3>
                  <p className="mt-1 text-xs font-medium text-light-slate">{request.patientLocation}</p>
                </div>
                <span className="rounded-full bg-brand-blue-50 px-2.5 py-1 text-xs font-bold text-primary-blue uppercase">
                  {request.status}
                </span>
              </div>

              {request.patientCondition && (
                <p className="mt-3 text-xs font-bold text-primary-blue">Condition focus: {request.patientCondition}</p>
              )}

              <p className="mt-3 text-sm font-medium text-dark-slate leading-6">
                {compactPatientConnectionSummary(request.patientSummary, request.patientLocation, request.patientCondition)}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold">
                <span className="text-light-slate">{formatRelativeTime(request.createdAt)}</span>
                {request.clinicalProfileUrl ? (
                  <Link href={request.clinicalProfileUrl} className="text-primary-blue hover:text-blue-700 transition-colors">
                    Open clinical profile
                  </Link>
                ) : (
                  <span className="text-light-slate">Clinical profile link will appear here once shared.</span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => void handleAction(request.id, 'accept')}
                  disabled={actingRequestId === request.id}
                  className="theme-primary rounded-full px-4 py-2 text-sm font-bold disabled:bg-brand-slate-100 disabled:text-light-slate disabled:shadow-none"
                >
                  Accept patient
                </button>
                <button
                  onClick={() => void handleAction(request.id, 'decline')}
                  disabled={actingRequestId === request.id}
                  className="rounded-full border border-surface-200 px-4 py-2 text-sm font-bold text-light-slate transition-colors hover:text-rose-600 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="theme-card rounded-[2rem] p-6">
          <div className="mb-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary-blue" />
            <h2 className="theme-title-24 text-dark-slate">Connected Patients</h2>
          </div>

          <div className="space-y-4">
            {!loading && connectedPatients.length === 0 && (
              <div className="theme-soft rounded-2xl p-5 text-sm font-medium text-light-slate">
                No patients have been accepted into your NGO connection list yet.
              </div>
            )}

            {connectedPatients.map((request) => (
              <div key={request.id} className="theme-soft rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-dark-slate">{request.patientName}</p>
                    <p className="mt-1 text-xs font-medium text-light-slate">{request.patientLocation}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 uppercase">
                    Connected
                  </span>
                </div>

                {request.patientCondition && (
                  <p className="mt-3 text-xs font-bold text-primary-blue">Condition focus: {request.patientCondition}</p>
                )}

                <p className="mt-3 text-sm font-medium text-dark-slate leading-6">
                  {compactPatientConnectionSummary(request.patientSummary, request.patientLocation, request.patientCondition)}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold">
                  <span className="text-light-slate">{formatRelativeTime(request.createdAt)}</span>
                  {request.clinicalProfileUrl ? (
                    <Link href={request.clinicalProfileUrl} className="text-primary-blue hover:text-blue-700 transition-colors">
                      Open clinical profile
                    </Link>
                  ) : (
                    <span className="text-light-slate">Clinical profile link will appear here once shared.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="theme-card rounded-[2rem] p-6">
          <div className="mb-4 flex items-center gap-3">
            <UserRoundX className="h-5 w-5 text-light-slate" />
            <h2 className="theme-title-24 text-dark-slate">How This Works</h2>
          </div>
          <div className="space-y-3 text-sm font-medium text-dark-slate">
            <div className="theme-soft rounded-2xl p-4">Pending requests are patients who clicked Connect with NGO from the medical Life Assist tab.</div>
            <div className="theme-soft rounded-2xl p-4">Accepting moves the patient into your connected list so your team can continue coordination.</div>
            <div className="theme-soft rounded-2xl p-4">Declining removes the request from your incoming queue while preserving the audit trail in Firestore.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
