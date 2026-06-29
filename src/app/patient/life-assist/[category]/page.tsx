'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle, ChevronDown, ChevronRight, Clock, ExternalLink, Loader2, MessageSquareText } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { canOpenTaskChat, dedupeSupportTasks, humanizeTaskStatus, mapSupportTask, SupportTask } from '@/services/tasks/task-chat';

type ResourceCategory = 'financial' | 'education' | 'medical' | 'assistive';
type Priority = 'urgent' | 'high' | 'medium';

interface ResourceItem {
  id: string;
  name: string;
  type: string;
  goal: string;
  description: string;
  support_type: string[];
  location: { country: string | null; state: string | null; city: string | null };
  trust_level: string;
  source: string;
  contact_url: string;
  priority_score: number;
  applicability_reasons?: string[];
  resource_kind?: 'resource' | 'ngo';
  ngoUserId?: string;
  organizationId?: string;
  organizationName?: string;
  specialization_summary?: string;
  specialization_tags?: string[];
  connection_status?: string | null;
  direct_connect?: boolean;
}

const CATEGORIES = [
  { id: 'financial', label: 'Financial & Legal Aid' },
  { id: 'education', label: 'Adaptive Education' },
  { id: 'medical', label: 'Medical & Care' },
  { id: 'assistive', label: 'Assistive Technology' },
] as const;

function isCategory(value: string): value is ResourceCategory {
  return ['financial', 'education', 'medical', 'assistive'].includes(value);
}

function priorityTone(score: number): Priority {
  if (score >= 9) return 'urgent';
  if (score >= 7) return 'high';
  return 'medium';
}

function priorityClasses(priority: Priority) {
  if (priority === 'urgent') return 'bg-rose-100 text-rose-700 border-rose-300';
  if (priority === 'high') return 'bg-amber-100 text-amber-700 border-amber-300';
  return 'bg-sky-100 text-sky-700 border-sky-300';
}

function priorityDot(priority: Priority) {
  if (priority === 'urgent') return 'bg-rose-500';
  if (priority === 'high') return 'bg-amber-500';
  return 'bg-sky-500';
}

function normalizeResourceKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
}

