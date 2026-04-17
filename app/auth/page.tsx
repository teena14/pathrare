'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Heart, Building2, Stethoscope, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const ROLES = [
  { id: 'patient', name: 'Patient / Family', icon: User, desc: 'Find diagnosis, access support, and track care.' },
  { id: 'ngo', name: 'NGO / Organisation', icon: Building2, desc: 'Connect with families and offer structured help.' },
  { id: 'hospital', name: 'Hospital / Clinic', icon: Heart, desc: 'Review clinical profiles and offer second opinions.' },
  { id: 'volunteer', name: 'Volunteer', icon: Users, desc: 'Guide families through paperwork and forms.' },
  { id: 'doctor', name: 'Doctor / Specialist', icon: Stethoscope, desc: 'Provide verified clinical guidance.' },
];

export default function AuthPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const router = useRouter();

  const handleContinue = () => {
    if (selectedRole) {
      router.push('/auth/complete-profile');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl glass bg-white p-8 md:p-12 rounded-[2rem] shadow-xl border border-surface-200"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-dark-slate">How do you want to join PathRare?</h1>
          <p className="text-light-slate text-lg font-medium">Select your role to get matched with the right dashboard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`text-left p-6 rounded-2xl transition-all duration-200 border-2 ${
                  isSelected 
                    ? 'bg-primary-blue/5 border-primary-blue shadow-lg shadow-primary-blue/10 transform scale-[1.02]' 
                    : 'bg-white border-surface-100 hover:border-primary-blue/30 hover:bg-surface-50 hover:shadow-md'
                }`}
              >
                <div className={`p-4 rounded-[1rem] inline-block mb-5 transition-colors ${isSelected ? 'bg-primary-blue text-white shadow-md' : 'bg-surface-100 text-primary-blue'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-dark-slate mb-2">{role.name}</h3>
                <p className="text-sm text-light-slate font-medium leading-relaxed">{role.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-8 border-t border-surface-200">
          <Link href="/" className="text-light-slate hover:text-primary-blue font-bold transition-colors">
            Back
          </Link>
          <button
            onClick={handleContinue}
            disabled={!selectedRole}
            className={`px-8 py-3 rounded-full font-bold transition-all text-lg ${
              selectedRole 
                ? 'bg-primary-blue hover:bg-blue-700 text-white shadow-[0_4px_14px_0_rgba(15,93,227,0.39)] hover:shadow-[0_6px_20px_rgba(15,93,227,0.23)] hover:-translate-y-0.5' 
                : 'bg-surface-200 text-light-slate cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </motion.div>
    </div>
  );
}
