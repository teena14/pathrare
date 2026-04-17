'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertCircle } from 'lucide-react';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('India');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("No active user session found.");
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        firstName,
        lastName,
        country,
        displayName: `${firstName} ${lastName}`.trim(),
        isProfileComplete: true
      });
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update profile. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl glass bg-white p-8 md:p-12 rounded-[2rem] shadow-xl border border-surface-200"
      >
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-3 text-dark-slate">Complete your profile</h1>
          <p className="text-light-slate text-lg font-medium">We need a few details to tailor your experience.</p>
        </div>

        {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-medium text-sm flex gap-3 items-center">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-dark-slate">First Name</label>
              <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-surface-50 border-2 border-surface-200 rounded-xl px-4 py-3.5 text-dark-slate font-medium focus:outline-none focus:ring-0 focus:border-primary-blue transition-colors" placeholder="First" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-dark-slate">Last Name</label>
              <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-surface-50 border-2 border-surface-200 rounded-xl px-4 py-3.5 text-dark-slate font-medium focus:outline-none focus:ring-0 focus:border-primary-blue transition-colors" placeholder="Last" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-dark-slate">Email Address</label>
            <input type="email" readOnly className="w-full bg-surface-100 border-2 border-surface-200 rounded-xl px-4 py-3.5 text-light-slate font-medium cursor-not-allowed" value={user?.email || 'Loading...'} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-dark-slate">Country</label>
            <select value={country} onChange={e => setCountry(e.target.value)} className="w-full bg-surface-50 border-2 border-surface-200 rounded-xl px-4 py-3.5 text-dark-slate font-medium focus:outline-none focus:ring-0 focus:border-primary-blue transition-colors">
              <option value="India">India</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-primary-blue hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-full mt-8 shadow-[0_4px_14px_0_rgba(15,93,227,0.39)] transition-all hover:shadow-[0_6px_20px_rgba(15,93,227,0.23)] hover:-translate-y-0.5 disabled:opacity-50">
            {loading ? 'Saving Profile...' : 'Go to Dashboard'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
