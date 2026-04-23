'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  FileText,
  Info,
  MoveUpRight,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import { DEMAND_CLUSTERS, useNgoDashboard } from './ngo-dashboard-context';

const NgoHeatMap = dynamic(() => import('./NgoHeatMap'), { ssr: false });

const recentActivity = [
  {
    icon: FileText,
    iconTone: 'bg-brand-blue-50 text-primary-blue',
    text: 'New case received: Documentation Support in Lucknow, Uttar Pradesh',
    time: '10 min ago',
  },
  {
    icon: CheckCircle2,
    iconTone: 'bg-brand-slate-50 text-light-slate',
    text: 'Case #1247 assigned to volunteer Riya Sharma',
    time: '25 min ago',
  },
  {
    icon: UserPlus,
    iconTone: 'bg-brand-blue-50 text-primary-blue',
    text: 'New volunteer onboarded: Arjun Mehta',
    time: '1 hr ago',
  },
  {
    icon: MoveUpRight,
    iconTone: 'bg-brand-slate-100 text-dark-slate',
    text: 'Case #1241 marked as completed',
    time: '2 hr ago',
  },
];

const categoryBreakdown = [
  { label: 'Documentation Support', count: 476, percent: 38, color: '#8b5cf6' },
  { label: 'Financial Assistance', count: 312, percent: 25, color: '#60a5fa' },
  { label: 'Medical Support', count: 198, percent: 16, color: '#34d399' },
  { label: 'Legal Support', count: 132, percent: 11, color: '#f59e0b' },
  { label: 'Other', count: 130, percent: 10, color: '#d1d5db' },
];

export function NgoOverviewContent() {
  const { name } = useNgoDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="theme-pill mt-2 text-light-slate">Welcome back, {name}! Here&apos;s what&apos;s happening today.</p>
        </div>
        <button className="theme-pill inline-flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-dark-slate">
          <CalendarDays className="w-4 h-4 text-light-slate" />
          May 26, 2025
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Active Cases',
            value: '1,248',
            delta: '12% vs last week',
            deltaTone: 'text-primary-blue',
            icon: FileText,
            iconTone: ' bg-brand-slate-50 text-light-slate',
          },
          {
            label: 'High Priority Cases',
            value: '186',
            delta: '8% vs last week',
            deltaTone: 'text-primary-blue',
            icon: TriangleAlert,
            iconTone: ' text-primary-blue',
          },
          {
            label: 'Unassigned Cases',
            value: '73',
            delta: '10% vs last week',
            deltaTone: 'text-primary-blue',
            icon: Users,
            iconTone: 'bg-brand-slate-50 text-light-slate',
          },
          {
            label: 'Resolved (This Month)',
            value: '342',
            delta: '15% vs last month',
            deltaTone: 'text-primary-blue',
            icon: CheckCircle2,
            iconTone: 'text-primary-blue',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <section key={item.label} className="theme-card rounded-[1.8rem] p-6">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${item.iconTone}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-light-slate">{item.label}</p>
                  <p className="text-2xl font-black text-dark-slate mt-2">{item.value}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid xl:grid-cols-[1.75fr_0.95fr] gap-6">
        <section className="theme-card rounded-[2rem] p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-dark-slate">Need Heatmap (India)</h2>
                <Info className="w-4 h-4 text-light-slate" />
              </div>
              <p className="text-sm text-light-slate font-medium mt-2">Need score</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm font-medium text-light-slate">Low</span>
                {['#fef3c7', '#fed7aa', '#fdba74', '#fb7185', '#e11d48'].map((color) => (
                  <span key={color} className="w-7 h-4 rounded-md" style={{ backgroundColor: color }} />
                ))}
                <span className="text-sm font-medium text-light-slate">High</span>
              </div>
            </div>
            <Link href="/ngo/map" className="theme-pill inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-primary-blue">
              View Full Map
              <MoveUpRight className="w-4 h-4" />
            </Link>
          </div>

          <NgoHeatMap clusters={DEMAND_CLUSTERS} />

          <p className="text-xs text-light-slate font-medium mt-4 text-right">
            Need score is calculated based on case volume, urgency, and last support.
          </p>
        </section>

        <section className="space-y-6">
          <div className="theme-card rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <BellRing className="w-5 h-5 text-primary-blue" />
                <h2 className="theme-title-24 text-dark-slate">Key Insights</h2>
              </div>
              <span className="text-sm font-bold text-primary-blue">View All Insights</span>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: MoveUpRight,
                  tone: 'bg-primary-blue text-white',
                  text: 'High unmet need in Delhi NCR and surrounding districts.',
                },
                {
                  icon: FileText,
                  tone: 'bg-brand-blue-50 text-primary-blue',
                  text: 'Documentation support requests are 38% of total cases.',
                },
                {
                  icon: Users,
                  tone: 'bg-brand-slate-50 text-light-slate',
                  text: 'Financial assistance cases increased by 22% this week.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="theme-soft rounded-[1.6rem] p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${item.tone}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-dark-slate leading-6">{item.text}</p>
                        <p className="text-sm font-bold text-primary-blue mt-3">View Details</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="theme-card rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="theme-title-24 text-dark-slate">Recent Activity</h2>
              <span className="text-sm font-bold text-primary-blue">View All</span>
            </div>

            <div className="space-y-4">
              {recentActivity.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-start gap-4 border-b border-brand-slate-100 pb-4 last:border-b-0 last:pb-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.iconTone}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-dark-slate leading-6">{item.text}</p>
                    </div>
                    <p className="text-xs font-medium text-light-slate whitespace-nowrap">{item.time}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-[1.75fr_0.95fr] gap-6">
        <section className="theme-card rounded-[2rem] p-6">
          <h2 className="text-sm font-bold text-dark-slate mb-6">Cases by Category</h2>
          <div className="grid lg:grid-cols-[0.95fr_1.05fr_0.9fr] gap-6 items-center">
            <div className="flex justify-center">
              <div
                className="relative h-48 w-48 rounded-full"
                style={{
                  background: `conic-gradient(${categoryBreakdown
                    .map((item, index) => {
                      const start = categoryBreakdown.slice(0, index).reduce((sum, current) => sum + current.percent, 0);
                      return `${item.color} ${start}% ${start + item.percent}%`;
                    })
                    .join(', ')})`,
                }}
              >
                <div className="absolute inset-[20%] rounded-full bg-white flex flex-col items-center justify-center text-center">
                  <p className="text-2xl font-black text-dark-slate">1,248</p>
                  <p className="text-sm font-medium text-light-slate">Total</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.label} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center text-sm">
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-dark-slate">{item.label}</span>
                  <span className="font-bold text-light-slate">{item.count} ({item.percent}%)</span>
                </div>
              ))}
            </div>

            <div className="rounded-[1.6rem] bg-violet-50 border border-violet-200 p-6">
              <p className="text-sm font-bold text-light-slate">Most Requested Need</p>
              <div className="mt-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-black text-dark-slate">Documentation Support</p>
                  <p className="text-2xl font-black text-dark-slate mt-2">38%</p>
                  <p className="text-sm text-light-slate font-medium">of total cases</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="theme-card rounded-[2rem] px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="theme-title-24 text-dark-slate">5 cases need your attention</p>
            <p className="theme-body mt-1 text-light-slate">These cases are unassigned and require immediate action.</p>
          </div>
          <Link href="/ngo/cases" className="inline-flex items-center gap-2 rounded-2xl bg-primary-blue px-5 py-3 text-sm font-bold text-white">
            Go to Cases
            <MoveUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
