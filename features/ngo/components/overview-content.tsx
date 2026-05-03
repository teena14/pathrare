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
import { useNgoDashboard } from '@/features/ngo/context/ngo-dashboard-context';
import { compactPatientConnectionSummary } from '@/services/ngo/ngo-support';
import { useLocalizedFormat } from '@/hooks/use-localized-format';

const NgoHeatMap = dynamic(() => import('@/features/ngo/components/NgoHeatMap'), { ssr: false });


export function NgoOverviewContent() {
  const {
    name,
    loading,
    error,
    caseRequests,
    urgentCases,
    unmetNeeds,
    resolvedThisMonth,
    demandClusters,
    categoryBreakdown,
    recentActivity,
    incomingPatientConnections,
  } = useNgoDashboard();
  const { formatDate, formatNumber, formatRelativeTime } = useLocalizedFormat();

  const activeCases = caseRequests.filter((request) => request.status !== 'Resolved').length;
  const topCluster = demandClusters[0];
  const topCategory = categoryBreakdown[0];
  const today = formatDate(new Date(), { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="theme-pill mt-2 text-light-slate">Welcome back, {name}! Here&apos;s what&apos;s happening today.</p>
        </div>
        <button className="theme-pill inline-flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-dark-slate">
          <CalendarDays className="w-4 h-4 text-light-slate" />
          {today}
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Active Cases',
            value: String(activeCases),
            icon: FileText,
            iconTone: ' bg-brand-slate-50 text-light-slate',
          },
          {
            label: 'High Priority Cases',
            value: String(urgentCases),
            icon: TriangleAlert,
            iconTone: ' text-primary-blue',
          },
          {
            label: 'Unassigned Cases',
            value: String(unmetNeeds),
            icon: Users,
            iconTone: 'bg-brand-slate-50 text-light-slate',
          },
          {
            label: 'Resolved (This Month)',
            value: String(resolvedThisMonth),
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
                <p className="text-2xl font-black text-dark-slate mt-2">{loading ? '...' : formatNumber(Number(item.value))}</p>
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
              <p className="text-sm text-light-slate font-medium mt-2">Priority score</p>
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

          <NgoHeatMap clusters={demandClusters} />

          <p className="text-xs text-light-slate font-medium mt-4 text-right">
            Priority score = (0.5 × total cases) + (1.5 × urgent cases) + (1.0 × unassigned cases).
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
                topCluster ? {
                  icon: MoveUpRight,
                  tone: 'bg-primary-blue text-white',
                  text: `${topCluster.district} has the highest current priority score at ${topCluster.priorityScore}.`,
                } : null,
                topCategory ? {
                  icon: FileText,
                  tone: 'bg-brand-blue-50 text-primary-blue',
                  text: `${topCategory.label} is the most requested active need (${topCategory.percent}%).`,
                } : null,
                unmetNeeds > 0 ? {
                  icon: Users,
                  tone: 'bg-brand-slate-50 text-light-slate',
                  text: `${unmetNeeds} active case${unmetNeeds === 1 ? '' : 's'} still need assignment.`,
                } : null,
              ].filter(Boolean).map((item) => {
                if (!item) return null;
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
              {!topCluster && !topCategory && unmetNeeds === 0 && (
                <div className="theme-soft rounded-[1.6rem] p-5 text-sm font-medium text-light-slate">
                  No patient help requests are available yet. Once patients request support, insights will appear here.
                </div>
              )}
            </div>
          </div>

          <div className="theme-card rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="theme-title-24 text-dark-slate">Recent Activity</h2>
              <span className="text-sm font-bold text-primary-blue">View All</span>
            </div>

            <div className="space-y-4">
              {recentActivity.map((item) => {
                const Icon = item.type === 'volunteer' ? UserPlus : item.type === 'resolved' ? CheckCircle2 : item.type === 'assignment' ? MoveUpRight : FileText;
                const iconTone = item.type === 'volunteer' || item.type === 'case'
                  ? 'bg-brand-blue-50 text-primary-blue'
                  : item.type === 'resolved'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-brand-slate-100 text-dark-slate';
                return (
                  <div key={item.text} className="flex items-start gap-4 border-b border-brand-slate-100 pb-4 last:border-b-0 last:pb-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconTone}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-dark-slate leading-6">{item.text}</p>
                    </div>
                    <p className="text-xs font-medium text-light-slate whitespace-nowrap">{item.time}</p>
                  </div>
                );
              })}
              {recentActivity.length === 0 && (
                <div className="theme-soft rounded-2xl p-4 text-sm font-medium text-light-slate">
                  No real activity has been recorded yet.
                </div>
              )}
            </div>
          </div>

          <div className="theme-card rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="theme-title-24 text-dark-slate">Direct NGO Connect</h2>
              <Link href="/ngo/patients" className="text-sm font-bold text-primary-blue hover:text-blue-700 transition-colors">
                Manage in Patients
              </Link>
            </div>

            <div className="space-y-4">
              {incomingPatientConnections.slice(0, 4).map((request) => (
                <div key={request.id} className="theme-soft rounded-[1.6rem] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-dark-slate">{request.patientName}</p>
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
                    <span className="text-light-slate">{request.createdAt ? formatRelativeTime(request.createdAt) : 'just now'}</span>
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
              {incomingPatientConnections.length === 0 && (
                <div className="theme-soft rounded-[1.6rem] p-5 text-sm font-medium text-light-slate">
                  Patients who connect directly with your NGO from the medical Life Assist tab will appear here with a short summary.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-[1.75fr_0.95fr] gap-6">
        <section className="theme-card rounded-[2rem] p-6">
          <h2 className="text-sm font-bold text-dark-slate mb-6">Cases by Category</h2>
          {categoryBreakdown.length > 0 ? (
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
                  <p className="text-2xl font-black text-dark-slate">{formatNumber(activeCases)}</p>
                  <p className="text-sm font-medium text-light-slate">Total</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.label} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center text-sm">
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-dark-slate">{item.label}</span>
                  <span className="font-bold text-light-slate">{formatNumber(item.count)} ({formatNumber(item.percent)}%)</span>
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
                  <p className="text-sm font-black text-dark-slate">{topCategory?.label}</p>
                  <p className="text-2xl font-black text-dark-slate mt-2">{topCategory ? formatNumber(topCategory.percent) : 0}%</p>
                  <p className="text-sm text-light-slate font-medium">of total cases</p>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="theme-soft rounded-2xl p-5 text-sm font-medium text-light-slate">
              Cases by category will appear after real patient support requests are saved.
            </div>
          )}
        </section>

        <div className="theme-card rounded-[2rem] px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="theme-title-24 text-dark-slate">{formatNumber(unmetNeeds)} case{unmetNeeds === 1 ? '' : 's'} need your attention</p>
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
