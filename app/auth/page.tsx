'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Heart, Building2, Stethoscope, Users, Mail, Lock, AlertCircle, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLES = [
  { id: 'patient',     name: 'Patient',     icon: User,        desc: 'Find diagnosis & support.',        color: 'from-blue-500 to-indigo-500' },
  { id: 'ngo',        name: 'NGO',         icon: Building2,   desc: 'Offer structured help.',           color: 'from-emerald-500 to-teal-500' },
  { id: 'hospital',   name: 'Hospital',    icon: Heart,       desc: 'Offer second opinions.',           color: 'from-rose-500 to-pink-500' },
  { id: 'volunteer',  name: 'Volunteer',   icon: Users,       desc: 'Guide families in need.',          color: 'from-amber-500 to-orange-500' },
  { id: 'doctor',     name: 'Doctor',      icon: Stethoscope, desc: 'Provide clinical guidance.',       color: 'from-violet-500 to-purple-500' },
  { id: 'coordinator',name: 'Coordinator', icon: ShieldCheck, desc: 'ASHA · Government · Admin',       color: 'from-cyan-500 to-sky-500' },
];

// ── Role dashboard map ────────────────────────────────────────────────────────
function getRoleDashboard(role: string | null): string {
  switch (role) {
    case 'patient':      return '/patient';
    case 'ngo':          return '/ngo';
    case 'volunteer':    return '/volunteer';
    case 'coordinator':  return '/coordinator';
    case 'hospital':     return '/hospital';
    case 'doctor':       return '/doctor';
    default:             return '/auth';
  }
}

function formatRole(role: string) {
  return ROLES.find(r => r.id === role)?.name ?? role;
}

