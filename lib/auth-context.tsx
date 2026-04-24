'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: string | null;
  isProfileComplete: boolean;
  joinedCircles?: string[];
  associated_ngo_ids?: string[];
  availability?: string | number | null;
  orgName?: string | null;
}

type GoogleSignInResult =
  | {
      status: 'new-user' | 'existing-user';
      storedRole: string;
      redirectTo: string;
      profile: UserProfile;
    }
  | {
      status: 'role-conflict';
      storedRole: string;
    };

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: (role: string) => Promise<GoogleSignInResult>;
  refreshProfile: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
  updateProfileRole: (role: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function getRoleDashboard(role: string | null): string {
  switch (role) {
    case 'patient':
      return '/patient';
    case 'ngo':
      return '/ngo';
    case 'volunteer':
      return '/volunteer';
    default:
      return '/auth';
  }
}

function normalizeProfileData(user: User, profile: UserProfile | null): UserProfile | null {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    uid: user.uid,
    email: user.email ? user.email.toLowerCase() : profile.email,
    displayName: profile.displayName ?? user.displayName,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const authRequestIdRef = useRef(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const requestId = ++authRequestIdRef.current;
      setUser(firebaseUser);

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (authRequestIdRef.current !== requestId || auth.currentUser?.uid !== firebaseUser.uid) {
          return;
        }

        if (userDoc.exists()) {
          setProfile(normalizeProfileData(firebaseUser, userDoc.data() as UserProfile));
        } else {
          setProfile((prev) => prev?.uid === firebaseUser.uid ? prev : null);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async (role: string): Promise<GoogleSignInResult> => {
    if (!role) {
      throw new Error('Please select a role first.');
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    const result = await signInWithPopup(auth, provider);
    const userDocRef = doc(db, 'users', result.user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      const newProfile: UserProfile = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        role,
        isProfileComplete: false,
        joinedCircles: [],
        associated_ngo_ids: role === 'volunteer' ? [] : undefined,
        availability: role === 'volunteer' ? 'available' : null,
      };

      await setDoc(userDocRef, {
        ...newProfile,
        email: result.user.email ? result.user.email.toLowerCase() : null,
        createdAt: new Date().toISOString()
      });

      setProfile(newProfile);

      return {
        status: 'new-user',
        storedRole: role,
        redirectTo: '/auth/complete-profile',
        profile: newProfile
      };
    }

    const existingProfile = userDoc.data() as UserProfile;

    if (existingProfile.role !== role) {
      await firebaseSignOut(auth);

      return {
        status: 'role-conflict',
        storedRole: existingProfile.role ?? 'account owner'
      };
    }

    setProfile(normalizeProfileData(result.user, existingProfile));

    return {
      status: 'existing-user',
      storedRole: role,
      redirectTo: existingProfile.isProfileComplete ? getRoleDashboard(role) : '/auth/complete-profile',
      profile: existingProfile
    };
  };

  const refreshProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setProfile(null);
      return null;
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      setProfile(null);
      return null;
    }

    const nextProfile = normalizeProfileData(currentUser, userDoc.data() as UserProfile);
    setProfile(nextProfile);
    return nextProfile;
  };

  const updateProfileRole = async (role: string) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { role }, { merge: true });
    setProfile(prev => prev ? { ...prev, role } : null);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, refreshProfile, signOut, updateProfileRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
