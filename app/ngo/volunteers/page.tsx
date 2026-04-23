'use client';

import { Users } from 'lucide-react';
import { availabilityTone, useNgoDashboard } from '../ngo-dashboard-context';

export default function NgoVolunteersPage() {
  const { volunteers, loading, error } = useNgoDashboard();

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
      <section className="theme-card rounded-[2rem] p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="theme-heading-40 text-dark-slate">Available Volunteer Network</h1>
            <p className="theme-body mt-2 text-light-slate">A lightweight capability view for fast assignment decisions.</p>
          </div>
          <div className="theme-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold">
            <Users className="h-3.5 w-3.5" />
            {volunteers.length} linked volunteers
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {loading && (
            <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
              Loading real volunteer profiles...
            </div>
          )}

          {!loading && volunteers.length === 0 && (
            <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
              No volunteer users are registered yet. Volunteers will appear here after they sign up and complete their profile.
            </div>
          )}

          {volunteers.map((volunteer) => (
            <div key={volunteer.id} className="theme-soft rounded-[1.8rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-dark-slate">{volunteer.name}</h2>
                  <p className="mt-1 text-xs font-medium text-light-slate">{volunteer.region} · {volunteer.weeklyCapacity}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${availabilityTone(volunteer.availability)}`}>{volunteer.availability}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {volunteer.skills.map((skill) => (
                  <span key={skill} className="theme-pill rounded-full px-2.5 py-1 text-xs font-bold">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-4 text-dark-slate">Capacity Snapshot</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-brand-blue-50 p-4">
              <p className="text-2xl font-black text-dark-slate">{volunteers.filter((v) => v.availability === 'Available').length}</p>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-blue">Available</p>
            </div>
            <div className="rounded-2xl bg-brand-slate-50 p-4">
              <p className="text-2xl font-black text-dark-slate">{volunteers.filter((v) => v.availability === 'Busy').length}</p>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-light-slate">Busy</p>
            </div>
            <div className="rounded-2xl bg-brand-slate-100 p-4">
              <p className="text-2xl font-black text-dark-slate">{volunteers.filter((v) => v.availability === 'Offline').length}</p>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-light-slate">Offline</p>
            </div>
          </div>
        </div>

        <div className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-4 text-dark-slate">How to Use This Tab</h2>
          <div className="space-y-3 text-sm font-medium text-dark-slate">
            <div className="theme-soft rounded-2xl p-4">Use this tab to see who can realistically take a case right now.</div>
            <div className="theme-soft rounded-2xl p-4">Detailed assignment still happens in the Cases tab so action and coordination stay connected.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
