'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { getAssociatedNgoIds, toAvailabilityLabel } from '@/services/ngo/ngo-associations';
import type { HeatCluster } from '@/features/ngo/components/NgoHeatMap';

export type NeedType =
  | 'Medical Support'
  | 'Financial and Legal Aid'
  | 'Adaptive Education'
  | 'Assistive Technology';

export type CaseStatus = 'Unassigned' | 'Assigned' | 'In Progress' | 'Resolved' | 'Handled Externally';
export type VolunteerAvailability = 'Available' | 'Busy' | 'Offline';

type FirestoreRecord = Record<string, unknown>;

type DashboardVolunteer = {
  id: string;
  displayName?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  location?: string | null;
  city?: string | null;
  region?: string | null;
  state?: string | null;
  availability?: string | number | null;
  weeklyCapacityHours?: string | number | null;
  skills?: string[];
  associated_ngo_ids?: string[];
};

type DashboardRequest = {
  id: string;
  requestId: string;
  caseId: string;
  userId: string;
  title: string;
  summary: string;
  category?: string | null;
  needType: string;
  urgencyScore: number;
  status: string;
  requestStatus: string;
  district: string;
  region: string;
  diseaseCluster: string;
  patientName: string;
  assignedVolunteerId?: string | null;
  candidateVolunteerId?: string | null;
  assignedSource?: string | null;
  createdAt?: string;
};

type DashboardCase = {
  id: string;
  taskId: string;
  caseId: string;
  title: string;
  needType: string;
  diseaseCluster: string;
  urgencyScore: number;
  status: string;
  patientName?: string;
  district?: string;
  region?: string;
  assignedVolunteerId?: string | null;
  assignedVolunteerName?: string | null;
  createdAt?: string;
};

type DashboardHeatMetric = {
  id: string;
  region: {
    country?: string | null;
    state?: string | null;
    city?: string | null;
  };
  total_cases: number;
  urgent_cases: number;
  unassigned_cases: number;
  disease_clusters: string[];
  need_types: string[];
  priority_score: number;
  color: 'green' | 'yellow' | 'orange' | 'red';
};

type NgoDashboardPayload = {
  ngo: {
    id: string;
    organizationId?: string | null;
    name: string;
    region?: string | null;
    focusTags: string[];
  };
  volunteers: DashboardVolunteer[];
  incomingRequests: DashboardRequest[];
  activeCases: DashboardCase[];
  externalCases: DashboardCase[];
  heatmap: DashboardHeatMetric[];
  summary: {
    incomingRequests: number;
    activeCases: number;
    externalCases: number;
    availableVolunteers: number;
    linkedVolunteers: number;
  };
  generatedAt: string;
};

type DashboardPatientConnection = {
  id: string;
  patient_id?: string;
  patient_name: string;
  patient_location?: string | null;
  patient_condition?: string | null;
  diagnosis_status?: string | null;
  patient_summary: string;
  created_at?: string;
  updated_at?: string;
  clinical_profile_url?: string | null;
  clinical_profile_available?: boolean;
  status?: string;
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
  priorityScore: number;
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
  patientName?: string;
  createdAt?: string;
  lastInterventionAt?: string | null;
};

