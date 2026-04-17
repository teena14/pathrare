'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-surface-50 text-dark-slate">
      {/* Hero Section */}
      <section className="w-full max-w-7xl px-6 pt-32 pb-24 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-block mb-6 px-5 py-2 rounded-[2rem] border-2 border-primary-blue/20 bg-primary-blue/5 text-primary-blue font-bold text-sm shadow-sm">
            Bridging the gap in rare diseases
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 text-dark-slate leading-[1.1]">
            Turn your <span className="text-gradient">scattered reality</span>
            <br /> into actionable care.
          </h1>
          <p className="max-w-2xl mx-auto text-light-slate text-xl font-medium mb-12 leading-relaxed">
            An AI-powered health intelligence platform that turns a family's medical reality
            into a structured, actionable clinical identity. Connect with support you didn't know existed.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth" 
              className="px-10 py-5 rounded-full bg-primary-blue hover:bg-blue-700 text-white font-bold text-lg transition-all shadow-[0_8px_30px_rgba(15,93,227,0.3)] hover:shadow-[0_10px_40px_rgba(15,93,227,0.4)] hover:-translate-y-1"
            >
              Start Your Journey
            </Link>
          </div>
        </motion.div>
      </section>

      {/* The 3 Failures */}
      <section className="w-full max-w-7xl px-6 py-24 border-t border-surface-200">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-dark-slate">The systemic failures we solve</h2>
          <p className="text-light-slate text-xl font-medium">Rare diseases are problems of uncertainty, invisibility, and survival.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Diagnostic Failure",
              desc: "Conditions are frequently misdiagnosed for years. Symptoms overlap, specialists are scarce.",
              icon: "🔍",
              color: "text-primary-blue border-primary-blue"
            },
            {
              title: "Access Failure",
              desc: "Ecosystems of support exist, but they are fragmented, hidden, and entirely undiscoverable.",
              icon: "🚧",
              color: "text-pacific-blue border-pacific-blue"
            },
            {
              title: "Care Failure",
              desc: "Day-to-day caregiving involves constant, high-stakes decisions made with no guidance.",
              icon: "❤️‍🩹",
              color: "text-medium-purple border-medium-purple"
            }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="glass bg-white p-10 rounded-[2.5rem] flex flex-col gap-5 shadow-xl border border-surface-200 hover:-translate-y-2 transition-transform duration-300"
            >
              <div className="text-5xl mb-2">{item.icon}</div>
              <h3 className={`text-2xl font-bold ${item.color.split(' ')[0]}`}>{item.title}</h3>
              <p className="text-light-slate font-medium leading-relaxed text-lg">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}
