'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function CompleteProfilePage() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl glass p-8 md:p-12 rounded-3xl"
      >
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Complete your profile</h1>
          <p className="text-slate-400 text-sm">We need a few details to tailor your experience.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">First Name</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500" defaultValue="Guest" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Last Name</label>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500" defaultValue="User" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Email Address (from Auth)</label>
            <input type="email" readOnly className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed" value="guest@example.com" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Country</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option>India</option>
              <option>United States</option>
              <option>United Kingdom</option>
            </select>
          </div>

          <button type="submit" className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-4 rounded-xl mt-8 transition-colors">
            Go to Dashboard
          </button>
        </form>
      </motion.div>
    </div>
  );
}
