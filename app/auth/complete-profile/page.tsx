'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertCircle } from 'lucide-react';

function getRoleDashboard(role: string): string {
  const map: Record<string, string> = {
    patient: '/patient', ngo: '/ngo', volunteer: '/volunteer',
    coordinator: '/coordinator', hospital: '/hospital', doctor: '/doctor',
  };
  return map[role] ?? '/auth';
}

// ── Shared Field ──────────────────────────────────────────────────────────────
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-bold text-dark-slate block">{label}</label>
    {children}
  </div>
);

const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className="w-full bg-surface-50 border-2 border-surface-200 rounded-xl px-4 py-3 text-dark-slate font-medium focus:outline-none focus:border-primary-blue transition-colors text-sm" />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className="w-full bg-surface-50 border-2 border-surface-200 rounded-xl px-4 py-3 text-dark-slate font-medium focus:outline-none focus:border-primary-blue transition-colors text-sm" />
);

// ── Role-specific form sections ───────────────────────────────────────────────
function PatientFields({ data, set }: { data: any; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Diagnosis Status">
        <Select value={data.diagnosisStatus ?? ''} onChange={e => set('diagnosisStatus', e.target.value)}>
          <option value="">Select status…</option>
          <option value="diagnosed">Diagnosed — rare disease confirmed</option>
          <option value="undiagnosed">Undiagnosed — no confirmed diagnosis</option>
          <option value="suspected">Suspected — under investigation</option>
        </Select>
      </Field>
      <Field label="Primary Disease / Condition (if known)">
        <TextInput placeholder="e.g. CLOVES Syndrome, Pompe Disease…" value={data.primaryDisease ?? ''} onChange={e => set('primaryDisease', e.target.value)} />
      </Field>
      <Field label="Caregiver Name (optional)">
        <TextInput placeholder="Primary caregiver full name" value={data.caregiverName ?? ''} onChange={e => set('caregiverName', e.target.value)} />
      </Field>
    </>
  );
}

function NGOFields({ data, set }: { data: any; set: (k: string, v: string) => void }) {
  const areas = ['Financial Aid', 'Legal Aid', 'Medical Support', 'Education', 'Assistive Tech', 'Mental Health', 'Rural Outreach'];
  return (
    <>
      <Field label="Organization Name">
        <TextInput required placeholder="Legal name of your NGO" value={data.orgName ?? ''} onChange={e => set('orgName', e.target.value)} />
      </Field>
      <Field label="Registration Number">
        <TextInput placeholder="NGO/Trust registration number" value={data.regNumber ?? ''} onChange={e => set('regNumber', e.target.value)} />
      </Field>
      <Field label="Region / State">
        <TextInput required placeholder="Primary state of operation" value={data.region ?? ''} onChange={e => set('region', e.target.value)} />
      </Field>
      <Field label="Focus Areas">
        <div className="flex flex-wrap gap-2 pt-1">
          {areas.map(a => (
            <button key={a} type="button"
              onClick={() => {
                const current: string[] = data.focusAreas ?? [];
                set('focusAreas', current.includes(a) ? current.filter(x => x !== a).join('|') : [...current, a].join('|'));
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                (data.focusAreas ?? []).includes(a)
                  ? 'bg-primary-blue text-white border-primary-blue shadow'
                  : 'bg-white text-light-slate border-surface-200 hover:border-primary-blue/40'
              }`}
            >{a}</button>
          ))}
        </div>
      </Field>
    </>
  );
}

function VolunteerFields({ data, set }: { data: any; set: (k: string, v: string) => void }) {
  const skills = ['Form Filling', 'Legal Literacy', 'Medical Escort', 'Translation', 'Tech Support', 'Counselling', 'Data Entry'];
  return (
    <>
      <Field label="City / District">
        <TextInput required placeholder="Your primary location" value={data.location ?? ''} onChange={e => set('location', e.target.value)} />
      </Field>
      <Field label="Languages Spoken">
        <TextInput placeholder="e.g. Hindi, English, Tamil" value={data.languages ?? ''} onChange={e => set('languages', e.target.value)} />
      </Field>
      <Field label="Availability (hours per week)">
        <TextInput type="number" min="1" max="40" placeholder="e.g. 5" value={data.availability ?? ''} onChange={e => set('availability', e.target.value)} />
      </Field>
      <Field label="Skills">
        <div className="flex flex-wrap gap-2 pt-1">
          {skills.map(s => (
            <button key={s} type="button"
              onClick={() => {
                const current: string[] = data.skills ?? [];
                set('skills', current.includes(s) ? current.filter(x => x !== s).join('|') : [...current, s].join('|'));
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                (data.skills ?? []).includes(s)
                  ? 'bg-primary-blue text-white border-primary-blue shadow'
                  : 'bg-white text-light-slate border-surface-200 hover:border-primary-blue/40'
              }`}
            >{s}</button>
          ))}
        </div>
      </Field>
    </>
  );
}