export type VolunteerProfile = {
  id: string;
  name: string;
  email?: string | null;
  skills: string[];
  availability: VolunteerAvailability;
  weeklyCapacity: string;
  region: string;
  associatedNgoIds: string[];
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

export type PatientConnectionRequest = {
  id: string;
  patientId: string;
  patientName: string;
  patientLocation: string;
  patientCondition: string | null;
  diagnosisStatus: string | null;
  patientSummary: string;
  createdAt?: string;
  clinicalProfileUrl?: string | null;
  clinicalProfileAvailable: boolean;
  status: string;
};

const NEED_COLORS: Record<NeedType, string> = {
  'Adaptive Education': '#0ea5e9',
  'Assistive Technology': '#10b981',
  'Financial and Legal Aid': '#f59e0b',
  'Medical Support': '#ef4444',
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

function mapNeedType(value: unknown): NeedType {
  const text = asString(value).toLowerCase();
  if (text.includes('financial') || text.includes('legal')) return 'Financial and Legal Aid';
  if (text.includes('education')) return 'Adaptive Education';
  if (text.includes('assistive')) return 'Assistive Technology';
  return 'Medical Support';
}

function mapUrgency(score: unknown): CaseRequest['urgency'] {
  const value = Number(score ?? 0);
  if (value >= 0.85) return 'Critical';
  if (value >= 0.65) return 'High';
  return 'Moderate';
}

function mapStatus(status: unknown, assignedSource?: unknown): CaseStatus {
  const value = asString(status).toLowerCase();
  const source = asString(assignedSource).toLowerCase();
  if (source === 'global') return 'Handled Externally';
  if (value === 'assigned' || value === 'accepted') return 'Assigned';
  if (value === 'active' || value === 'in_progress') return 'In Progress';
  if (value === 'completed' || value === 'resolved') return 'Resolved';
  return 'Unassigned';
}

function volunteerAvailability(volunteer: DashboardVolunteer): VolunteerAvailability {
  return toAvailabilityLabel(volunteer.availability) as VolunteerAvailability;
}

function buildVolunteers(volunteers: DashboardVolunteer[]) {
  return volunteers.map((volunteer) => {
    const skills = Array.isArray(volunteer.skills) ? volunteer.skills.map(String).filter(Boolean) : [];
    const availability = volunteerAvailability(volunteer);
    const rawHours = volunteer.weeklyCapacityHours ?? volunteer.availability;
    const weeklyCapacity =
      typeof rawHours === 'number' || asString(rawHours)
        ? `${rawHours} hrs/week`
        : 'Capacity not added';
    const region =
      asString(volunteer.location) ||
      asString(volunteer.city) ||
      asString(volunteer.region) ||
      asString(volunteer.state) ||
      'Location not added';
    const fullName = `${asString(volunteer.firstName)} ${asString(volunteer.lastName)}`.trim();

    return {
      id: volunteer.id,
      name: fullName || asString(volunteer.displayName) || 'Volunteer',
      email: asString(volunteer.email) || null,
      skills,
      availability,
      weeklyCapacity,
      region,
      associatedNgoIds: getAssociatedNgoIds(volunteer),
    } satisfies VolunteerProfile;
  });
}

function hasSkillMatch(volunteer: VolunteerProfile, needType: NeedType, taskSkills: string[]) {
  const wanted = [needType, ...taskSkills].map((entry) => entry.toLowerCase());
  return volunteer.skills.some((skill) => wanted.some((entry) => skill.toLowerCase().includes(entry) || entry.includes(skill.toLowerCase())));
}

function buildCases(
  incomingRequests: DashboardRequest[],
  activeCases: DashboardCase[],
  externalCases: DashboardCase[],
  volunteers: VolunteerProfile[]
) {
  const fromIncoming = incomingRequests.map((request) => {
    const suggestedVolunteerIds = volunteers
      .filter((volunteer) => volunteer.availability === 'Available')
      .filter((volunteer) => volunteer.region === request.district || volunteer.region === request.region || hasSkillMatch(volunteer, mapNeedType(request.needType), []))
      .slice(0, 4)
      .map((volunteer) => volunteer.id);

    return {
      id: request.id,
      title: request.title,
      district: request.district,
      region: request.region,
      summary: request.summary || `${request.patientName} requested support.`,
      urgency: mapUrgency(request.urgencyScore),
      needType: mapNeedType(request.needType),
      status: mapStatus(request.status, request.assignedSource),
      suggestedVolunteerIds,
      assignedVolunteerId: request.assignedVolunteerId ?? undefined,
      patientDisease: request.diseaseCluster,
      patientName: request.patientName,
      createdAt: request.createdAt,
      lastInterventionAt: null,
    } satisfies CaseRequest;
  });

  const fromActive = activeCases.map((entry) => ({
    id: entry.taskId || entry.id,
    title: entry.title,
    district: entry.district ?? 'Location not added',
    region: entry.region ?? 'Region not added',
    summary: `${entry.patientName ?? 'Patient'} is currently being handled by your NGO.`,
    urgency: mapUrgency(entry.urgencyScore),
    needType: mapNeedType(entry.needType),
    status: mapStatus(entry.status, 'ngo'),
    suggestedVolunteerIds: [],
    assignedVolunteerId: entry.assignedVolunteerId ?? undefined,
    patientDisease: entry.diseaseCluster,
    patientName: entry.patientName,
    createdAt: entry.createdAt,
    lastInterventionAt: entry.createdAt ?? null,
  }) satisfies CaseRequest);

  const fromExternal = externalCases.map((entry) => ({
    id: entry.taskId || entry.id,
    title: entry.title,
    district: 'Location not added',
    region: 'Handled externally',
    summary: 'This case was accepted by the global volunteer pool before your NGO could take ownership.',
    urgency: mapUrgency(entry.urgencyScore),
    needType: mapNeedType(entry.needType),
    status: mapStatus(entry.status, 'global'),
    suggestedVolunteerIds: [],
    assignedVolunteerId: entry.assignedVolunteerId ?? undefined,
    patientDisease: entry.diseaseCluster,
    createdAt: entry.createdAt,
    lastInterventionAt: entry.createdAt ?? null,
  }) satisfies CaseRequest);

  return [...fromIncoming, ...fromActive, ...fromExternal].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

function buildDemandClusters(metrics: DashboardHeatMetric[]): DemandCluster[] {
  return metrics
    .map((metric) => {
      const districtKey = normalizeLocation(asString(metric.region.city) || asString(metric.region.state) || asString(metric.region.country));
      const coords = INDIA_DISTRICT_COORDS[districtKey] ?? INDIA_REGION_COORDS[districtKey];
      if (!coords) return null;

      const priority = Number(metric.priority_score ?? 0);
      const intensity = Math.max(15, Math.min(100, Math.round(priority * 6)));
      const topNeed = mapNeedType(metric.need_types[0] ?? 'medical');

      return {
        id: metric.id,
        region: coords.region,
        district: coords.label ?? (asString(metric.region.city) || asString(metric.region.state) || 'Unknown'),
        intensity,
        unmetNeeds: Number(metric.unassigned_cases ?? 0),
        urgentCases: Number(metric.urgent_cases ?? 0),
        topNeed,
        lat: coords.lat,
        lng: coords.lng,
        activeCases: Number(metric.total_cases ?? 0),
        supportGapScore: Number(metric.unassigned_cases ?? 0),
        recencyScore: 0,
        priorityScore: priority,
      } satisfies DemandCluster;
    })
    .filter((cluster): cluster is DemandCluster => Boolean(cluster))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function buildCategoryBreakdown(cases: CaseRequest[]): CategoryBreakdownItem[] {
  const activeCases = cases.filter((entry) => entry.status !== 'Resolved');
  const total = activeCases.length || 1;

  return (Object.keys(NEED_COLORS) as NeedType[]).map((label) => {
    const count = activeCases.filter((request) => request.needType === label).length;
    return {
      label,
      count,
      percent: Math.round((count / total) * 100),
      color: NEED_COLORS[label],
    };
  }).filter((item) => item.count > 0);
}

function buildRecentActivity(cases: CaseRequest[], volunteers: VolunteerProfile[]): RecentActivityItem[] {
  const caseActivity = cases.slice(0, 5).map((request) => ({
    id: request.id,
    type:
      request.status === 'Resolved'
        ? ('resolved' as const)
        : request.assignedVolunteerId
          ? ('assignment' as const)
          : ('case' as const),
    text:
      request.status === 'Handled Externally'
        ? `${request.title} was picked up by the global volunteer pool.`
        : request.assignedVolunteerId
          ? `${request.title} is now assigned.`
          : `${request.title} entered your NGO pipeline.`,
    time: formatRelativeTime(request.createdAt),
  }));
  const volunteerActivity = volunteers.slice(0, 3).map((volunteer) => ({
    id: `volunteer-${volunteer.id}`,
    type: 'volunteer' as const,
    text: `${volunteer.name} is ${volunteer.availability.toLowerCase()} in ${volunteer.region}.`,
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
  const unresolvedAfterSevenDays = cases.filter((request) => request.status === 'Unassigned' && daysSince(request.createdAt) >= 7).length;

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
  deleteCase: (caseId: string) => Promise<void>;
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
  patientConnections: PatientConnectionRequest[];
  incomingPatientConnections: PatientConnectionRequest[];
  connectedPatients: PatientConnectionRequest[];
  acceptPatientConnection: (requestId: string) => Promise<void>;
  declinePatientConnection: (requestId: string) => Promise<void>;
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
  if (status === 'Handled Externally') return 'bg-amber-50 text-amber-700';
  return 'bg-primary-blue text-white';
}

export function availabilityTone(status: VolunteerAvailability) {
  if (status === 'Available') return 'bg-brand-blue-50 text-primary-blue';
  if (status === 'Busy') return 'bg-brand-slate-100 text-light-slate';
  return 'bg-brand-slate-50 text-light-slate';
}

export function NgoDashboardProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const profileUid = profile?.uid ?? '';
  const profileRecord = (profile as FirestoreRecord | null) ?? null;
  const name = asString(profileRecord?.orgName) || profile?.displayName || 'Organisation';
  const [payload, setPayload] = useState<NgoDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGeography, setSelectedGeography] = useState('All regions');
  const [selectedUrgency, setSelectedUrgency] = useState('All urgency');
  const [selectedNeedType, setSelectedNeedType] = useState('All needs');
  const [assignmentTarget, setAssignmentTarget] = useState<string | null>(null);
  const [patientConnections, setPatientConnections] = useState<PatientConnectionRequest[]>([]);

  const refreshDashboard = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false;

    if (!profileUid) {
      setPayload(null);
      setPatientConnections([]);
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    setError('');

    try {
      const [response, connectionResponse] = await Promise.all([
        fetch(`/api/ngo/dashboard?ngoId=${encodeURIComponent(profileUid)}`, { cache: 'no-store' }),
        fetch(`/api/ngo/connections?ngoId=${encodeURIComponent(profileUid)}`, { cache: 'no-store' }),
      ]);
      const [data, connectionData] = await Promise.all([response.json(), connectionResponse.json()]);

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to load NGO dashboard data.');
      }

      if (!connectionResponse.ok) {
        throw new Error(connectionData.error ?? 'Unable to load patient connection requests.');
      }

      setPayload(data);
      setPatientConnections(
        Array.isArray(connectionData.requests)
          ? connectionData.requests.map((request: DashboardPatientConnection) => ({
              id: request.id,
              patientId: asString(request.patient_id) || '',
              patientName: asString(request.patient_name) || 'Patient',
              patientLocation: asString(request.patient_location) || 'Location not added',
              patientCondition: asString(request.patient_condition) || null,
              diagnosisStatus: asString(request.diagnosis_status) || null,
              patientSummary: asString(request.patient_summary),
              createdAt: asString(request.updated_at) || asString(request.created_at) || undefined,
              clinicalProfileUrl: asString(request.clinical_profile_url) || null,
              clinicalProfileAvailable: Boolean(request.clinical_profile_available),
              status: asString(request.status) || 'pending',
            }))
          : []
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load NGO dashboard data.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [profileUid]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refreshDashboard({ showLoading: true });
    }, 0);

    if (!profileUid) {
      return () => window.clearTimeout(id);
    }

    const interval = window.setInterval(() => {
      void refreshDashboard();
    }, 10000);

    return () => {
      window.clearTimeout(id);
      window.clearInterval(interval);
    };
  }, [profileUid, refreshDashboard]);

  const volunteers = useMemo(() => buildVolunteers(payload?.volunteers ?? []), [payload?.volunteers]);
  const caseRequests = useMemo(
    () => buildCases(payload?.incomingRequests ?? [], payload?.activeCases ?? [], payload?.externalCases ?? [], volunteers),
    [payload?.activeCases, payload?.externalCases, payload?.incomingRequests, volunteers]
  );
  const demandClusters = useMemo(() => buildDemandClusters(payload?.heatmap ?? []), [payload?.heatmap]);
  const filterOptions = useMemo(
    () => ({
      geography: ['All regions', ...Array.from(new Set(caseRequests.map((request) => request.region).filter((region) => region !== 'Region not added'))).sort()],
      urgency: ['All urgency', 'Critical', 'High', 'Moderate'],
      needType: ['All needs', ...Array.from(new Set(caseRequests.map((request) => request.needType))).sort()],
    }),
    [caseRequests]
  );

  const filteredCases = useMemo(() => {
    return caseRequests.filter((request) => {
      const geographyOk = selectedGeography === 'All regions' || request.region === selectedGeography;
      const urgencyOk = selectedUrgency === 'All urgency' || request.urgency === selectedUrgency;
      const needOk = selectedNeedType === 'All needs' || request.needType === selectedNeedType;
      return geographyOk && urgencyOk && needOk;
    });
  }, [caseRequests, selectedGeography, selectedNeedType, selectedUrgency]);

  const activeCases = caseRequests.filter((request) => request.status !== 'Resolved' && request.status !== 'Handled Externally');
  const urgentCases = activeCases.filter((request) => request.urgency === 'Critical').length;
  const unmetNeeds = caseRequests.filter((request) => request.status === 'Unassigned').length;
  const assignedCases = caseRequests.filter((request) => request.status === 'Assigned' || request.status === 'In Progress').length;
  const resolvedThisMonth = buildEffectiveness(caseRequests).resolvedThisMonth;
  const volunteerLookup = useMemo(() => new Map(volunteers.map((volunteer) => [volunteer.id, volunteer])), [volunteers]);
  const selectedAssignmentCase = caseRequests.find((request) => request.id === assignmentTarget) ?? null;
  const categoryBreakdown = useMemo(() => buildCategoryBreakdown(caseRequests), [caseRequests]);
  const recentActivity = useMemo(() => buildRecentActivity(caseRequests, volunteers), [caseRequests, volunteers]);
  const effectiveness = useMemo(() => buildEffectiveness(caseRequests), [caseRequests]);
  const incomingPatientConnections = useMemo(
    () => patientConnections.filter((request) => request.status === 'pending'),
    [patientConnections]
  );
  const connectedPatients = useMemo(
    () => patientConnections.filter((request) => request.status === 'accepted'),
    [patientConnections]
  );

  const assignVolunteer = useCallback(async (caseId: string, volunteerId: string) => {
    const ngoId = asString(payload?.ngo.organizationId) || profile?.uid;
    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assign_ngo_candidate',
        taskId: caseId,
        ngoId,
        volunteerId,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to assign volunteer.');
    }

    setAssignmentTarget(null);
    await refreshDashboard();
  }, [payload?.ngo.organizationId, profile?.uid, refreshDashboard]);

  const deleteCase = useCallback(async (caseId: string) => {
    const ngoId = asString(payload?.ngo.organizationId) || profile?.uid;
    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'archive',
        taskId: caseId,
        actorRole: 'ngo',
        actorId: ngoId,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to delete case from dashboard.');
    }

    await refreshDashboard();
  }, [payload?.ngo.organizationId, profile?.uid, refreshDashboard]);

  const acceptPatientConnection = useCallback(async (requestId: string) => {
    const response = await fetch('/api/ngo/connections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        action: 'accept',
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to accept patient connection.');
    }

    await refreshDashboard();
  }, [refreshDashboard]);

  const declinePatientConnection = useCallback(async (requestId: string) => {
    const response = await fetch('/api/ngo/connections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        action: 'decline',
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? 'Unable to decline patient connection.');
    }

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
      deleteCase,
      volunteerLookup,
      volunteers,
      selectedAssignmentCase,
      demandClusters,
      filterOptions,
      categoryBreakdown,
      recentActivity,
      effectiveness,
      patientConnections,
      incomingPatientConnections,
      connectedPatients,
      acceptPatientConnection,
      declinePatientConnection,
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
      deleteCase,
      volunteerLookup,
      volunteers,
      selectedAssignmentCase,
      demandClusters,
      filterOptions,
      categoryBreakdown,
      recentActivity,
      effectiveness,
      patientConnections,
      incomingPatientConnections,
      connectedPatients,
      acceptPatientConnection,
      declinePatientConnection,
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
