'use client';
import { HeartPulse } from 'lucide-react';
export default function CarePage() {
  return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <HeartPulse className="w-16 h-16 mx-auto text-rose-500 mb-6" />
      <h1 className="text-3xl font-black text-dark-slate mb-3">Care</h1>
      <p className="text-light-slate font-medium">24/7 AI-guided care protocols — coming soon.</p>
    </div>
  );
}
