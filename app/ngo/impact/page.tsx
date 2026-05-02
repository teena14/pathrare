'use client';

import { FileText, Globe2, HandCoins } from 'lucide-react';
import { useNgoDashboard } from '@/features/ngo/context/ngo-dashboard-context';

export default function NgoImpactPage() {
  const { categoryBreakdown, demandClusters, effectiveness, unmetNeeds } = useNgoDashboard();
  const topCategory = categoryBreakdown[0];
  const topCluster = demandClusters[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="theme-card rounded-[2rem] p-6">
        <h1 className="theme-heading-40 mb-5 text-dark-slate">Trend & Utilization Signals</h1>
        <div className="space-y-4">
          {[
            topCategory ? { title: 'Frequently unmet needs', body: `${topCategory.label} is currently ${topCategory.percent}% of active patient requests.`, icon: FileText } : null,
            unmetNeeds > 0 ? { title: 'Support availability gap', body: `${unmetNeeds} active case${unmetNeeds === 1 ? '' : 's'} are still unassigned.`, icon: HandCoins } : null,
            topCluster ? { title: 'Repeated regional demand', body: `${topCluster.district} has the strongest composite Need Score based on volume, urgency, support gap, and recency.`, icon: Globe2 } : null,
          ].filter(Boolean).map((item) => {
            if (!item) return null;
            const Icon = item.icon;
            return (
              <div key={item.title} className="theme-soft rounded-[1.8rem] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-slate-100 bg-white text-primary-blue">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-dark-slate">{item.title}</h2>
                    <p className="theme-body mt-1 text-light-slate">{item.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {!topCategory && unmetNeeds === 0 && !topCluster && (
            <div className="theme-soft rounded-[1.8rem] p-5 text-sm font-medium text-light-slate">
              Trend signals will appear once real patients request assistance.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <div className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-4 text-dark-slate">Effectiveness Snapshot</h2>
          <div className="space-y-4">
            {[
              { label: 'Cases resolved this month', value: String(effectiveness.resolvedThisMonth), color: 'text-primary-blue' },
              { label: 'Avg. response to urgent case', value: effectiveness.averageUrgentResponse, color: 'text-primary-blue' },
              { label: 'Cases still unresolved after 7 days', value: String(effectiveness.unresolvedAfterSevenDays), color: 'text-light-slate' },
            ].map((item) => (
              <div key={item.label} className="theme-soft flex items-center justify-between rounded-2xl p-4">
                <p className="text-sm font-bold text-dark-slate">{item.label}</p>
                <p className={`text-sm font-black ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-4 text-dark-slate">Action Next</h2>
          <div className="space-y-3">
            {[
              topCluster ? `Prioritize outreach in ${topCluster.district}; it has the highest Need Score.` : null,
              topCategory ? `Recruit or assign volunteers for ${topCategory.label}.` : null,
              effectiveness.unresolvedAfterSevenDays > 0 ? `Review ${effectiveness.unresolvedAfterSevenDays} case${effectiveness.unresolvedAfterSevenDays === 1 ? '' : 's'} older than 7 days.` : null,
            ].filter(Boolean).map((item) => (
              <div key={item} className="theme-soft rounded-2xl p-4 text-sm font-medium text-dark-slate">
                {item}
              </div>
            ))}
            {!topCluster && !topCategory && effectiveness.unresolvedAfterSevenDays === 0 && (
              <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
                No recommended actions yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
