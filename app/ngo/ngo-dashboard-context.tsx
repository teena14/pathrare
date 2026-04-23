'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { HeatCluster } from './NgoHeatMap';

export type NeedType =
  | 'Medical Support'
  | 'Financial Assistance'
  | 'Documentation Help'
  | 'Care Guidance';

export type CaseStatus = 'Unassigned' | 'Assigned' | 'In Progress' | 'Resolved';
export type VolunteerAvailability = 'Available' | 'Busy' | 'Offline';

type DashboardUser = {
  id: string;
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  firstName?: string;
  lastName?: string;
  role?: string;
  country?: string;
  primaryDisease?: string;
  diagnosisStatus?: string;
  location?: string;
  city?: string;
  district?: string;
  state?: string;
  region?: string;
  skills?: string[];
  availability?: string | number;
  focusAreas?: string[];
  createdAt?: string;
  lastReceivedHelpAt?: string;
};

type DashboardTask = {
  id: string;
  task_id?: string;
  userId?: string | null;
  title?: string | null;
  summary?: string | null;
  type?: string;
  category?: string | null;
  priority?: string;
  urgency_score?: number;
  required_skills?: string[];
  fallback_strategy?: string[];
  status?: string;
  assignedVolunteerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastInterventionAt?: string | null;
};

type NgoDashboardPayload = {
  patients: DashboardUser[];
  volunteers: DashboardUser[];
  tasks: DashboardTask[];
  generatedAt: string;
};

type LocationCoord = {
  lat: number;
  lng: number;
  state: string;
  region: string;
  label?: string;
};

export type DemandCluster = HeatCluster & {
  topNeed: NeedType;
  activeCases: number;
  supportGapScore: number;
  recencyScore: number;
};

export type CaseRequest = {
  id: string;
  title: string;
  district: string;
  region: string;
  summary: string;
  urgency: 'Critical' | 'High' | 'Moderate';
  needType: NeedType;
  status: CaseStatus;
  suggestedVolunteerIds: string[];
  assignedVolunteerId?: string;
  patientDisease?: string;
  createdAt?: string;
  lastInterventionAt?: string | null;
};

export type VolunteerProfile = {
  id: string;
  name: string;
  skills: string[];
  availability: VolunteerAvailability;
  weeklyCapacity: string;
  region: string;
};

export type CategoryBreakdownItem = {
  label: NeedType;
  count: number;
  percent: number;
  color: string;
};

export type RecentActivityItem = {
  id: string;
  type: 'case' | 'volunteer' | 'assignment' | 'resolved';
  text: string;
  time: string;
};

export type EffectivenessSnapshot = {
  resolvedThisMonth: number;
  averageUrgentResponse: string;
  unresolvedAfterSevenDays: number;
};

const NEED_COLORS: Record<NeedType, string> = {
  'Documentation Help': '#0ea5e9',
  'Financial Assistance': '#f59e0b',
  'Medical Support': '#ef4444',
  'Care Guidance': '#10b981',
};

