'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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
    case 'coordinator':
      return '/coordinator';
    case 'hospital':
      return '/hospital';
    case 'doctor':
      return '/doctor';
    default:
      return '/auth';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          setProfile(null);
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
        isProfileComplete: false
      };

      await setDoc(userDocRef, {
        ...newProfile,
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

    setProfile(existingProfile);

    return {
      status: 'existing-user',
      storedRole: role,
      redirectTo: existingProfile.isProfileComplete ? getRoleDashboard(role) : '/auth/complete-profile',
      profile: existingProfile
    };
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
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut, updateProfileRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
