'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Heart, Building2, Stethoscope, Users, Mail, Lock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const ROLES = [
  { id: 'patient', name: 'Patient', icon: User, desc: 'Find diagnosis & support.' },
  { id: 'ngo', name: 'NGO', icon: Building2, desc: 'Offer structured help.' },
  { id: 'hospital', name: 'Hospital', icon: Heart, desc: 'Offer second opinions.' },
  { id: 'volunteer', name: 'Volunteer', icon: Users, desc: 'Guide families.' },
  { id: 'doctor', name: 'Doctor', icon: Stethoscope, desc: 'Provide guidance.' },
];

export default function AuthPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(false);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // Helper to ensure user document exists natively
  const ensureUserAccount = async (uid: string, email: string | null, role: string) => {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        email,
        role,
        isProfileComplete: false,
        createdAt: new Date().toISOString()
      });
      return false; // Not complete
    }
    return snap.data()?.isProfileComplete || false;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole && !isLogin) {
      setError("Please select a role to sign up.");
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Sign In
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const userRef = doc(db, 'users', cred.user.uid);
        const snap = await getDoc(userRef);
        const isComplete = snap.exists() ? snap.data().isProfileComplete : false;
        
        if (!isComplete) router.push('/auth/complete-profile');
        else router.push('/dashboard');
      } else {
        // Sign Up
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUserAccount(cred.user.uid, cred.user.email, selectedRole!);
        router.push('/auth/complete-profile');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!selectedRole && !isLogin) {
      setError("Please select a role to sign up using Google.");
      return;
    }
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      
      const userRef = doc(db, 'users', cred.user.uid);
      const snap = await getDoc(userRef);
      
      let isComplete = false;
      if (snap.exists()) {
        isComplete = snap.data().isProfileComplete;
        // If they chose a role now, we might want to update it if it's new, but keep it simple for now.
      } else {
        isComplete = await ensureUserAccount(cred.user.uid, cred.user.email, selectedRole || 'patient');
      }

      if (!isComplete) router.push('/auth/complete-profile');
      else router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Auth failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6 bg-surface-50">
      <div className="w-full max-w-5xl mb-8 flex justify-between items-center px-4">
        <Link href="/" className="text-2xl font-black text-dark-slate flex items-center gap-2 tracking-tight hover:opacity-80 transition-opacity">
          <span className="text-gradient">PathRare</span>
        </Link>
        {selectedRole && (
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary-blue font-bold hover:text-blue-700 transition-colors"
          >
            {isLogin ? "Need an account? Sign Up" : "Already have an account? Log In"}
          </button>
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl glass bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-surface-200"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black mb-3 text-dark-slate">
            {!selectedRole ? "Welcome to PathRare" : (isLogin ? "Welcome Back" : "Join PathRare")}
          </h1>
          <p className="text-light-slate font-medium">
            {!selectedRole ? "Select your role to log in or create an account." : (isLogin ? "Enter your details to access your dashboard." : "Enter your details to create your account.")}
          </p>
        </div>

        {/* Roles - Single Line Constraint using Flex Wrap/Scroll */}
        {!selectedRole && (
        <div className="mb-10 w-full overflow-hidden">
          <div className="flex flex-nowrap md:grid md:grid-cols-5 gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar scroll-smooth">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`snap-center shrink-0 w-64 md:w-auto text-left p-5 rounded-2xl transition-all duration-300 border-2 flex flex-col items-start ${
                    isSelected 
                      ? 'bg-primary-blue/5 border-primary-blue shadow-lg shadow-primary-blue/10 transform scale-[1.02]' 
                      : 'bg-white border-surface-200 hover:border-primary-blue/30 hover:bg-surface-50 hover:shadow-md'
                  }`}
                >
                  <div className={`p-3 rounded-xl inline-block mb-4 transition-colors ${isSelected ? 'bg-primary-blue text-white shadow-md' : 'bg-surface-100 text-primary-blue'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-dark-slate mb-1">{role.name}</h3>
                  <p className="text-xs text-light-slate font-medium leading-relaxed">{role.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {selectedRole && (
        <div className="max-w-md mx-auto">
          <button 
            onClick={() => setSelectedRole(null)} 
            className="mb-6 text-sm text-primary-blue font-bold flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span>&larr;</span> Change Role ({ROLES.find(r => r.id === selectedRole)?.name})
          </button>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-medium text-sm flex gap-3 items-center">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-dark-slate px-1">Email Address</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-light-slate">
                  <Mail className="w-5 h-5" />
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-50 border-2 border-surface-200 rounded-xl pl-12 pr-4 py-3.5 text-dark-slate font-medium focus:outline-none focus:ring-0 focus:border-primary-blue transition-colors" 
                  placeholder="name@example.com" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-dark-slate px-1">Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-light-slate">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-50 border-2 border-surface-200 rounded-xl pl-12 pr-4 py-3.5 text-dark-slate font-medium focus:outline-none focus:ring-0 focus:border-primary-blue transition-colors" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-2 bg-primary-blue hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-full shadow-[0_4px_14px_0_rgba(15,93,227,0.39)] transition-all hover:shadow-[0_6px_20px_rgba(15,93,227,0.23)] hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="my-8 flex items-center justify-center gap-4">
            <div className="h-px bg-surface-200 flex-1"></div>
            <span className="text-light-slate text-sm font-bold uppercase tracking-wider">Or continue with</span>
            <div className="h-px bg-surface-200 flex-1"></div>
          </div>

          <button 
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-surface-200 hover:border-primary-blue/30 hover:bg-surface-50 text-dark-slate font-bold text-lg py-4 rounded-full transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:pointer-events-none"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>
        )}
      </motion.div>

      {/* Tailwind specific utility to hide scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
