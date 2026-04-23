'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { HeatCluster } from './NgoHeatMap';

export type NeedType =
  | 'Medical Support'
  | 'Financial Assistance'
  | 'Documentation Help'
  | 'Care Guidance';

export type CaseStatus = 'Unassigned' | 'Assigned' | 'In Progress';
export type VolunteerAvailability = 'Available' | 'Busy' | 'Offline';

export type DemandCluster = HeatCluster & {
  topNeed: NeedType;
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
};

export type VolunteerProfile = {
  id: string;
  name: string;
  skills: string[];
  availability: VolunteerAvailability;
  weeklyCapacity: string;
  region: string;
};

export const DEMAND_CLUSTERS: DemandCluster[] = [
  { id: 'pune', region: 'West Maharashtra', district: 'Pune', intensity: 94, unmetNeeds: 18, urgentCases: 7, topNeed: 'Documentation Help', lat: 18.5204, lng: 73.8567 },
  { id: 'mumbai', region: 'Konkan', district: 'Mumbai', intensity: 88, unmetNeeds: 22, urgentCases: 9, topNeed: 'Financial Assistance', lat: 19.076, lng: 72.8777 },
  { id: 'nashik', region: 'North Maharashtra', district: 'Nashik', intensity: 72, unmetNeeds: 11, urgentCases: 4, topNeed: 'Care Guidance', lat: 19.9975, lng: 73.7898 },
  { id: 'nagpur', region: 'Vidarbha', district: 'Nagpur', intensity: 64, unmetNeeds: 9, urgentCases: 3, topNeed: 'Medical Support', lat: 21.1458, lng: 79.0882 },
  { id: 'aurangabad', region: 'Marathwada', district: 'Aurangabad', intensity: 59, unmetNeeds: 8, urgentCases: 2, topNeed: 'Documentation Help', lat: 19.8762, lng: 75.3433 },
];

export const VOLUNTEERS: VolunteerProfile[] = [
  { id: 'v1', name: 'Sana Kulkarni', skills: ['Documentation', 'Form Filling', 'Legal Literacy'], availability: 'Available', weeklyCapacity: '6 hrs free', region: 'Pune' },
  { id: 'v2', name: 'Rohan Sheikh', skills: ['Counselling', 'Care Guidance'], availability: 'Available', weeklyCapacity: '4 hrs free', region: 'Mumbai' },
  { id: 'v3', name: 'Meera Patil', skills: ['Medical Escort', 'Care Navigation'], availability: 'Busy', weeklyCapacity: 'Resumes tomorrow', region: 'Nashik' },
  { id: 'v4', name: 'Ayaan Thomas', skills: ['Documentation', 'Translation'], availability: 'Available', weeklyCapacity: '3 hrs free', region: 'Nagpur' },
];

const INITIAL_CASES: CaseRequest[] = [
  {
    id: 'case-101',
    title: 'UDID application blocked after repeated document mismatch',
    district: 'Pune',
    region: 'West Maharashtra',
    summary: 'Family needs urgent documentation support to unlock disability certification and transport concessions.',
    urgency: 'Critical',
    needType: 'Documentation Help',
    status: 'Unassigned',
    suggestedVolunteerIds: ['v1', 'v4'],
  },
  {
    id: 'case-102',
    title: 'Emergency medicine cost gap for undiagnosed child',
    district: 'Mumbai',
    region: 'Konkan',
    summary: 'Parent needs bridge support for tests and medicine while waiting for scheme approval.',
    urgency: 'Critical',
    needType: 'Financial Assistance',
    status: 'Assigned',
    suggestedVolunteerIds: ['v2'],
    assignedVolunteerId: 'v2',
  },
  {
    id: 'case-103',
    title: 'Rare disease referral pathway unclear after discharge',
    district: 'Nashik',
    region: 'North Maharashtra',
    summary: 'Caregiver needs step-by-step help navigating follow-up appointments and scheme paperwork.',
    urgency: 'High',
    needType: 'Care Guidance',
    status: 'In Progress',
    suggestedVolunteerIds: ['v2', 'v3'],
    assignedVolunteerId: 'v3',
  },
  {
    id: 'case-104',
    title: 'Second-opinion access request from district hospital',
    district: 'Nagpur',
    region: 'Vidarbha',
    summary: 'Family needs support collecting records and arranging a specialist consult outside district.',
    urgency: 'Moderate',
    needType: 'Medical Support',
    status: 'Unassigned',
    suggestedVolunteerIds: ['v3', 'v4'],
  },
];

export const FILTER_OPTIONS = {
  geography: ['All regions', 'West Maharashtra', 'Konkan', 'North Maharashtra', 'Vidarbha', 'Marathwada'],
  urgency: ['All urgency', 'Critical', 'High', 'Moderate'],
  needType: ['All needs', 'Medical Support', 'Financial Assistance', 'Documentation Help', 'Care Guidance'],
};

type NgoDashboardContextValue = {
  name: string;
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
  assignmentTarget: string | null;
  setAssignmentTarget: (value: string | null) => void;
  assignVolunteer: (caseId: string, volunteerId: string) => void;
  volunteerLookup: Map<string, VolunteerProfile>;
  selectedAssignmentCase: CaseRequest | null;
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
  const [selectedGeography, setSelectedGeography] = useState('All regions');
  const [selectedUrgency, setSelectedUrgency] = useState('All urgency');
  const [selectedNeedType, setSelectedNeedType] = useState('All needs');
  const [caseRequests, setCaseRequests] = useState(INITIAL_CASES);
  const [assignmentTarget, setAssignmentTarget] = useState<string | null>(null);

  const filteredCases = useMemo(() => {
    return caseRequests.filter((request) => {
      const geographyOk = selectedGeography === 'All regions' || request.region === selectedGeography;
      const urgencyOk = selectedUrgency === 'All urgency' || request.urgency === selectedUrgency;
      const needOk = selectedNeedType === 'All needs' || request.needType === selectedNeedType;
      return geographyOk && urgencyOk && needOk;
    });
  }, [caseRequests, selectedGeography, selectedNeedType, selectedUrgency]);

  const urgentCases = caseRequests.filter((request) => request.urgency === 'Critical').length;
  const unmetNeeds = DEMAND_CLUSTERS.reduce((sum, cluster) => sum + cluster.unmetNeeds, 0);
  const assignedCases = caseRequests.filter((request) => request.status !== 'Unassigned').length;
  const volunteerLookup = useMemo(() => new Map(VOLUNTEERS.map((volunteer) => [volunteer.id, volunteer])), []);
  const selectedAssignmentCase = caseRequests.find((request) => request.id === assignmentTarget) ?? null;

  const assignVolunteer = (caseId: string, volunteerId: string) => {
    setCaseRequests((current) =>
      current.map((request) =>
        request.id === caseId
          ? { ...request, assignedVolunteerId: volunteerId, status: 'Assigned' }
          : request
      )
    );
    setAssignmentTarget(null);
  };

  const value = useMemo(
    () => ({
      name,
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
      assignmentTarget,
      setAssignmentTarget,
      assignVolunteer,
      volunteerLookup,
      selectedAssignmentCase,
    }),
    [
      name,
      selectedGeography,
      selectedUrgency,
      selectedNeedType,
      caseRequests,
      filteredCases,
      urgentCases,
      unmetNeeds,
      assignedCases,
      assignmentTarget,
      volunteerLookup,
      selectedAssignmentCase,
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
