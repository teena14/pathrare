'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { AlertCircle } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';

type MultiSelectKey = 'focusAreas' | 'skills' | 'specializationTags';

type ExtraProfileFields = Record<string, string | string[]>;

function getRoleDashboard(role: string): string {
  const map: Record<string, string> = {
    patient: '/patient',
    ngo: '/ngo',
    volunteer: '/volunteer',
  };
  return map[role] ?? '/auth';
}

const roleLabels: Record<string, string> = {
  patient: 'Patient',
  ngo: 'NGO',
  volunteer: 'Volunteer',
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-bold text-dark-slate block">{label}</label>
    {children}
  </div>
);

const TextInput = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full bg-surface-50 border-2 border-surface-200 rounded-xl px-4 py-3 text-dark-slate font-medium focus:outline-none focus:border-primary-blue transition-colors text-sm ${className}`.trim()}
  />
);

const Select = ({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full bg-surface-50 border-2 border-surface-200 rounded-xl px-4 py-3 text-dark-slate font-medium focus:outline-none focus:border-primary-blue transition-colors text-sm ${className}`.trim()}
  />
);

const TextArea = ({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`w-full bg-surface-50 border-2 border-surface-200 rounded-xl px-4 py-3 text-dark-slate font-medium focus:outline-none focus:border-primary-blue transition-colors text-sm min-h-28 resize-y ${className}`.trim()}
  />
);

function PatientFields({ data, set }: { data: ExtraProfileFields; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="City / District">
        <TextInput required placeholder="e.g. Pune, Mumbai, Delhi" value={String(data.location ?? '')} onChange={(e) => set('location', e.target.value)} />
      </Field>
      <Field label="State / Region">
        <TextInput required placeholder="e.g. Maharashtra, Delhi NCR" value={String(data.state ?? '')} onChange={(e) => set('state', e.target.value)} />
      </Field>
      <Field label="Diagnosis Status">
        <Select value={String(data.diagnosisStatus ?? '')} onChange={(e) => set('diagnosisStatus', e.target.value)}>
          <option value="">Select status...</option>
          <option value="diagnosed">Diagnosed - rare disease confirmed</option>
          <option value="undiagnosed">Undiagnosed - no confirmed diagnosis</option>
          <option value="suspected">Suspected - under investigation</option>
        </Select>
      </Field>
      <Field label="Primary Disease / Condition (if known)">
        <TextInput placeholder="e.g. CLOVES Syndrome, Pompe Disease..." value={String(data.primaryDisease ?? '')} onChange={(e) => set('primaryDisease', e.target.value)} />
      </Field>
      <Field label="Caregiver Name (optional)">
        <TextInput placeholder="Primary caregiver full name" value={String(data.caregiverName ?? '')} onChange={(e) => set('caregiverName', e.target.value)} />
      </Field>
    </>
  );
}

