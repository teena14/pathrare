'use client';

import { useState } from 'react';
import { Filter, Trash2 } from 'lucide-react';
import {
  availabilityTone,
  CaseStatus,
  statusTone,
  urgencyTone,
  useNgoDashboard,
} from '@/features/ngo/context/ngo-dashboard-context';

export default function NgoCasesPage() {
  const {
    filteredCases,
    volunteerLookup,
    setAssignmentTarget,
    selectedAssignmentCase,
    assignVolunteer,
    deleteCase,
    loading,
    error,
  } = useNgoDashboard();
  const [assignmentError, setAssignmentError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleAssignVolunteer = async (caseId: string, volunteerId: string) => {
    setAssignmentError('');

    try {
      await assignVolunteer(caseId, volunteerId);
    } catch (err: unknown) {
      setAssignmentError(err instanceof Error ? err.message : 'Unable to assign volunteer.');
    }
  };

  const canDeleteCase = (status: CaseStatus) => status === 'Resolved' || status === 'Handled Externally';

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <section className="theme-card rounded-[2rem] p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="theme-heading-40 text-dark-slate">Relevant Cases</h1>
            <p className="theme-body mt-2 text-light-slate">Summaries are anonymized, urgency-ranked, and ready for action.</p>
          </div>
          <div className="theme-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold">
            <Filter className="h-3.5 w-3.5" />
            {filteredCases.length} visible
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        {deleteError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {deleteError}
          </div>
        )}

        <div className="space-y-4">
          {loading && (
            <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
              Loading real patient cases...
            </div>
          )}

          {!loading && filteredCases.length === 0 && (
            <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
              No real patient cases match these filters yet. Patient help requests saved in Firestore will appear here.
            </div>
          )}

          {filteredCases.map((request) => (
            <div key={request.id} className="theme-soft rounded-[1.8rem] p-5 transition-colors hover:border-brand-slate-200">
              <div className="mb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-dark-slate">{request.title}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${urgencyTone(request.urgency)}`}>{request.urgency}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(request.status)}`}>{request.status}</span>
                  </div>
                  <button
                    onClick={async () => {
                      setDeleteError('');
                      try {
                        await deleteCase(request.id);
                      } catch (err: unknown) {
                        setDeleteError(err instanceof Error ? err.message : 'Unable to delete case from dashboard.');
                      }
                    }}
                    disabled={!canDeleteCase(request.status)}
                    title={canDeleteCase(request.status) ? 'Delete from dashboard' : 'Only resolved or externally handled cases can be deleted'}
                    className="rounded-full border border-surface-200 p-2 text-light-slate transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-xs font-medium text-light-slate">{request.district} - {request.region}</p>
                <p className="mt-1 text-xs font-bold text-light-slate">
                  Need type - <span className="text-primary-blue">{request.needType}</span>
                </p>
              </div>

              <p className="theme-body text-dark-slate">{request.summary}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {request.suggestedVolunteerIds.length > 0 ? request.suggestedVolunteerIds.map((id) => (
                  <span key={id} className="theme-pill rounded-full px-2.5 py-1 text-xs font-bold">
                    Suggested: {volunteerLookup.get(id)?.name ?? id}
                  </span>
                )) : (
                  <span className="theme-pill rounded-full px-2.5 py-1 text-xs font-bold">
                    No matching available volunteer profile yet
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium text-light-slate">
                  {request.assignedVolunteerId
                    ? `Assigned to ${volunteerLookup.get(request.assignedVolunteerId)?.name ?? 'volunteer'}`
                    : 'No volunteer locked yet'}
                </div>
                <button
                  onClick={() => setAssignmentTarget(request.id)}
                  disabled={request.status !== 'Unassigned'}
                  className="theme-primary rounded-full px-4 py-2 text-sm font-bold disabled:bg-brand-slate-100 disabled:text-light-slate disabled:shadow-none"
                >
                  {request.status === 'Unassigned' ? 'Assign volunteer' : 'Case locked'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-4 text-dark-slate">Assignment Panel</h2>
          {!selectedAssignmentCase && (
            <div className="theme-soft rounded-2xl p-5 text-sm font-medium text-light-slate">
              Select an unassigned case to open a filtered volunteer list based on skill and availability.
            </div>
          )}

          {selectedAssignmentCase && (
            <div className="space-y-4">
              {assignmentError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                  {assignmentError}
                </div>
              )}

              <div className="theme-soft rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-light-slate">Selected case</p>
                <p className="mt-2 text-sm font-black text-dark-slate">{selectedAssignmentCase.title}</p>
                <p className="mt-1 text-xs font-medium text-light-slate">{selectedAssignmentCase.needType} - {selectedAssignmentCase.district}</p>
              </div>

              {selectedAssignmentCase.suggestedVolunteerIds.length === 0 && (
                <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
                  No available volunteer matches this case yet. Add a volunteer profile with matching skills or location to assign it.
                </div>
              )}

              {selectedAssignmentCase.suggestedVolunteerIds.map((volunteerId) => {
                const volunteer = volunteerLookup.get(volunteerId);
                if (!volunteer) return null;

                return (
                  <div key={volunteer.id} className="theme-soft rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-dark-slate">{volunteer.name}</p>
                        <p className="mt-1 text-xs font-medium text-light-slate">{volunteer.region} - {volunteer.weeklyCapacity}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${availabilityTone(volunteer.availability)}`}>{volunteer.availability}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {volunteer.skills.map((skill) => (
                        <span key={skill} className="theme-pill rounded-full px-2.5 py-1 text-xs font-bold">
                          {skill}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleAssignVolunteer(selectedAssignmentCase.id, volunteer.id)}
                      disabled={volunteer.availability !== 'Available'}
                      className="theme-primary mt-4 w-full rounded-full px-4 py-2 text-sm font-bold disabled:bg-brand-slate-100 disabled:text-light-slate disabled:shadow-none"
                    >
                      {volunteer.availability === 'Available' ? 'Assign and lock case' : 'Not currently free'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-4 text-dark-slate">Workflow Guardrails</h2>
          <div className="space-y-3 text-sm font-medium text-dark-slate">
            <div className="theme-soft rounded-2xl p-4">Once assigned, a case is locked to prevent duplicate volunteer action.</div>
            <div className="theme-soft rounded-2xl p-4">Only volunteers with matching skills and current availability are shown first.</div>
            <div className="theme-soft rounded-2xl p-4">Assigned and in-progress cases remain visible so NGOs can follow coordination, not just intake.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