function getExternalUrl(resource: ResourceItem) {
  const candidates = [resource.contact_url, resource.source];
  return candidates.find((value) => /^https?:\/\//i.test(value)) ?? '';
}

export default function LifeAssistCategoryPage() {
  const params = useParams<{ category: string }>();
  const { profile } = useAuth();
  const category = isCategory(params.category) ? params.category : null;
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState('');
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [connectingNgoId, setConnectingNgoId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [supportTasks, setSupportTasks] = useState<SupportTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const categoryLabel = CATEGORIES.find((item) => item.id === category)?.label ?? 'Life Assist';
  const filteredSupportTasks = useMemo(
    () => supportTasks.filter((task) => task.category === category),
    [category, supportTasks]
  );
  const existingTaskByResource = useMemo(() => {
    const entries = new Map<string, SupportTask>();

    for (const task of filteredSupportTasks) {
      const key = normalizeResourceKey(task.resourceId || task.resourceName || task.title);
      if (key) {
        entries.set(key, task);
      }
    }

    return entries;
  }, [filteredSupportTasks]);

  useEffect(() => {
    if (!category || !profile?.uid) return;

    let active = true;
    const load = async (showLoading: boolean) => {
      try {
        if (showLoading) setResourcesLoading(true);
        setResourcesError('');
        const response = await fetch(`/api/resources?category=${encodeURIComponent(category)}&userId=${encodeURIComponent(profile.uid)}`, {
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Failed to load resources.');
        if (active) setResources(data.resources ?? []);
      } catch (error) {
        if (active) {
          setResources([]);
          setResourcesError(error instanceof Error ? error.message : 'Failed to load resources.');
        }
      } finally {
        if (active) setResourcesLoading(false);
      }
    };

    void load(true);
    return () => {
      active = false;
    };
  }, [category, profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) return;

    let active = true;
    const load = async (showLoading: boolean) => {
      try {
        if (showLoading) setTasksLoading(true);
        const response = await fetch(`/api/tasks?userId=${encodeURIComponent(profile.uid)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Failed to load support requests.');
        if (!active) return;

        const tasks = Array.isArray(data.tasks)
          ? data.tasks.map((task: Record<string, unknown>) => mapSupportTask(task))
          : [];

        setSupportTasks(dedupeSupportTasks(tasks));
      } catch (error) {
        if (active) {
          console.error(error);
        }
      } finally {
        if (active) setTasksLoading(false);
      }
    };

    void load(true);
    const interval = window.setInterval(() => void load(false), 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [category, profile?.uid]);

  const handleRequestHelp = async (resource: ResourceItem) => {
    if (!profile?.uid || !category) return;

    try {
      setRequestingId(resource.id);
      setRequestMessage('');
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: resource.type,
          userId: profile.uid,
          category,
          needType: category,
          resourceId: resource.id,
          resourceName: resource.name,
          goal: resource.goal,
          title: `Volunteer help for ${resource.name}`,
          summary: resource.description,
          description: resource.description,
          required_skills: resource.support_type ?? [],
          urgency_score: Math.min(1, Number(resource.priority_score ?? 5) / 10),
          fallback_strategy: ['volunteer', 'ngo', 'queue'],
          location: resource.location,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to create volunteer request.');
      const taskCreated = mapSupportTask((data.task ?? {}) as Record<string, unknown>);
      if (taskCreated.id) {
        setSupportTasks((currentTasks) => dedupeSupportTasks([...currentTasks, taskCreated]));
      }
      setRequestMessage(
        data.reused
          ? `You already requested help for ${resource.name}. Keeping your existing request instead of creating another one.`
          : `Volunteer request created for ${resource.name}. You'll be notified here when someone accepts.`
      );
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : 'Failed to create volunteer request.');
    } finally {
      setRequestingId(null);
    }
  };

  const handleConnectNgo = async (resource: ResourceItem) => {
    if (!profile?.uid || !(resource.ngoUserId || resource.organizationId)) return;

    try {
      setConnectingNgoId(resource.id);
      setRequestMessage('');
      const response = await fetch('/api/ngo/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: profile.uid,
          ngoId: resource.ngoUserId || resource.organizationId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to connect with NGO.');

      setResources((currentResources) =>
        currentResources.map((entry) =>
          entry.id === resource.id
            ? {
                ...entry,
                connection_status: 'pending',
              }
            : entry
        )
      );
      setRequestMessage(
        data.reused
          ? `${resource.name} already has your connection request. The NGO can review your summary from their portal.`
          : `Connection request sent to ${resource.name}. Your profile summary is now visible to that NGO on PathRare.`
      );
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : 'Failed to connect with NGO.');
    } finally {
      setConnectingNgoId(null);
    }
  };

  if (!category) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-black text-dark-slate">Category not found</h1>
          <p className="mt-2 text-sm font-medium text-light-slate">Go back and choose one of the Life Assist categories.</p>
          <Link href="/patient/life-assist" className="inline-flex mt-5 rounded-full bg-primary-blue px-5 py-3 text-sm font-bold text-white">
            Back to Life Assist
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-light-slate">
          <Link href="/patient/life-assist" className="hover:text-primary-blue transition-colors">Life Assist</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-dark-slate">{categoryLabel}</span>
        </div>
        <div>
          <h1 className="text-3xl font-black text-dark-slate">{categoryLabel}</h1>
          <p className="text-light-slate font-medium mt-1">
            {category === 'medical'
              ? 'Backend-curated resources plus matched in-portal NGOs, filtered to what is most applicable for your profile.'
              : 'Backend-curated resources only, filtered to what is most applicable for your profile in this category.'}
          </p>
        </div>
      </div>

      {requestMessage && (
        <div className="rounded-2xl border border-brand-blue-100 bg-brand-blue-50 p-4 text-sm font-medium text-primary-blue">
          {requestMessage}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.9fr]">
        <section className="space-y-4">
          {resourcesLoading && (
            <div className="bg-white rounded-3xl border border-surface-200 p-8 text-center text-light-slate font-medium">
              Loading curated resources from the backend...
            </div>
          )}

          {!resourcesLoading && resourcesError && (
            <div className="bg-white rounded-3xl border border-rose-200 p-6 text-sm font-medium text-rose-600">
              {resourcesError}
            </div>
          )}

          {!resourcesLoading && !resourcesError && resources.length === 0 && (
            <div className="bg-white rounded-3xl border border-surface-200 p-8 text-center text-light-slate font-medium">
              No applicable backend-curated resources were found for this category yet.
            </div>
          )}

          <AnimatePresence>
            {resources.map((resource) => {
              const priority = priorityTone(Number(resource.priority_score ?? 0));
              const externalUrl = getExternalUrl(resource);
              const isNgoResource = resource.resource_kind === 'ngo' || resource.type === 'ngo_partner' || Boolean(resource.direct_connect);
              const existingTask =
                existingTaskByResource.get(normalizeResourceKey(resource.id)) ??
                existingTaskByResource.get(normalizeResourceKey(resource.name));
              const hasExistingRequest = !isNgoResource && Boolean(existingTask);
              const chatReady = existingTask ? Boolean(existingTask.assignedVolunteerId) && canOpenTaskChat(existingTask.status) : false;
              const ngoConnectionPending = isNgoResource && resource.connection_status === 'pending';
              const ngoConnectionAccepted = isNgoResource && resource.connection_status === 'accepted';

              return (
                <motion.div
                  key={resource.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl border border-surface-200 overflow-hidden"
                >
                  <button
                    className="w-full p-5 text-left flex items-start gap-4 hover:bg-surface-50 transition-colors"
                    onClick={() => setExpandedResourceId(expandedResourceId === resource.id ? null : resource.id)}
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${priorityDot(priority)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-bold text-dark-slate text-base">{resource.name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${priorityClasses(priority)} capitalize`}>
                          {priority}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-surface-200 text-light-slate capitalize">
                          {isNgoResource ? 'in-portal ngo' : resource.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-dark-slate font-medium leading-relaxed">{resource.description}</p>
                      {isNgoResource && resource.specialization_summary && (
                        <p className="mt-2 text-xs font-medium text-primary-blue">{resource.specialization_summary}</p>
                      )}
                      {resource.applicability_reasons && resource.applicability_reasons.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {resource.applicability_reasons.map((reason) => (
                            <span key={reason} className="rounded-full bg-brand-blue-50 px-2.5 py-1 text-[11px] font-bold text-primary-blue">
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <motion.div animate={{ rotate: expandedResourceId === resource.id ? 180 : 0 }} className="shrink-0 mt-1">
                      <ChevronDown className="w-4 h-4 text-light-slate" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {expandedResourceId === resource.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 border-t border-surface-100 space-y-4 pt-4">
                          <div className="flex flex-wrap gap-2">
                            {(resource.specialization_tags?.length ? resource.specialization_tags : resource.support_type).map((support) => (
                              <span key={support} className="rounded-full border border-surface-200 px-2.5 py-1 text-xs font-bold text-light-slate">
                                {support.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                          <div className="space-y-2 text-sm text-dark-slate font-medium">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                              Trust level: <span className="font-bold capitalize">{resource.trust_level}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-primary-blue shrink-0" />
                              Priority score: <span className="font-bold">{resource.priority_score}/10</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 pt-1">
                            {externalUrl && (
                              <a
                                href={externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border-2 border-surface-200 px-4 py-2.5 text-sm font-bold text-dark-slate hover:border-primary-blue/40 transition-all"
                              >
                                {isNgoResource ? 'Open organisation link' : 'Open resource'}
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            {isNgoResource ? (
                              <button
                                onClick={() => void handleConnectNgo(resource)}
                                disabled={connectingNgoId === resource.id || ngoConnectionPending || ngoConnectionAccepted}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50"
                              >
                                {connectingNgoId === resource.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {ngoConnectionAccepted ? 'Connected with NGO' : ngoConnectionPending ? 'Connection sent' : 'Connect with NGO'}
                              </button>
                            ) : (
                              <button
                                onClick={() => void handleRequestHelp(resource)}
                                disabled={requestingId === resource.id || hasExistingRequest}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50"
                              >
                                {requestingId === resource.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {hasExistingRequest ? (chatReady ? 'Already in chat' : 'Already requested') : 'Request volunteer'}
                              </button>
                            )}
                          </div>
                          {hasExistingRequest && (
                            <p className="text-xs font-bold text-primary-blue">
                              This scheme already has a support request in your navigator.
                            </p>
                          )}
                          {isNgoResource && (
                            <p className="text-xs font-bold text-primary-blue">
                              Connecting shares a short profile summary with the NGO through PathRare. A clinical profile link can be attached here later once that feature is available.
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>

        <section className="space-y-6">
          <div className="bg-white rounded-3xl border border-surface-200 p-6">
            <h2 className="text-xl font-black text-dark-slate">My Support Requests</h2>
            <p className="mt-1 text-sm font-medium text-light-slate">
              Volunteer requests and chat access for this category appear here.
            </p>
            <div className="mt-5 space-y-3">
              {tasksLoading && (
                <div className="rounded-2xl bg-surface-50 p-4 text-sm font-medium text-light-slate">
                  Loading your support requests...
                </div>
              )}
              {!tasksLoading && filteredSupportTasks.length === 0 && (
                <div className="rounded-2xl bg-surface-50 p-4 text-sm font-medium text-light-slate">
                  No support requests yet in this category. Request volunteer help from any applicable resource here when needed.
                </div>
              )}
              {filteredSupportTasks.map((task) => (
                (() => {
                  const chatReady = Boolean(task.assignedVolunteerId) && canOpenTaskChat(task.status);

                  return (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-surface-200 p-4 transition-all hover:border-primary-blue/25"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-dark-slate">{task.resourceName ?? task.title}</p>
                          <p className="mt-1 text-xs font-medium text-light-slate">{task.summary}</p>
                        </div>
                        <span className="rounded-full bg-surface-100 px-2.5 py-1 text-[11px] font-bold uppercase text-light-slate">
                          {humanizeTaskStatus(task.status)}
                        </span>
                      </div>
                      {task.assignedVolunteerName && (
                        <p className="mt-3 text-xs font-bold text-primary-blue">Volunteer: {task.assignedVolunteerName}</p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Link
                          href={`/patient/life-assist/chat?task=${encodeURIComponent(task.id)}`}
                          aria-disabled={!chatReady}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                            chatReady
                              ? 'bg-primary-blue text-white hover:bg-blue-700'
                              : 'cursor-not-allowed bg-surface-100 text-light-slate'
                          }`}
                          onClick={(event) => {
                            if (!chatReady) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <MessageSquareText className="h-4 w-4" />
                          {chatReady ? 'Open chat' : 'Waiting for volunteer'}
                        </Link>
                      </div>
                    </div>
                  );
                })()
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
