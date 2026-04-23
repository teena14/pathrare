'use client';

import dynamic from 'next/dynamic';
import { Activity, BriefcaseMedical, FileText, HandCoins } from 'lucide-react';
import { useNgoDashboard } from '../ngo-dashboard-context';

const NgoHeatMap = dynamic(() => import('../NgoHeatMap'), { ssr: false });

export default function NgoMapPage() {
  const {
    selectedGeography,
    selectedNeedType,
    selectedUrgency,
    setSelectedGeography,
    setSelectedNeedType,
    setSelectedUrgency,
    demandClusters,
    filterOptions,
    categoryBreakdown,
    unmetNeeds,
  } = useNgoDashboard();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
      <section className="theme-card rounded-[2rem] p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="theme-heading-40 text-dark-slate">Map & Insights</h1>
            <p className="theme-body mt-2 text-light-slate">Explore where help is needed most with a real zoomable map, then match the right intervention type.</p>
          </div>
          <div className="grid min-w-[320px] grid-cols-3 gap-2">
            <select value={selectedGeography} onChange={(e) => setSelectedGeography(e.target.value)} className="rounded-2xl border border-brand-slate-100 bg-white px-3 py-2 text-sm font-medium text-dark-slate">
              {filterOptions.geography.map((option) => <option key={option}>{option}</option>)}
            </select>
            <select value={selectedUrgency} onChange={(e) => setSelectedUrgency(e.target.value)} className="rounded-2xl border border-brand-slate-100 bg-white px-3 py-2 text-sm font-medium text-dark-slate">
              {filterOptions.urgency.map((option) => <option key={option}>{option}</option>)}
            </select>
            <select value={selectedNeedType} onChange={(e) => setSelectedNeedType(e.target.value)} className="rounded-2xl border border-brand-slate-100 bg-white px-3 py-2 text-sm font-medium text-dark-slate">
              {filterOptions.needType.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
        </div>
        <NgoHeatMap clusters={demandClusters} />
      </section>

      <section className="space-y-6">
        <div className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-4 text-dark-slate">Need Split by Type</h2>
          <div className="space-y-4">
            {[
              { label: 'Medical Support', icon: BriefcaseMedical, color: 'text-rose-600 bg-rose-50' },
              { label: 'Financial Assistance', icon: HandCoins, color: 'text-amber-600 bg-amber-50' },
              { label: 'Documentation Help', icon: FileText, color: 'text-sky-600 bg-sky-50' },
              { label: 'Care Guidance', icon: Activity, color: 'text-emerald-600 bg-emerald-50' },
            ].map((item) => {
              const Icon = item.icon;
              const count = categoryBreakdown.find((entry) => entry.label === item.label)?.count ?? 0;
              return (
                <div key={item.label} className="theme-soft flex items-center gap-3 rounded-2xl p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-dark-slate">{item.label}</p>
                    <p className="text-xs font-medium text-light-slate">Cases currently waiting for this intervention.</p>
                  </div>
                  <p className="text-2xl font-black text-dark-slate">{count}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-4 text-dark-slate">Insight Highlights</h2>
          <div className="space-y-3">
            {[
              demandClusters[0] ? `${demandClusters[0].district} currently has the highest composite Need Score (${demandClusters[0].intensity}).` : null,
              unmetNeeds > 0 ? `${unmetNeeds} active case${unmetNeeds === 1 ? '' : 's'} are unassigned or waiting for support.` : null,
              categoryBreakdown[0] ? `${categoryBreakdown[0].label} is the largest active support category.` : null,
            ].filter(Boolean).map((insight) => (
              <div key={insight} className="theme-soft rounded-2xl p-4 text-sm font-medium text-dark-slate">
                {insight}
              </div>
            ))}
            {demandClusters.length === 0 && categoryBreakdown.length === 0 && (
              <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
                No mapped patient requests yet. Add patient district/city and request help to populate the heatmap.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
