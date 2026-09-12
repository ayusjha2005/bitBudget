import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, User, Globe, AlertTriangle, Database } from 'lucide-react';

export default function Header({
  userName,
  language,
  setLanguage,
  elderMode,
  setElderMode,
  userBalance,
  onEmergencyHalt,
  onOpenProfile,
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Tagline */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                SafePay AI
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Supabase Live</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              AI that helps you pay — without trusting AI with your money.
            </p>
          </div>
        </div>

        {/* Status, User & Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* User & Balance Badge (Clickable for profile) */}
          <button
            onClick={onOpenProfile}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs transition-all cursor-pointer group"
            title="Click to view or edit Supabase profile"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <User className="h-3.5 w-3.5 text-indigo-400 group-hover:text-indigo-300" />
            <span className="text-slate-200 font-semibold truncate max-w-[120px]">
              {userName || 'Setup Account'}
            </span>
            <span className="text-slate-700">|</span>
            <span className="font-mono font-extrabold text-emerald-400">
              ₹{Number(userBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </button>

          {/* Language Selector */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-slate-200 border-none outline-none text-xs font-medium cursor-pointer"
            >
              <option value="en" className="bg-slate-900 text-slate-200">English</option>
              <option value="hi" className="bg-slate-900 text-slate-200">हिन्दी (Hindi)</option>
              <option value="ta" className="bg-slate-900 text-slate-200">தமிழ் (Tamil)</option>
            </select>
          </div>

          {/* Elder Mode Toggle */}
          <button
            onClick={() => setElderMode(!elderMode)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              elderMode
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
            title="Simplified language, high contrast, large text, and voice auto-readout"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{elderMode ? 'Elder Shield: ON' : 'Elder Mode'}</span>
          </button>

          {/* Emergency Scam Halt Button */}
          <button
            onClick={onEmergencyHalt}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/40 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
            title="Instantly freezes all outgoing transactions and alerts trusted guardian"
          >
            <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
            <span className="hidden md:inline">Freeze Account</span>
          </button>
        </div>
      </div>
    </header>
  );
}
