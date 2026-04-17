'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full max-w-7xl px-6 pt-32 pb-24 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-block mb-4 px-4 py-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-500 font-medium text-sm">
            Bridging the gap in rare diseases
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
            Turn your <span className="text-gradient">scattered reality</span>
            <br /> into actionable care.
          </h1>
          <p className="max-w-2xl mx-auto text-slate-300 text-lg mb-10 leading-relaxed">
            An AI-powered health intelligence platform that turns a family's medical reality
            into a structured, actionable clinical identity. Connect with support you didn't know existed.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth" 
              className="px-8 py-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold transition-colors shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2"
            >
              Start Your Journey
            </Link>
          </div>
        </motion.div>
      </section>

      {/* The 3 Failures */}
      <section className="w-full max-w-7xl px-6 py-24 border-t border-slate-800">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">The systemic failures we are solving</h2>
          <p className="text-slate-400">Rare diseases are problems of uncertainty, invisibility, and survival.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Diagnostic Failure",
              desc: "Conditions are frequently misdiagnosed for years. Symptoms overlap, specialists are scarce.",
              icon: "🔍"
            },
            {
              title: "Access Failure",
              desc: "Ecosystems of support exist, but they are fragmented, hidden, and entirely undiscoverable.",
              icon: "🚧"
            },
            {
              title: "Care Failure",
              desc: "Day-to-day caregiving involves constant, high-stakes decisions made with no guidance.",
              icon: "❤️‍🩹"
            }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="glass p-8 rounded-2xl flex flex-col gap-4"
            >
              <div className="text-4xl">{item.icon}</div>
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}
