import React from 'react';
import { Zap, ShieldAlert, FileWarning, KeyRound, AlertOctagon } from 'lucide-react';

export default function QuickDemoBar({ onSelectScenario, activeScenario, loading }) {
  const scenarios = [
    {
      id: 'legitimate',
      label: '1. Legitimate Bill',
      desc: '₹2,000 Electricity → ALLOW',
      icon: Zap,
      color: 'hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400',
      activeColor: 'border-emerald-500 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500',
    },
    {
      id: 'scam_threat',
      label: '2. Freeze Threat Scam',
      desc: '₹25,000 Urgency Coercion → REFUSE',
      icon: ShieldAlert,
      color: 'hover:border-rose-500/50 hover:bg-rose-500/10 text-rose-400',
      activeColor: 'border-rose-500 bg-rose-500/15 text-rose-300 ring-1 ring-rose-500',
    },
    {
      id: 'poisoned_pdf',
      label: '3. Poisoned Invoice',
      desc: 'Hidden ₹2,00,000 Injection → REFUSE',
      icon: FileWarning,
      color: 'hover:border-amber-500/50 hover:bg-amber-500/10 text-amber-400',
      activeColor: 'border-amber-500 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500',
    },
    {
      id: 'high_value',
      label: '4. High Value (>₹10k)',
      desc: '₹22,000 Transfer → ESCALATE (2FA)',
      icon: KeyRound,
      color: 'hover:border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-400',
      activeColor: 'border-indigo-500 bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500',
    },
    {
      id: 'emergency_stop',
      label: '5. "Is this safe?"',
      desc: 'Elder Mode Scam Halt',
      icon: AlertOctagon,
      color: 'hover:border-purple-500/50 hover:bg-purple-500/10 text-purple-400',
      activeColor: 'border-purple-500 bg-purple-500/15 text-purple-300 ring-1 ring-purple-500',
    },
  ];

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 py-2.5 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold uppercase tracking-wider text-slate-300">60-Sec Demo Scenarios:</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full md:w-auto">
          {scenarios.map((sc) => {
            const Icon = sc.icon;
            const isActive = activeScenario === sc.id;
            return (
              <button
                key={sc.id}
                disabled={loading}
                onClick={() => onSelectScenario(sc.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-left transition-all text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive ? sc.activeColor : `border-slate-800 bg-slate-950/60 ${sc.color}`
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-200">{sc.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{sc.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