function NGOFields({ data, set, organizationId }: { data: ExtraProfileFields; set: (k: string, v: string) => void; organizationId: string }) {
  const areas = ['Financial Aid', 'Legal Aid', 'Medical Support', 'Education', 'Assistive Tech', 'Mental Health', 'Rural Outreach'];
  const selectedAreas = Array.isArray(data.focusAreas) ? data.focusAreas : [];
  const specializationTags = Array.isArray(data.specializationTags) ? data.specializationTags : [];

  return (
    <>
      <Field label="Organization Name">
        <TextInput required placeholder="Legal name of your NGO" value={String(data.orgName ?? '')} onChange={(e) => set('orgName', e.target.value)} />
      </Field>
      <Field label="Registration Number">
        <TextInput placeholder="NGO/Trust registration number" value={String(data.regNumber ?? '')} onChange={(e) => set('regNumber', e.target.value)} />
      </Field>
      <Field label="Organization Link ID">
        <TextInput readOnly value={organizationId} className="opacity-70 cursor-not-allowed" />
      </Field>
      <Field label="Region / State">
        <TextInput required placeholder="Primary state of operation" value={String(data.region ?? '')} onChange={(e) => set('region', e.target.value)} />
      </Field>
      <Field label="Focus Areas">
        <div className="flex flex-wrap gap-2 pt-1">
          {areas.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => {
                const next = selectedAreas.includes(area)
                  ? selectedAreas.filter((entry) => entry !== area)
                  : [...selectedAreas, area];
                set('focusAreas', next.join('|'));
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                selectedAreas.includes(area)
                  ? 'bg-primary-blue text-white border-primary-blue shadow'
                  : 'bg-white text-light-slate border-surface-200 hover:border-primary-blue/40'
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Specialization Summary">
        <TextArea
          placeholder="Describe the conditions, communities, or medical support areas your organisation specializes in."
          value={String(data.specializationSummary ?? '')}
          onChange={(e) => set('specializationSummary', e.target.value)}
        />
      </Field>
      <Field label="Specialization Tags">
        <TextInput
          placeholder="e.g. rare disease, pompe disease, neuromuscular, pediatric care"
          value={specializationTags.join(', ')}
          onChange={(e) => set('specializationTags', e.target.value)}
        />
      </Field>
    </>
  );
}

function VolunteerFields({ data, set }: { data: ExtraProfileFields; set: (k: string, v: string) => void }) {
  const skills = ['Form Filling', 'Legal Literacy', 'Medical Escort', 'Translation', 'Tech Support', 'Counselling', 'Data Entry'];
  const selectedSkills = Array.isArray(data.skills) ? data.skills : [];

  return (
    <>
      <Field label="City / District">
        <TextInput required placeholder="Your primary location" value={String(data.location ?? '')} onChange={(e) => set('location', e.target.value)} />
      </Field>
      <Field label="Languages Spoken">
        <TextInput placeholder="e.g. Hindi, English, Tamil" value={String(data.languages ?? '')} onChange={(e) => set('languages', e.target.value)} />
      </Field>
      <Field label="Availability Status">
        <Select value={String(data.availability ?? 'available')} onChange={(e) => set('availability', e.target.value)}>
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </Select>
      </Field>
      <Field label="Weekly Capacity (hours, optional)">
        <TextInput type="number" min="1" max="40" placeholder="e.g. 5" value={String(data.weeklyCapacityHours ?? '')} onChange={(e) => set('weeklyCapacityHours', e.target.value)} />
      </Field>
      <Field label="Skills">
        <div className="flex flex-wrap gap-2 pt-1">
          {skills.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => {
                const next = selectedSkills.includes(skill)
                  ? selectedSkills.filter((entry) => entry !== skill)
                  : [...selectedSkills, skill];
                set('skills', next.join('|'));
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                selectedSkills.includes(skill)
                  ? 'bg-primary-blue text-white border-primary-blue shadow'
                  : 'bg-white text-light-slate border-surface-200 hover:border-primary-blue/40'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      </Field>
    </>
  );
}

function getInitialNameParts(displayName: string | null | undefined) {
  const trimmed = displayName?.trim() ?? '';
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof FirebaseError || error instanceof Error) {
    return error.message;
  }
  return 'Failed to save. Please try again.';
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('');
  const [extra, setExtra] = useState<ExtraProfileFields>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const role = profile?.role ?? null;
  const isEditingExistingProfile = Boolean(profile?.isProfileComplete);
  const initialNameParts = useMemo(() => getInitialNameParts(profile?.displayName ?? user?.displayName), [profile?.displayName, user?.displayName]);
  const profileDefaults = useMemo(() => {
    const profileRecord = profile as Record<string, unknown> | null;
    const defaults = {
      firstName: String(profileRecord?.firstName ?? initialNameParts.firstName),
      lastName: String(profileRecord?.lastName ?? initialNameParts.lastName),
      country: String(profileRecord?.country ?? 'India'),
      extra: {} as ExtraProfileFields,
    };

    if (profileRecord) {
      const next: ExtraProfileFields = {};
      const excludedKeys = new Set(['uid', 'email', 'displayName', 'role', 'isProfileComplete', 'createdAt', 'firstName', 'lastName', 'country']);

      Object.entries(profileRecord).forEach(([key, value]) => {
        if (excludedKeys.has(key) || value == null) {
          return;
        }

        if (Array.isArray(value)) {
          next[key] = value.map(String);
          return;
        }

        next[key] = String(value);
      });

      defaults.extra = next;
    }

    return defaults;
  }, [initialNameParts.firstName, initialNameParts.lastName, profile]);
  const effectiveFirstName = firstName || profileDefaults.firstName;
  const effectiveLastName = lastName || profileDefaults.lastName;
  const effectiveCountry = country || profileDefaults.country;
  const effectiveExtra = { ...profileDefaults.extra, ...extra };

  useEffect(() => {
    if (!user && !authLoading) {
      router.replace('/auth');
    }
  }, [authLoading, router, user]);

  const setField = (key: string, value: string) => {
    const multiSelectFields: MultiSelectKey[] = ['focusAreas', 'skills'];
    if (key === 'specializationTags') {
      setExtra((prev) => ({
        ...prev,
        specializationTags: value
          ? value
              .split(/[,|\n]/)
              .map((entry) => entry.trim())
              .filter(Boolean)
          : [],
      }));
      return;
    }

    if (multiSelectFields.includes(key as MultiSelectKey)) {
      setExtra((prev) => ({ ...prev, [key]: value ? value.split('|') : [] }));
      return;
    }

    setExtra((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('No active session.');
      return;
    }

    if (!role) {
      setError('We could not determine your role. Please sign in again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: effectiveFirstName,
        lastName: effectiveLastName,
        country: effectiveCountry,
        displayName: `${effectiveFirstName} ${effectiveLastName}`.trim(),
        isProfileComplete: true,
        ...effectiveExtra,
        organization_id: role === 'ngo' ? user.uid : null,
        focus_tags: Array.isArray(effectiveExtra.focusAreas) ? effectiveExtra.focusAreas : [],
        associated_ngo_ids: Array.isArray(effectiveExtra.associated_ngo_ids)
          ? effectiveExtra.associated_ngo_ids
          : [],
      });

      const refreshedProfile = await refreshProfile();
      router.replace(getRoleDashboard(refreshedProfile?.role ?? role));
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-50">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg glass bg-white p-8 rounded-[2rem] shadow-xl border border-surface-200 text-center"
        >
          <div className="inline-block px-3 py-1 rounded-full bg-primary-blue/10 text-primary-blue text-xs font-bold mb-4">
            Setting things up
          </div>
          <h1 className="text-2xl font-bold mb-2 text-dark-slate">Preparing your profile</h1>
          <p className="text-light-slate font-medium">We&apos;re loading the form for your selected role.</p>
        </motion.div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-50">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg glass bg-white p-8 rounded-[2rem] shadow-xl border border-surface-200 text-center"
        >
          <div className="inline-block px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold mb-4">
            Profile needs attention
          </div>
          <h1 className="text-2xl font-bold mb-2 text-dark-slate">Role was not saved</h1>
          <p className="text-light-slate font-medium mb-6">Please return to signup and choose Patient, NGO, or Volunteer again.</p>
          <button
            onClick={() => router.replace('/auth')}
            className="bg-primary-blue hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-full transition-all"
          >
            Back to signup
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl glass bg-white p-8 md:p-12 rounded-[2rem] shadow-xl border border-surface-200"
      >
        <div className="mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-primary-blue/10 text-primary-blue text-xs font-bold mb-4">
            {isEditingExistingProfile ? `${roleLabels[role] ?? role} Settings` : roleLabels[role] ?? role}
          </div>
          <h1 className="text-3xl font-bold mb-2 text-dark-slate">{isEditingExistingProfile ? 'Edit your profile' : 'Complete your profile'}</h1>
          <p className="text-light-slate font-medium">Tailored for your role - just a few details.</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium text-sm flex gap-3 items-center"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name">
              <TextInput required placeholder="First" value={effectiveFirstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last Name">
              <TextInput required placeholder="Last" value={effectiveLastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>

          <Field label="Email Address">
            <TextInput type="email" readOnly value={user.email ?? 'Loading...'} className="opacity-60 cursor-not-allowed" />
          </Field>

          <Field label="Country">
            <Select value={effectiveCountry} onChange={(e) => setCountry(e.target.value)}>
              <option>India</option>
              <option>United States</option>
              <option>United Kingdom</option>
              <option>Canada</option>
              <option>Australia</option>
              <option>Other</option>
            </Select>
          </Field>

          <div className="pt-2 border-t border-surface-100 space-y-5">
            {role === 'patient' && <PatientFields data={effectiveExtra} set={setField} />}
            {role === 'ngo' && <NGOFields data={effectiveExtra} set={setField} organizationId={user.uid} />}
            {role === 'volunteer' && <VolunteerFields data={effectiveExtra} set={setField} />}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-blue hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-full mt-2 shadow-[0_4px_14px_0_rgba(15,93,227,0.39)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEditingExistingProfile ? 'Save changes' : 'Enter Dashboard'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