function CoordinatorFields({ data, set }: { data: any; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Coordinator Role">
        <Select required value={data.subRole ?? ''} onChange={e => set('subRole', e.target.value)}>
          <option value="">Select role…</option>
          <option value="asha">ASHA / Social Worker</option>
          <option value="government">Government Official</option>
          <option value="admin">Platform Admin</option>
        </Select>
      </Field>
      <Field label="District / Region">
        <TextInput required placeholder="Your district or region" value={data.district ?? ''} onChange={e => set('district', e.target.value)} />
      </Field>
      <Field label="Jurisdiction / Department">
        <TextInput placeholder="e.g. Health Dept, Block PHC" value={data.jurisdiction ?? ''} onChange={e => set('jurisdiction', e.target.value)} />
      </Field>
    </>
  );
}

function HospitalFields({ data, set }: { data: any; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Hospital Name"><TextInput required placeholder="Legal hospital name" value={data.hospitalName ?? ''} onChange={e => set('hospitalName', e.target.value)} /></Field>
      <Field label="Registration Number"><TextInput placeholder="Hospital registration number" value={data.regNumber ?? ''} onChange={e => set('regNumber', e.target.value)} /></Field>
      <Field label="Specialization"><TextInput placeholder="e.g. Rare Diseases, Pediatrics" value={data.specialization ?? ''} onChange={e => set('specialization', e.target.value)} /></Field>
      <Field label="Bed Count"><TextInput type="number" placeholder="Total bed capacity" value={data.bedCount ?? ''} onChange={e => set('bedCount', e.target.value)} /></Field>
    </>
  );
}

function DoctorFields({ data, set }: { data: any; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Medical Specialization"><TextInput required placeholder="e.g. Genetic Medicine, Neurology" value={data.specialization ?? ''} onChange={e => set('specialization', e.target.value)} /></Field>
      <Field label="Medical Licence Number"><TextInput required placeholder="MCI/NMC licence number" value={data.licenceNumber ?? ''} onChange={e => set('licenceNumber', e.target.value)} /></Field>
      <Field label="Hospital Affiliation"><TextInput placeholder="Primary hospital name" value={data.hospitalAffiliation ?? ''} onChange={e => set('hospitalAffiliation', e.target.value)} /></Field>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role ?? 'patient';

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [country,   setCountry]   = useState('India');
  const [extra, setExtra] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const setField = (k: string, v: string) => {
    if (k === 'focusAreas' || k === 'skills') {
      setExtra(prev => ({ ...prev, [k]: v ? v.split('|') : [] }));
    } else {
      setExtra(prev => ({ ...prev, [k]: v }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('No active session.'); return; }
    setLoading(true); setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName, lastName, country,
        displayName: `${firstName} ${lastName}`.trim(),
        isProfileComplete: true,
        ...extra,
      });
      router.push(getRoleDashboard(role));
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.');
      setLoading(false);
    }
  };

  const roleLabels: Record<string, string> = {
    patient: 'Patient', ngo: 'NGO', volunteer: 'Volunteer',
    coordinator: 'Coordinator', hospital: 'Hospital', doctor: 'Doctor',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl glass bg-white p-8 md:p-12 rounded-[2rem] shadow-xl border border-surface-200"
      >
        <div className="mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-primary-blue/10 text-primary-blue text-xs font-bold mb-4">
            {roleLabels[role] ?? role}
          </div>
          <h1 className="text-3xl font-bold mb-2 text-dark-slate">Complete your profile</h1>
          <p className="text-light-slate font-medium">Tailored for your role — just a few details.</p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium text-sm flex gap-3 items-center">
            <AlertCircle className="w-5 h-5 shrink-0" /><p>{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Shared fields */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name">
              <TextInput required placeholder="First" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last Name">
              <TextInput required placeholder="Last" value={lastName} onChange={e => setLastName(e.target.value)} />
            </Field>
          </div>
          <Field label="Email Address">
            <TextInput type="email" readOnly value={user?.email ?? 'Loading…'} className="opacity-60 cursor-not-allowed" />
          </Field>
          <Field label="Country">
            <Select value={country} onChange={e => setCountry(e.target.value)}>
              <option>India</option><option>United States</option><option>United Kingdom</option>
              <option>Canada</option><option>Australia</option><option>Other</option>
            </Select>
          </Field>

          {/* Role-specific fields */}
          <div className="pt-2 border-t border-surface-100 space-y-5">
            {role === 'patient'     && <PatientFields     data={extra} set={setField} />}
            {role === 'ngo'         && <NGOFields         data={extra} set={setField} />}
            {role === 'volunteer'   && <VolunteerFields   data={extra} set={setField} />}
            {role === 'coordinator' && <CoordinatorFields data={extra} set={setField} />}
            {role === 'hospital'    && <HospitalFields    data={extra} set={setField} />}
            {role === 'doctor'      && <DoctorFields      data={extra} set={setField} />}
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-primary-blue hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-full mt-2 shadow-[0_4px_14px_0_rgba(15,93,227,0.39)] transition-all hover:-translate-y-0.5 disabled:opacity-50">
            {loading ? 'Saving…' : 'Enter Dashboard'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
