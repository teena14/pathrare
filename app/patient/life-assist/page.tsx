'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X, Clock, AlertTriangle, CheckCircle, Loader2, User, Building2, BookOpen, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────────
type Priority = 'urgent' | 'high' | 'medium';
type AllocationTier = 1 | 2 | 3 | 4;

interface Action {
  id: string;
  title: string;
  why: string;
  description: string;
  requirements: string[];
  effort: string;
  priority: Priority;
  urgencyScore: number;
  skills: string[];
  category: string;
}

interface Task {
  task_id: string;
  type: string;
  urgency_score: number;
  required_skills: string[];
  priority: Priority;
  fallback_strategy: string[];
}

interface AllocationResult {
  tier: AllocationTier;
  message: string;
  steps?: string[];
}

// ── Priority styling ───────────────────────────────────────────────────────────
const PRIORITY_STYLE: Record<Priority, string> = {
  urgent: 'bg-rose-100 text-rose-700 border-rose-300',
  high:   'bg-amber-100 text-amber-700 border-amber-300',
  medium: 'bg-sky-100 text-sky-700 border-sky-300',
};
const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-rose-500', high: 'bg-amber-500', medium: 'bg-sky-500',
};

// ── Categories ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'financial',  label: 'Financial & Legal Aid',   emoji: '💰', desc: 'Schemes, disability certificates, legal rights' },
  { id: 'education',  label: 'Adaptive Education',       emoji: '📚', desc: 'IEPs, home schooling, special educator access' },
  { id: 'medical',    label: 'Medical & Care',            emoji: '🏥', desc: 'Specialist connects, second opinions, medicine aid' },
  { id: 'assistive',  label: 'Assistive Technology',      emoji: '🦾', desc: 'Devices, mobility aids, adaptive tools' },
];

