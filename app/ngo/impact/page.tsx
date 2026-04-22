'use client';

import { FileText, Globe2, HandCoins } from 'lucide-react';

export default function NgoImpactPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="theme-card rounded-[2rem] p-6">
        <h1 className="theme-heading-40 mb-5 text-dark-slate">Trend & Utilization Signals</h1>
        <div className="space-y-4">
          {[
            { title: 'Frequently unmet needs', body: 'Documentation help remains the most repeated unresolved category across Pune and Aurangabad.', icon: FileText },
            { title: 'Underutilized schemes', body: 'Existing grant pathways for emergency medication are not being activated early enough in Mumbai.', icon: HandCoins },
            { title: 'Repeated regional demand', body: 'North Maharashtra keeps surfacing follow-up navigation requests after hospital discharge.', icon: Globe2 },
          ].map((item) => {
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
        </div>
      </section>

      <section className="space-y-6">
        <div className="theme-card rounded-[2rem] p-6">
          <h2 className="theme-title-24 mb-4 text-dark-slate">Effectiveness Snapshot</h2>
          <div className="space-y-4">
            {[
              { label: 'Cases resolved this month', value: '18', color: 'text-primary-blue' },
              { label: 'Avg. response to urgent case', value: '2.4 hrs', color: 'text-primary-blue' },
              { label: 'Cases still unresolved after 7 days', value: '6', color: 'text-light-slate' },
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
              'Expand documentation-trained volunteers in Pune.',
              'Prioritize financial-aid triage in Mumbai this week.',
              'Review unresolved care-navigation cases older than 7 days.',
            ].map((item) => (
              <div key={item} className="theme-soft rounded-2xl p-4 text-sm font-medium text-dark-slate">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