const INDIA_DISTRICT_COORDS: Record<string, LocationCoord> = {
  ahmedabad: { lat: 23.0225, lng: 72.5714, state: 'Gujarat', region: 'Gujarat' },
  aurangabad: { lat: 19.8762, lng: 75.3433, state: 'Maharashtra', region: 'Marathwada' },
  bengaluru: { lat: 12.9716, lng: 77.5946, state: 'Karnataka', region: 'Karnataka' },
  bhopal: { lat: 23.2599, lng: 77.4126, state: 'Madhya Pradesh', region: 'Madhya Pradesh' },
  chennai: { lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu', region: 'Tamil Nadu' },
  delhi: { lat: 28.6139, lng: 77.209, state: 'Delhi', region: 'Delhi NCR' },
  hyderabad: { lat: 17.385, lng: 78.4867, state: 'Telangana', region: 'Telangana' },
  jaipur: { lat: 26.9124, lng: 75.7873, state: 'Rajasthan', region: 'Rajasthan' },
  kolkata: { lat: 22.5726, lng: 88.3639, state: 'West Bengal', region: 'West Bengal' },
  lucknow: { lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh', region: 'Uttar Pradesh' },
  mumbai: { lat: 19.076, lng: 72.8777, state: 'Maharashtra', region: 'Konkan' },
  nagpur: { lat: 21.1458, lng: 79.0882, state: 'Maharashtra', region: 'Vidarbha' },
  nashik: { lat: 19.9975, lng: 73.7898, state: 'Maharashtra', region: 'North Maharashtra' },
  patna: { lat: 25.5941, lng: 85.1376, state: 'Bihar', region: 'Bihar' },
  pune: { lat: 18.5204, lng: 73.8567, state: 'Maharashtra', region: 'West Maharashtra' },
  surat: { lat: 21.1702, lng: 72.8311, state: 'Gujarat', region: 'Gujarat' },
};

const KNOWN_DISTRICTS = new Set(Object.keys(INDIA_DISTRICT_COORDS));

const INDIA_REGION_COORDS: Record<string, LocationCoord> = {
  'andhra pradesh': { lat: 15.9129, lng: 79.74, state: 'Andhra Pradesh', region: 'Andhra Pradesh', label: 'Andhra Pradesh' },
  bihar: { lat: 25.0961, lng: 85.3131, state: 'Bihar', region: 'Bihar', label: 'Bihar' },
  delhi: { lat: 28.6139, lng: 77.209, state: 'Delhi', region: 'Delhi NCR', label: 'Delhi NCR' },
  'delhi ncr': { lat: 28.6139, lng: 77.209, state: 'Delhi', region: 'Delhi NCR', label: 'Delhi NCR' },
  gujarat: { lat: 22.2587, lng: 71.1924, state: 'Gujarat', region: 'Gujarat', label: 'Gujarat' },
  karnataka: { lat: 15.3173, lng: 75.7139, state: 'Karnataka', region: 'Karnataka', label: 'Karnataka' },
  'madhya pradesh': { lat: 22.9734, lng: 78.6569, state: 'Madhya Pradesh', region: 'Madhya Pradesh', label: 'Madhya Pradesh' },
  maharashtra: { lat: 19.7515, lng: 75.7139, state: 'Maharashtra', region: 'Maharashtra', label: 'Maharashtra' },
  rajasthan: { lat: 27.0238, lng: 74.2179, state: 'Rajasthan', region: 'Rajasthan', label: 'Rajasthan' },
  'tamil nadu': { lat: 11.1271, lng: 78.6569, state: 'Tamil Nadu', region: 'Tamil Nadu', label: 'Tamil Nadu' },
  telangana: { lat: 18.1124, lng: 79.0193, state: 'Telangana', region: 'Telangana', label: 'Telangana' },
  'uttar pradesh': { lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh', region: 'Uttar Pradesh', label: 'Uttar Pradesh' },
  'west bengal': { lat: 22.9868, lng: 87.855, state: 'West Bengal', region: 'West Bengal', label: 'West Bengal' },
};

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLocation(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ');
}

function parseDate(value: unknown) {
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value: unknown) {
  const date = parseDate(value);
  if (!date) return 30;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function formatRelativeTime(value: unknown) {
  const days = daysSince(value);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return 'over 30 days ago';
}

function getDisplayName(user: DashboardUser) {
  const full = `${asString(user.firstName)} ${asString(user.lastName)}`.trim();
  return full || asString(user.displayName) || asString(user.email) || 'Unnamed user';
}

function getPatientId(user: DashboardUser) {
  return user.uid || user.id;
}

function getLocationParts(user: DashboardUser) {
  const location = asString(user.district) || asString(user.city) || asString(user.location) || asString(user.region) || asString(user.state);
  const normalized = normalizeLocation(location);
  const district = Array.from(KNOWN_DISTRICTS).find((known) => normalized.includes(known)) || normalized;
  const coords = district ? INDIA_DISTRICT_COORDS[district] : null;
  const regionKey = normalizeLocation(asString(user.state) || asString(user.region) || location);
  const regionCoords = coords ? null : INDIA_REGION_COORDS[regionKey];
  const displayDistrict = coords
    ? district.replace(/\b\w/g, (char) => char.toUpperCase())
    : regionCoords?.label ?? location ?? 'Location not added';
  const region = asString(user.region) || asString(user.state) || coords?.region || regionCoords?.region || 'Region not added';

  return { district: displayDistrict, region, coords: coords ?? regionCoords };
}

function mapNeedType(task: DashboardTask): NeedType {
  const text = `${task.category ?? ''} ${task.type ?? ''} ${task.title ?? ''} ${(task.required_skills ?? []).join(' ')}`.toLowerCase();
  if (text.includes('document') || text.includes('form') || text.includes('legal') || text.includes('certificate')) return 'Documentation Help';
  if (text.includes('financial') || text.includes('fund') || text.includes('money') || text.includes('scheme') || text.includes('grant')) return 'Financial Assistance';
  if (text.includes('medical') || text.includes('doctor') || text.includes('medicine') || text.includes('specialist')) return 'Medical Support';
  return 'Care Guidance';
}

function mapUrgency(task: DashboardTask): CaseRequest['urgency'] {
  const score = typeof task.urgency_score === 'number' ? task.urgency_score : 0.5;
  const priority = asString(task.priority).toLowerCase();
  if (priority === 'urgent' || score >= 0.85) return 'Critical';
  if (priority === 'high' || score >= 0.65) return 'High';
  return 'Moderate';
}

function mapStatus(task: DashboardTask): CaseStatus {
  const status = asString(task.status).toLowerCase();
  if (status === 'assigned') return 'Assigned';
  if (status === 'active' || status === 'in_progress') return 'In Progress';
  if (status === 'completed' || status === 'resolved') return 'Resolved';
  return 'Unassigned';
}

function volunteerAvailability(volunteer: DashboardUser): VolunteerAvailability {
  const raw = volunteer.availability;
  const text = String(raw ?? '').toLowerCase();
  const hours = typeof raw === 'number' ? raw : Number.parseFloat(text);

  if (text.includes('offline') || hours === 0) return 'Offline';
  if (text.includes('busy') || text.includes('focused')) return 'Busy';
  return 'Available';
}

function getRequiredSkillsForNeed(needType: NeedType) {
  if (needType === 'Documentation Help') return ['Form Filling', 'Documentation', 'Legal Literacy'];
  if (needType === 'Financial Assistance') return ['Form Filling', 'Scheme Awareness', 'Financial Aid'];
  if (needType === 'Medical Support') return ['Medical Escort', 'Care Navigation', 'Medical Support'];
  return ['Counselling', 'Care Navigation', 'Translation'];
}

function hasSkillMatch(volunteer: VolunteerProfile, needType: NeedType, taskSkills: string[]) {
  const wanted = [...getRequiredSkillsForNeed(needType), ...taskSkills].map((entry) => entry.toLowerCase());
  return volunteer.skills.some((skill) => wanted.some((entry) => skill.toLowerCase().includes(entry) || entry.includes(skill.toLowerCase())));
}

function caseNeedsAttention(request: CaseRequest) {
  return request.status !== 'Resolved';
}

function buildCases(tasks: DashboardTask[], patients: DashboardUser[], volunteers: VolunteerProfile[]) {
  const patientLookup = new Map(patients.map((patient) => [getPatientId(patient), patient]));

  return tasks
    .filter((task) => task.userId && patientLookup.has(task.userId))
    .map((task) => {
      const patient = patientLookup.get(task.userId!)!;
      const location = getLocationParts(patient);
      const needType = mapNeedType(task);
      const urgency = mapUrgency(task);
      const taskSkills = task.required_skills ?? [];
      const suggestedVolunteerIds = volunteers
        .filter((volunteer) => volunteer.availability === 'Available')
        .filter((volunteer) => volunteer.region === location.district || volunteer.region === location.region || hasSkillMatch(volunteer, needType, taskSkills))
        .slice(0, 4)
        .map((volunteer) => volunteer.id);
      const disease = asString(patient.primaryDisease);
      const diagnosis = asString(patient.diagnosisStatus);
      const title = asString(task.title) || `${needType} request${disease ? ` for ${disease}` : ''}`;
      const summaryParts = [
        asString(task.summary),
        disease ? `Condition: ${disease}` : '',
        diagnosis ? `Diagnosis status: ${diagnosis}` : '',
      ].filter(Boolean);

      return {
        id: task.id || task.task_id || crypto.randomUUID(),
        title,
        district: location.district,
        region: location.region,
        summary: summaryParts.join(' | ') || 'Patient requested support, but no additional details were saved.',
        urgency,
        needType,
        status: mapStatus(task),
        suggestedVolunteerIds,
        assignedVolunteerId: task.assignedVolunteerId ?? undefined,
        patientDisease: disease || undefined,
        createdAt: task.createdAt,
        lastInterventionAt: task.lastInterventionAt ?? task.updatedAt ?? null,
      } satisfies CaseRequest;
    });
}

function buildVolunteers(volunteers: DashboardUser[]) {
  return volunteers.map((volunteer) => {
    const skills = Array.isArray(volunteer.skills) ? volunteer.skills.map(String).filter(Boolean) : [];
    const availability = volunteerAvailability(volunteer);
    const rawHours = volunteer.availability;
    const weeklyCapacity = typeof rawHours === 'number' || asString(rawHours)
      ? `${rawHours} hrs/week`
      : 'Capacity not added';

    return {
      id: volunteer.uid || volunteer.id,
      name: getDisplayName(volunteer),
      skills,
      availability,
      weeklyCapacity,
      region: asString(volunteer.location) || asString(volunteer.city) || asString(volunteer.district) || asString(volunteer.region) || 'Location not added',
    } satisfies VolunteerProfile;
  });
}

function buildDemandClusters(cases: CaseRequest[]): DemandCluster[] {
  const activeCases = cases.filter(caseNeedsAttention);
  const maxVolume = Math.max(1, ...activeCases.map((request) => activeCases.filter((entry) => entry.district === request.district).length));
  const grouped = new Map<string, CaseRequest[]>();

  activeCases.forEach((request) => {
    const key = normalizeLocation(request.district);
    if (!INDIA_DISTRICT_COORDS[key] && !INDIA_REGION_COORDS[key]) return;
    grouped.set(key, [...(grouped.get(key) ?? []), request]);
  });

  return Array.from(grouped.entries())
    .map(([districtKey, requests]) => {
      const coords = INDIA_DISTRICT_COORDS[districtKey] ?? INDIA_REGION_COORDS[districtKey];
      const urgencyAverage = requests.reduce((sum, request) => {
        if (request.urgency === 'Critical') return sum + 1;
        if (request.urgency === 'High') return sum + 0.7;
        return sum + 0.4;
      }, 0) / requests.length;
      const unassignedRatio = requests.filter((request) => request.status === 'Unassigned').length / requests.length;
      const noVolunteerRatio = requests.filter((request) => request.suggestedVolunteerIds.length === 0).length / requests.length;
      const supportGapScore = (unassignedRatio * 0.65) + (noVolunteerRatio * 0.35);
      const recencyScore = requests.reduce((sum, request) => {
        return sum + Math.min(1, daysSince(request.lastInterventionAt ?? request.createdAt) / 14);
      }, 0) / requests.length;
      const volumeScore = requests.length / maxVolume;
      const intensity = Math.round(((volumeScore * 0.3) + (urgencyAverage * 0.3) + (supportGapScore * 0.25) + (recencyScore * 0.15)) * 100);
      const needCounts = requests.reduce((acc, request) => {
        acc.set(request.needType, (acc.get(request.needType) ?? 0) + 1);
        return acc;
      }, new Map<NeedType, number>());
      const topNeed = Array.from(needCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Care Guidance';
      const district = coords.label ?? districtKey.replace(/\b\w/g, (char) => char.toUpperCase());

      return {
        id: districtKey,
        region: coords.region,
        district,
        intensity,
        unmetNeeds: requests.filter((request) => request.status === 'Unassigned').length,
        urgentCases: requests.filter((request) => request.urgency === 'Critical').length,
        topNeed,
        lat: coords.lat,
        lng: coords.lng,
        activeCases: requests.length,
        supportGapScore,
        recencyScore,
      } satisfies DemandCluster;
    })
    .sort((a, b) => b.intensity - a.intensity);
}

function buildCategoryBreakdown(cases: CaseRequest[]): CategoryBreakdownItem[] {
  const activeCases = cases.filter(caseNeedsAttention);
  const total = activeCases.length || 1;

  return (Object.keys(NEED_COLORS) as NeedType[])
    .map((label) => {
      const count = activeCases.filter((request) => request.needType === label).length;
      return {
        label,
        count,
        percent: Math.round((count / total) * 100),
        color: NEED_COLORS[label],
      };
    })
    .filter((item) => item.count > 0);
}

function buildRecentActivity(cases: CaseRequest[], volunteers: VolunteerProfile[]): RecentActivityItem[] {
  const caseActivity = cases.slice(0, 5).map((request) => ({
    id: request.id,
    type: request.status === 'Resolved' ? 'resolved' as const : request.assignedVolunteerId ? 'assignment' as const : 'case' as const,
    text: request.assignedVolunteerId
      ? `${request.title} assigned for ${request.district}`
      : `${request.title} received from ${request.district}`,
    time: formatRelativeTime(request.createdAt),
  }));
  const volunteerActivity = volunteers.slice(0, 3).map((volunteer) => ({
    id: `volunteer-${volunteer.id}`,
    type: 'volunteer' as const,
    text: `${volunteer.name} is available in ${volunteer.region}`,
    time: 'live profile',
  }));

  return [...caseActivity, ...volunteerActivity].slice(0, 6);
}

function buildEffectiveness(cases: CaseRequest[]): EffectivenessSnapshot {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const resolvedThisMonth = cases.filter((request) => {
    const date = parseDate(request.lastInterventionAt ?? request.createdAt);
    return request.status === 'Resolved' && date?.getMonth() === month && date.getFullYear() === year;
  }).length;
  const urgentResolved = cases.filter((request) => request.urgency === 'Critical' && request.status === 'Resolved');
  const averageUrgentResponse = urgentResolved.length
    ? `${Math.round(urgentResolved.reduce((sum, request) => sum + daysSince(request.createdAt), 0) / urgentResolved.length)} days`
    : 'No resolved urgent cases';
  const unresolvedAfterSevenDays = cases.filter((request) => caseNeedsAttention(request) && daysSince(request.createdAt) >= 7).length;

  return { resolvedThisMonth, averageUrgentResponse, unresolvedAfterSevenDays };
}

type NgoDashboardContextValue = {
  name: string;
  loading: boolean;
  error: string;
  selectedGeography: string;
  selectedUrgency: string;
  selectedNeedType: string;
  setSelectedGeography: (value: string) => void;
  setSelectedUrgency: (value: string) => void;
  setSelectedNeedType: (value: string) => void;
  caseRequests: CaseRequest[];
  filteredCases: CaseRequest[];
  urgentCases: number;
  unmetNeeds: number;
  assignedCases: number;
  resolvedThisMonth: number;
  assignmentTarget: string | null;
  setAssignmentTarget: (value: string | null) => void;
  assignVolunteer: (caseId: string, volunteerId: string) => Promise<void>;
  volunteerLookup: Map<string, VolunteerProfile>;
  volunteers: VolunteerProfile[];
  selectedAssignmentCase: CaseRequest | null;
  demandClusters: DemandCluster[];
  filterOptions: {
    geography: string[];
    urgency: string[];
    needType: string[];
  };
  categoryBreakdown: CategoryBreakdownItem[];
  recentActivity: RecentActivityItem[];
  effectiveness: EffectivenessSnapshot;
  refreshDashboard: () => Promise<void>;
};

const NgoDashboardContext = createContext<NgoDashboardContextValue | null>(null);

export function urgencyTone(urgency: CaseRequest['urgency']) {
  if (urgency === 'Critical') return 'bg-primary-blue text-white border-primary-blue';
  if (urgency === 'High') return 'bg-brand-blue-50 text-primary-blue border-brand-blue-100';
  return 'bg-brand-slate-50 text-light-slate border-brand-slate-100';
}

export function statusTone(status: CaseStatus) {
  if (status === 'Unassigned') return 'bg-brand-slate-100 text-light-slate';
  if (status === 'Assigned') return 'bg-brand-blue-50 text-primary-blue';
  if (status === 'Resolved') return 'bg-emerald-50 text-emerald-700';
  return 'bg-primary-blue text-white';
}

export function availabilityTone(status: VolunteerAvailability) {
  if (status === 'Available') return 'bg-brand-blue-50 text-primary-blue';
  if (status === 'Busy') return 'bg-brand-slate-100 text-light-slate';
  return 'bg-brand-slate-50 text-light-slate';
}

export function NgoDashboardProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const ngoName = (profile as Record<string, unknown> | null)?.orgName as string | undefined;
  const name = ngoName ?? profile?.displayName ?? 'Organisation';
  const [payload, setPayload] = useState<NgoDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGeography, setSelectedGeography] = useState('All regions');
  const [selectedUrgency, setSelectedUrgency] = useState('All urgency');
  const [selectedNeedType, setSelectedNeedType] = useState('All needs');
  const [assignmentTarget, setAssignmentTarget] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ngo/dashboard', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to load NGO dashboard data.');
      }

      setPayload(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load NGO dashboard data.');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refreshDashboard();
    }, 0);

    return () => window.clearTimeout(id);
  }, [refreshDashboard]);

  const volunteers = useMemo(() => buildVolunteers(payload?.volunteers ?? []), [payload?.volunteers]);
  const caseRequests = useMemo(() => buildCases(payload?.tasks ?? [], payload?.patients ?? [], volunteers), [payload?.patients, payload?.tasks, volunteers]);
  const demandClusters = useMemo(() => buildDemandClusters(caseRequests), [caseRequests]);
  const filterOptions = useMemo(() => ({
    geography: ['All regions', ...Array.from(new Set(caseRequests.map((request) => request.region).filter((region) => region !== 'Region not added'))).sort()],
    urgency: ['All urgency', 'Critical', 'High', 'Moderate'],
    needType: ['All needs', ...Array.from(new Set(caseRequests.map((request) => request.needType))).sort()],
  }), [caseRequests]);

  const filteredCases = useMemo(() => {
    return caseRequests.filter((request) => {
      const geographyOk = selectedGeography === 'All regions' || request.region === selectedGeography;
      const urgencyOk = selectedUrgency === 'All urgency' || request.urgency === selectedUrgency;
      const needOk = selectedNeedType === 'All needs' || request.needType === selectedNeedType;
      return geographyOk && urgencyOk && needOk;
    });
  }, [caseRequests, selectedGeography, selectedNeedType, selectedUrgency]);

  const activeCases = caseRequests.filter(caseNeedsAttention);
  const urgentCases = activeCases.filter((request) => request.urgency === 'Critical').length;
  const unmetNeeds = activeCases.filter((request) => request.status === 'Unassigned').length;
  const assignedCases = activeCases.filter((request) => request.status !== 'Unassigned').length;
  const resolvedThisMonth = buildEffectiveness(caseRequests).resolvedThisMonth;
  const volunteerLookup = useMemo(() => new Map(volunteers.map((volunteer) => [volunteer.id, volunteer])), [volunteers]);
  const selectedAssignmentCase = caseRequests.find((request) => request.id === assignmentTarget) ?? null;
  const categoryBreakdown = useMemo(() => buildCategoryBreakdown(caseRequests), [caseRequests]);
  const recentActivity = useMemo(() => buildRecentActivity(caseRequests, volunteers), [caseRequests, volunteers]);
  const effectiveness = useMemo(() => buildEffectiveness(caseRequests), [caseRequests]);

  const assignVolunteer = useCallback(async (caseId: string, volunteerId: string) => {
    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: caseId,
        assignedVolunteerId: volunteerId,
        status: 'assigned',
        lastInterventionAt: new Date().toISOString(),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to assign volunteer.');
    }

    setAssignmentTarget(null);
    await refreshDashboard();
  }, [refreshDashboard]);

  const value = useMemo(
    () => ({
      name,
      loading,
      error,
      selectedGeography,
      selectedUrgency,
      selectedNeedType,
      setSelectedGeography,
      setSelectedUrgency,
      setSelectedNeedType,
      caseRequests,
      filteredCases,
      urgentCases,
      unmetNeeds,
      assignedCases,
      resolvedThisMonth,
      assignmentTarget,
      setAssignmentTarget,
      assignVolunteer,
      volunteerLookup,
      volunteers,
      selectedAssignmentCase,
      demandClusters,
      filterOptions,
      categoryBreakdown,
      recentActivity,
      effectiveness,
      refreshDashboard,
    }),
    [
      name,
      loading,
      error,
      selectedGeography,
      selectedUrgency,
      selectedNeedType,
      caseRequests,
      filteredCases,
      urgentCases,
      unmetNeeds,
      assignedCases,
      resolvedThisMonth,
      assignmentTarget,
      assignVolunteer,
      volunteerLookup,
      volunteers,
      selectedAssignmentCase,
      demandClusters,
      filterOptions,
      categoryBreakdown,
      recentActivity,
      effectiveness,
      refreshDashboard,
    ]
  );

  return <NgoDashboardContext.Provider value={value}>{children}</NgoDashboardContext.Provider>;
}

export function useNgoDashboard() {
  const context = useContext(NgoDashboardContext);
  if (!context) {
    throw new Error('useNgoDashboard must be used within NgoDashboardProvider');
  }

  return context;
}