// ── Mock action data (profile-driven in real system) ─────────────────────────
const ACTIONS: Record<string, Action[]> = {
  financial: [
    {
      id: 'fin-1', title: 'PM-JAY Rare Disease Coverage', priority: 'urgent', urgencyScore: 0.92,
      why: 'Based on your rare disease status, you may qualify for ₹5L/year coverage under Ayushman Bharat.',
      description: 'Pradhan Mantri Jan Arogya Yojana (PM-JAY) covers rare diseases under its expanded list. Patients with a confirmed rare disease diagnosis can get inpatient and surgical care covered.',
      requirements: ['Aadhaar card', "Doctor's rare disease diagnosis letter", 'Income certificate', 'PM-JAY beneficiary ID'],
      effort: '~3 hours with volunteer assistance', skills: ['Form Filling', 'Legal Literacy'], category: 'financial',
    },
    {
      id: 'fin-2', title: 'State Disability Certificate (UDID)', priority: 'high', urgencyScore: 0.78,
      why: 'A UDID card unlocks transport discounts, education reservations, and government schemes.',
      description: 'The Unique Disability ID (UDID) is a national disability certificate that opens access to over 40 central and state schemes. Most rare disease patients qualify.',
      requirements: ['Aadhaar card', 'Diagnosis report', "Doctor's certificate", '2 passport photos'],
      effort: '~2 hours + 2 week government processing', skills: ['Form Filling'], category: 'financial',
    },
    {
      id: 'fin-3', title: 'NGO Emergency Medical Fund', priority: 'urgent', urgencyScore: 0.88,
      why: 'Detected high medical expense burden from your profile. Emergency grants available.',
      description: 'Multiple NGO partners provide emergency medical grants of ₹10,000–₹1,00,000 for rare disease families in financial distress. Applications reviewed within 72 hours.',
      requirements: ['Hospital bills', 'Bank statement', "Doctor's letter", 'Family income proof'],
      effort: '~1 hour to apply', skills: ['Form Filling', 'Counselling'], category: 'financial',
    },
  ],
  education: [
    {
      id: 'edu-1', title: 'Inclusive Education Support (RTE Act)', priority: 'high', urgencyScore: 0.74,
      why: 'Children with rare diseases are entitled to free, adapted education under RTE Section 12 and RPwD Act.',
      description: 'The Right to Education Act and RPwD Act guarantee that children with disabilities receive Individualised Education Plans (IEPs) and in-school support.',
      requirements: ['Child\'s Aadhaar', 'Disability certificate', 'School admission request letter'],
      effort: '~4 hours with coordinator assistance', skills: ['Legal Literacy', 'Counselling'], category: 'education',
    },
    {
      id: 'edu-2', title: 'Home-Based Special Education (HBE)', priority: 'medium', urgencyScore: 0.55,
      why: 'For children unable to attend school due to medical condition.',
      description: 'Government-funded Home-Based Education programme connects families with trained special educators who visit at home for 3+ sessions per week.',
      requirements: ['Medical fitness certificate', 'District special educator application'],
      effort: '~2 hours to initiate', skills: ['Form Filling'], category: 'education',
    },
  ],
  medical: [
    {
      id: 'med-1', title: 'Rare Disease Specialist Connect', priority: 'urgent', urgencyScore: 0.95,
      why: 'No confirmed specialist found in your profile. Early specialist involvement significantly improves outcomes.',
      description: "PathRare's medical network connects you with verified rare disease specialists at AIIMS, CMC Vellore, and partner hospitals — with telehealth options available.",
      requirements: ['Medical history summary', 'Previous reports (if any)', 'Preferred language for consultation'],
      effort: '~30 minutes to request', skills: ['Medical Escort'], category: 'medical',
    },
    {
      id: 'med-2', title: 'Orphan Drug Access Programme', priority: 'high', urgencyScore: 0.81,
      why: 'Several pharmaceutical companies offer free/subsidized orphan drugs for rare disease patients.',
      description: 'Connect to patient assistance programs from Sanofi, Takeda, Novartis, and domestic manufacturers that provide medication at no or reduced cost.',
      requirements: ["Doctor's prescription", 'Current treatment plan', 'Income proof'],
      effort: '~3 hours with NGO partner help', skills: ['Form Filling', 'Medical Escort'], category: 'medical',
    },
  ],
  assistive: [
    {
      id: 'ast-1', title: 'ALIMCO Assistive Device Grant (ADIP)', priority: 'high', urgencyScore: 0.76,
      why: 'Government\'s ADIP scheme provides free wheelchairs, hearing aids, and other devices to eligible patients.',
      description: 'The Assistance to Disabled Persons (ADIP) scheme provides assistive devices worth ₹1,000–₹1,20,000 free of cost to persons with disabilities.',
      requirements: ['UDID card or disability certificate', 'Doctor\'s prescription for device', 'Aadhaar', 'Income certificate'],
      effort: '~2 hours with volunteer help', skills: ['Form Filling'], category: 'assistive',
    },
    {
      id: 'ast-2', title: 'Communication Board / AAC Device', priority: 'medium', urgencyScore: 0.58,
      why: 'For patients with speech/communication impairments — low-cost and free AAC tools available.',
      description: 'Augmentative and Alternative Communication (AAC) devices range from free printable symbol boards to funded electronic speech-generating devices.',
      requirements: ['Speech therapist assessment letter'],
      effort: '~1 hour to identify right solution', skills: ['Tech Support'], category: 'assistive',
    },
  ],
};

// ── Self-guided steps per category ────────────────────────────────────────────
const SELF_STEPS: Record<string, string[]> = {
  financial: [
    'Visit pmjay.gov.in and check your eligibility using your Aadhaar number.',
    'Download the PM-JAY app (Ayushman Bharat) for digital health card access.',
    'Contact your nearest District Hospital to get a disability certificate issued.',
    'Call the toll-free helpline 14555 for scheme guidance.',
  ],
  education: [
    'Write to your child\'s school principal citing Section 16 of RPwD Act 2016.',
    'Contact the District Special Education Officer (DSEO) for IEP support.',
    'Visit the NCERT SELD website for home education resources.',
  ],
  medical: [
    'Upload your reports to the AIIMS Rare Disease portal at rarediseases.aiims.edu.',
    'Request a telehealth appointment noting "Rare Disease — Urgent" in the subject.',
    'Contact ORDI helpline: +91-80-2363-1818 for specialist referrals.',
  ],
  assistive: [
    'Visit alimco.in to check approved devices under the ADIP scheme.',
    'Contact your nearest Composite Regional Centre (CRC) for assessment.',
    'Submit Form ADIP-1 at your District Social Welfare Office.',
  ],
};

// ── Priority Score formula ────────────────────────────────────────────────────
function computePriorityScore(action: Action): number {
  // (Urgency × 0.4) + (Risk × 0.3) + (Delay Impact × 0.2) + (Access Gap × 0.1)
  const urgency = action.urgencyScore;
  const risk    = action.priority === 'urgent' ? 1.0 : action.priority === 'high' ? 0.7 : 0.4;
  const delay   = action.priority === 'urgent' ? 0.9 : 0.5;
  const access  = 0.6; // constant for demo
  return +(urgency * 0.4 + risk * 0.3 + delay * 0.2 + access * 0.1).toFixed(2);
}