export default function AuthPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const createUserDoc = async (uid: string, email: string | null, role: string) => {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { uid, email, role, isProfileComplete: false, createdAt: new Date().toISOString() });
    }
    return snap.exists() ? snap.data() : null;
  };

  const checkEmailRoleConflict = async (emailAddr: string) => {
    const q = query(collection(db, 'users'), where('email', '==', emailAddr));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data().role as string;
    return null;
  };

  const routeAfterLogin = async (uid: string) => {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) { router.push('/auth/complete-profile'); return; }
    const { isProfileComplete, role } = snap.data();
    if (!isProfileComplete) router.push('/auth/complete-profile');
    else router.push(getRoleDashboard(role));
  };

  // ── Email sign-up ─────────────────────────────────────────────────────────
  const handleEmailSignUp = async () => {
    setError(''); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await createUserDoc(cred.user.uid, cred.user.email, selectedRole!);
      router.push('/auth/complete-profile');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        const existingRole = await checkEmailRoleConflict(email);
        if (existingRole === selectedRole) {
          setError('An account with this email already exists. Switch to Login.');
        } else if (existingRole) {
          setError(`This email is registered as a ${formatRole(existingRole)}. Please use a different email.`);
        } else {
          setError('This email is already in use.');
        }
      } else {
        setError(err.message || 'Sign up failed. Please try again.');
      }
    } finally { setLoading(false); }
  };

  // ── Email login ───────────────────────────────────────────────────────────
  const handleEmailLogin = async () => {
    setError(''); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await routeAfterLogin(cred.user.uid);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('No account found with these credentials. Please Sign Up first.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else {
        setError(err.message || 'Login failed.');
      }
    } finally { setLoading(false); }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) { setError('Please select a role first.'); return; }
    if (isLogin) await handleEmailLogin();
    else await handleEmailSignUp();
  };

  // ── Google sign-up ────────────────────────────────────────────────────────
  const handleGoogleSignUp = async () => {
    if (!selectedRole) { setError('Please select a role first.'); return; }
    setError(''); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const info     = getAdditionalUserInfo(result);
      const isNew    = info?.isNewUser;

      if (!isNew) {
        // Existing Firebase user — check role conflict
        const ref  = doc(db, 'users', result.user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const existingRole = snap.data().role;
          if (existingRole === selectedRole) {
            setError('This Google account already has an account. Switch to Login instead.');
          } else {
            setError(`This Google account is registered as a ${formatRole(existingRole)}. Use a different Google account.`);
          }
          await signOut(auth);
          return;
        }
      }

      // New user — create doc
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        role: selectedRole,
        isProfileComplete: false,
        createdAt: new Date().toISOString(),
      }, { merge: true });
      router.push('/auth/complete-profile');
    } catch (err: any) {
      if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google Sign Up failed.');
      }
    } finally { setLoading(false); }
  };

  // ── Google login ──────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setError(''); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const info     = getAdditionalUserInfo(result);

      if (info?.isNewUser) {
        await signOut(auth);
        setError('No account found with this Google account. Please Sign Up first.');
        return;
      }
      await routeAfterLogin(result.user.uid);
    } catch (err: any) {
      if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google Login failed.');
      }
    } finally { setLoading(false); }
  };

  const handleGoogle = () => isLogin ? handleGoogleLogin() : handleGoogleSignUp();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6 bg-surface-50">

      {/* Top bar */}
      <div className="w-full max-w-3xl mb-8 flex justify-between items-center px-2">
        <Link href="/" className="text-2xl font-black text-dark-slate tracking-tight hover:opacity-80 transition-opacity">
          <span className="text-gradient">PathRare</span>
        </Link>
        {selectedRole && (
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-primary-blue font-bold hover:text-blue-700 transition-colors text-sm"
          >
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </button>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl glass bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-surface-200"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black mb-2 text-dark-slate">
            {!selectedRole
              ? 'Welcome to PathRare'
              : isLogin ? 'Welcome Back' : `Join as ${formatRole(selectedRole)}`}
          </h1>
          <p className="text-light-slate font-medium">
            {!selectedRole
              ? 'Choose your role to get started.'
              : isLogin
              ? 'Login to access your dashboard.'
              : 'Create your account to begin.'}
          </p>
        </div>

        {/* ── Step 1: Role Selection ─────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {!selectedRole && (
            <motion.div
              key="roles"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-3 gap-4"
            >
              {ROLES.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    onClick={() => { setSelectedRole(role.id); setError(''); }}
                    className="text-left p-5 rounded-2xl transition-all duration-300 border-2 flex flex-col items-start bg-white border-surface-200 hover:border-primary-blue/40 hover:bg-surface-50 hover:shadow-lg hover:-translate-y-0.5 group"
                  >
                    <div className={`p-2.5 rounded-xl inline-block mb-3 bg-gradient-to-br ${role.color} shadow-md`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-base font-bold text-dark-slate mb-1 group-hover:text-primary-blue transition-colors">{role.name}</h3>
                    <p className="text-xs text-light-slate font-medium leading-relaxed">{role.desc}</p>
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* ── Step 2: Auth Form ──────────────────────────────────────────────── */}
          {selectedRole && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-sm mx-auto"
            >
              {/* Role chip + back */}
              <button
                onClick={() => { setSelectedRole(null); setError(''); }}
                className="mb-6 flex items-center gap-2 group"
              >
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${ROLES.find(r => r.id === selectedRole)?.color} shadow`}>
                  {(() => { const R = ROLES.find(r => r.id === selectedRole); const Icon = R?.icon ?? User; return <Icon className="w-3.5 h-3.5 text-white" />; })()}
                </div>
                <span className="text-sm font-bold text-primary-blue group-hover:opacity-70 transition-opacity">
                  ← Change Role ({formatRole(selectedRole)})
                </span>
              </button>

              {/* Error */}
              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-medium text-sm flex gap-2.5 items-start">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </motion.div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-dark-slate px-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-light-slate" />
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-surface-50 border-2 border-surface-200 rounded-xl pl-11 pr-4 py-3.5 text-dark-slate font-medium focus:outline-none focus:border-primary-blue transition-colors text-sm"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-dark-slate px-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-light-slate" />
                    <input
                      type="password" required value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-surface-50 border-2 border-surface-200 rounded-xl pl-11 pr-4 py-3.5 text-dark-slate font-medium focus:outline-none focus:border-primary-blue transition-colors text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full mt-2 bg-primary-blue hover:bg-blue-700 text-white font-bold py-3.5 rounded-full shadow-[0_4px_14px_rgba(15,93,227,0.35)] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loading ? 'Processing…' : isLogin ? 'Login' : 'Sign Up'}
                </button>
              </form>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px bg-surface-200 flex-1" />
                <span className="text-light-slate text-xs font-bold uppercase tracking-wider">Or continue with</span>
                <div className="h-px bg-surface-200 flex-1" />
              </div>

              {/* Google */}
              <button
                onClick={handleGoogle} disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-surface-200 hover:border-primary-blue/30 hover:bg-surface-50 text-dark-slate font-bold py-3.5 rounded-full transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:pointer-events-none text-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {isLogin ? 'Login with Google' : 'Sign up with Google'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
