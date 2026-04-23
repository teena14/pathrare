'use client';

import { Filter } from 'lucide-react';
import {
  availabilityTone,
  statusTone,
  urgencyTone,
  useNgoDashboard,
} from '../ngo-dashboard-context';

export default function NgoCasesPage() {
  const {
    filteredCases,
    volunteerLookup,
    setAssignmentTarget,
    selectedAssignmentCase,
    assignVolunteer,
  } = useNgoDashboard();

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

        <div className="space-y-4">
          {filteredCases.map((request) => (
            <div key={request.id} className="theme-soft rounded-[1.8rem] p-5 transition-colors hover:border-brand-slate-200">
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-dark-slate">{request.title}</h2>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${urgencyTone(request.urgency)}`}>{request.urgency}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(request.status)}`}>{request.status}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-light-slate">{request.district} · {request.region}</p>
                <p className="mt-1 text-xs font-bold text-light-slate">
                  Need type - <span className="text-primary-blue">{request.needType}</span>
                </p>
              </div>

              <p className="theme-body text-dark-slate">{request.summary}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {request.suggestedVolunteerIds.map((id) => (
                  <span key={id} className="theme-pill rounded-full px-2.5 py-1 text-xs font-bold">
                    Suggested: {volunteerLookup.get(id)?.name ?? id}
                  </span>
                ))}
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
              <div className="theme-soft rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-light-slate">Selected case</p>
                <p className="mt-2 text-sm font-black text-dark-slate">{selectedAssignmentCase.title}</p>
                <p className="mt-1 text-xs font-medium text-light-slate">{selectedAssignmentCase.needType} · {selectedAssignmentCase.district}</p>
              </div>

              {selectedAssignmentCase.suggestedVolunteerIds.map((volunteerId) => {
                const volunteer = volunteerLookup.get(volunteerId);
                if (!volunteer) return null;

                return (
                  <div key={volunteer.id} className="theme-soft rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-dark-slate">{volunteer.name}</p>
                        <p className="mt-1 text-xs font-medium text-light-slate">{volunteer.region} · {volunteer.weeklyCapacity}</p>
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
                      onClick={() => assignVolunteer(selectedAssignmentCase.id, volunteer.id)}
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