// ── Allocation Engine ─────────────────────────────────────────────────────────
async function runAllocation(task: Task, category: string): Promise<AllocationResult> {
  await new Promise(r => setTimeout(r, 1200));
  const rand = Math.random();
  if (rand > 0.6) {
    return { tier: 1, message: 'A volunteer has been matched and will contact you within 2 hours. You can track progress on your dashboard.' };
  }
  await new Promise(r => setTimeout(r, 1000));
  if (rand > 0.3) {
    return { tier: 2, message: 'No volunteer was immediately available. We\'ve routed your request to a partner NGO — they\'ll reach out within 24 hours.' };
  }
  await new Promise(r => setTimeout(r, 800));
  if (rand > 0.1) {
    return { tier: 3, message: 'Here\'s what you can do right now, step by step:', steps: SELF_STEPS[category] };
  }
  return { tier: 4, message: 'We\'ve queued your request and will notify you as soon as a resource becomes available. You\'re not alone in this.' };
}

// ── Tier indicator component ──────────────────────────────────────────────────
function TierIndicator({ active }: { active: AllocationTier | null }) {
  const tiers = [
    { label: 'Volunteer', icon: User },
    { label: 'NGO', icon: Building2 },
    { label: 'Self-Guide', icon: BookOpen },
    { label: 'Queue', icon: Clock },
  ];
  return (
    <div className="flex items-center gap-1 mb-6">
      {tiers.map((t, i) => {
        const Icon = t.icon;
        const tierNum = (i + 1) as AllocationTier;
        const done  = active !== null && tierNum < active;
        const curr  = active === tierNum;
        const future = active === null || tierNum > active;
        return (
          <div key={t.label} className="flex items-center gap-1">
            <div className={`flex flex-col items-center gap-1 transition-all ${future && active !== null ? 'opacity-30' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                done ? 'bg-rose-100 text-rose-500' : curr ? 'bg-primary-blue text-white shadow-md animate-pulse' : 'bg-surface-100 text-light-slate'
              }`}>
                {done ? <X className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className="text-[10px] font-bold text-light-slate">{t.label}</span>
            </div>
            {i < 3 && <div className={`w-6 h-0.5 mb-4 transition-colors ${done ? 'bg-rose-300' : 'bg-surface-200'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LifeAssistPage() {
  const { profile } = useAuth();
  const [step, setStep]                     = useState<'category' | 'actions' | 'detail' | 'allocating' | 'result'>('category');
  const [category, setCategory]             = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [allocationTier, setAllocationTier] = useState<AllocationTier | null>(null);
  const [allocationResult, setAllocationResult] = useState<AllocationResult | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const actions = category ? [...(ACTIONS[category] ?? [])].sort((a, b) => computePriorityScore(b) - computePriorityScore(a)) : [];

  const handleRequestHelp = async (action: Action) => {
    setSelectedAction(action);
    setStep('allocating');
    setAllocationTier(1);

    const task: Task = {
      task_id: `task_${Date.now()}`,
      type: action.id,
      urgency_score: action.urgencyScore,
      required_skills: action.skills,
      priority: action.priority,
      fallback_strategy: ['volunteer', 'ngo', 'self', 'queue'],
    };

    // POST task to API
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, userId: profile?.uid, category }),
      });
    } catch { /* silent — UI never blocks */ }

    // Simulate multi-tier allocation
    const result = await runAllocation(task, category!);
    setAllocationTier(result.tier);
    await new Promise(r => setTimeout(r, 600));
    setAllocationResult(result);
    setStep('result');
  };

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-dark-slate">Life Assist</h1>
        <p className="text-light-slate font-medium mt-1">Ranked, personalized support — financial, medical, education, and assistive technology.</p>
      </div>

      {/* Progress breadcrumb */}
      {step !== 'category' && step !== 'allocating' && step !== 'result' && (
        <div className="flex items-center gap-2 text-xs font-bold text-light-slate">
          <button onClick={() => { setStep('category'); setCategory(null); }} className="hover:text-primary-blue transition-colors">Categories</button>
          {category && <><ChevronRight className="w-3 h-3" /><span className="text-dark-slate">{CATEGORIES.find(c => c.id === category)?.label}</span></>}
          {step === 'detail' && selectedAction && <><ChevronRight className="w-3 h-3" /><span className="text-dark-slate truncate max-w-[150px]">{selectedAction.title}</span></>}
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── Step 1: Category Selection ──────────────────────────────────────── */}
        {step === 'category' && (
          <motion.div key="cat" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="grid grid-cols-2 gap-4">
            {CATEGORIES.map((cat, i) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                onClick={() => { setCategory(cat.id); setStep('actions'); }}
                className="text-left p-6 bg-white rounded-3xl border-2 border-surface-200 hover:border-primary-blue/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="text-4xl mb-4">{cat.emoji}</div>
                <h3 className="font-bold text-dark-slate text-lg mb-1 group-hover:text-primary-blue transition-colors">{cat.label}</h3>
                <p className="text-light-slate text-xs font-medium">{cat.desc}</p>
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* ── Step 2: Ranked Actions ──────────────────────────────────────────── */}
        {step === 'actions' && (
          <motion.div key="actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-4">
            <p className="text-sm text-light-slate font-medium">Results ranked by urgency, risk, and access gap — tailored to your profile.</p>
            {actions.map((action, i) => (
              <motion.div key={action.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="bg-white rounded-3xl border border-surface-200 overflow-hidden">
                {/* Header row */}
                <button
                  className="w-full p-5 text-left flex items-start gap-4 hover:bg-surface-50 transition-colors"
                  onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                >
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${PRIORITY_DOT[action.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-dark-slate text-base">{action.title}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${PRIORITY_STYLE[action.priority]} capitalize`}>
                        {action.priority}
                      </span>
                    </div>
                    <p className="text-xs text-light-slate font-medium leading-relaxed">{action.why}</p>
                  </div>
                  <motion.div animate={{ rotate: expandedAction === action.id ? 180 : 0 }} className="shrink-0 mt-1">
                    <ChevronDown className="w-4 h-4 text-light-slate" />
                  </motion.div>
                </button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expandedAction === action.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }} className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-0 border-t border-surface-100 space-y-4">
                        <p className="text-sm text-dark-slate font-medium leading-relaxed pt-4">{action.description}</p>
                        <div>
                          <p className="text-xs font-bold text-light-slate uppercase tracking-wider mb-2">Requirements</p>
                          <ul className="space-y-1">
                            {action.requirements.map(r => (
                              <li key={r} className="flex items-center gap-2 text-sm text-dark-slate font-medium">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{r}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-light-slate font-medium">
                          <Clock className="w-3.5 h-3.5" /> {action.effort}
                        </div>
                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => { setSelectedAction(action); setStep('detail'); }}
                            className="flex-1 py-2.5 rounded-xl border-2 border-surface-200 text-dark-slate font-bold text-sm hover:border-primary-blue/40 transition-all"
                          >Apply Now</button>
                          <button
                            onClick={() => handleRequestHelp(action)}
                            className="flex-1 py-2.5 rounded-xl bg-primary-blue text-white font-bold text-sm hover:bg-blue-700 shadow-[0_4px_12px_rgba(15,93,227,0.3)] transition-all"
                          >Request Help</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Step 3: Action Detail ───────────────────────────────────────────── */}
        {step === 'detail' && selectedAction && (
          <motion.div key="detail" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="bg-white rounded-3xl border border-surface-200 p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-3 ${PRIORITY_STYLE[selectedAction.priority]} capitalize`}>
                  {selectedAction.priority} priority
                </span>
                <h2 className="text-2xl font-black text-dark-slate">{selectedAction.title}</h2>
                <p className="text-light-slate font-medium mt-1">{selectedAction.why}</p>
              </div>
              <button onClick={() => setStep('actions')} className="p-2 rounded-xl hover:bg-surface-100 transition-colors">
                <X className="w-5 h-5 text-light-slate" />
              </button>
            </div>
            <p className="text-dark-slate font-medium leading-relaxed">{selectedAction.description}</p>
            <div>
              <h3 className="text-sm font-bold text-dark-slate uppercase tracking-wider mb-3">Requirements</h3>
              <ul className="space-y-2">
                {selectedAction.requirements.map(r => (
                  <li key={r} className="flex items-center gap-3 text-sm text-dark-slate font-medium p-3 bg-surface-50 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />{r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-sm text-amber-700 font-medium">Estimated effort: {selectedAction.effort}</span>
            </div>
            <div className="flex gap-4 pt-2">
              <button onClick={() => setStep('actions')} className="flex-1 py-3.5 rounded-2xl border-2 border-surface-200 text-dark-slate font-bold hover:border-primary-blue/30 transition-all">← Back</button>
              <button onClick={() => handleRequestHelp(selectedAction)} className="flex-1 py-3.5 rounded-2xl bg-primary-blue text-white font-bold hover:bg-blue-700 shadow-[0_4px_14px_rgba(15,93,227,0.35)] transition-all">
                Request Help
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 4: Allocating ──────────────────────────────────────────────── */}
        {step === 'allocating' && (
          <motion.div key="allocating" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white rounded-3xl border border-surface-200 p-8 text-center space-y-6">
            <div>
              <h2 className="text-2xl font-black text-dark-slate mb-2">Finding the best support…</h2>
              <p className="text-light-slate font-medium">Our system is allocating the right resource for your request.</p>
            </div>
            <TierIndicator active={allocationTier} />
            <div className="space-y-2">
              {[
                { t: 1, label: 'Searching matched volunteers…' },
                { t: 2, label: 'Routing to NGO partners…' },
                { t: 3, label: 'Preparing guided self-help steps…' },
                { t: 4, label: 'Queuing for next available resource…' },
              ].map(({ t, label }) => (
                <div key={t} className={`flex items-center gap-3 text-sm font-medium transition-all ${
                  allocationTier !== null && t <= allocationTier ? 'text-dark-slate' : 'text-surface-300'
                }`}>
                  {allocationTier !== null && t < allocationTier
                    ? <X className="w-4 h-4 text-rose-400 shrink-0" />
                    : allocationTier === t
                    ? <Loader2 className="w-4 h-4 text-primary-blue animate-spin shrink-0" />
                    : <div className="w-4 h-4" />}
                  {label}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Step 5: Result ──────────────────────────────────────────────────── */}
        {step === 'result' && allocationResult && (
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-surface-200 p-8 space-y-6">

            {/* Tier badge */}
            <div className="flex items-center gap-3">
              {allocationResult.tier === 1 && <div className="p-2 rounded-2xl bg-emerald-100"><User className="w-6 h-6 text-emerald-600" /></div>}
              {allocationResult.tier === 2 && <div className="p-2 rounded-2xl bg-blue-100"><Building2 className="w-6 h-6 text-blue-600" /></div>}
              {allocationResult.tier === 3 && <div className="p-2 rounded-2xl bg-amber-100"><BookOpen className="w-6 h-6 text-amber-600" /></div>}
              {allocationResult.tier === 4 && <div className="p-2 rounded-2xl bg-purple-100"><Clock className="w-6 h-6 text-purple-600" /></div>}
              <div>
                <p className="text-xs font-bold text-light-slate uppercase tracking-wider">
                  {allocationResult.tier === 1 ? 'Volunteer Assigned' : allocationResult.tier === 2 ? 'Routed to NGO' : allocationResult.tier === 3 ? 'Here\'s what you can do right now' : 'Request Queued'}
                </p>
                <h2 className="text-xl font-black text-dark-slate mt-0.5">{selectedAction?.title}</h2>
              </div>
            </div>

            <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed ${
              allocationResult.tier === 1 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              allocationResult.tier === 2 ? 'bg-blue-50 text-blue-800 border border-blue-200' :
              allocationResult.tier === 3 ? 'bg-amber-50 text-amber-800 border border-amber-200' :
              'bg-purple-50 text-purple-800 border border-purple-200'
            }`}>
              {allocationResult.message}
            </div>

            {/* Self-guided steps */}
            {allocationResult.steps && (
              <ol className="space-y-3">
                {allocationResult.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-dark-slate font-medium">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary-blue text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            )}

            {/* Alert bar */}
            {allocationResult.tier <= 2 && (
              <div className="flex items-center gap-2 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs text-light-slate font-medium">If you don't hear back within the expected time, we'll automatically escalate your request.</span>
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button onClick={() => { setStep('category'); setCategory(null); setAllocationResult(null); setAllocationTier(null); }}
                className="flex-1 py-3.5 rounded-2xl border-2 border-surface-200 text-dark-slate font-bold hover:border-primary-blue/30 transition-all text-sm">
                ← Back to Categories
              </button>
              <button onClick={() => { setStep('actions'); setAllocationResult(null); setAllocationTier(null); }}
                className="flex-1 py-3.5 rounded-2xl bg-primary-blue text-white font-bold hover:bg-blue-700 shadow-[0_4px_14px_rgba(15,93,227,0.3)] transition-all text-sm">
                More in {CATEGORIES.find(c => c.id === category)?.label?.split(' ')[0]}
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
