import React, { useState } from 'react';
import { UserCheck, Shield, Sparkles, X, Wallet, Phone, Globe, HeartHandshake } from 'lucide-react';

export default function OnboardingModal({ isOpen, onClose, onAccountCreated, currentAccount }) {
  const [name, setName] = useState(currentAccount?.name || 'Ayush');
  const [balance, setBalance] = useState(currentAccount?.balance ? String(currentAccount.balance) : '50000');
  const [phone, setPhone] = useState(currentAccount?.phone || '+91 98765 43210');
  const [language, setLanguage] = useState('en');
  const [elderMode, setElderMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a valid name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/assistant/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          balance: parseFloat(balance) || 50000,
          phone: phone.trim(),
          language,
          elderMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize account in database.');
      }

      onAccountCreated({
        user: data.user,
        account: data.account,
      });
      onClose();
    } catch (err) {
      console.error('Onboarding failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-500/15 blur-3xl pointer-events-none"></div>

        {/* Close Button if already has an account */}
        {currentAccount && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <UserCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>{currentAccount ? 'Account Profile' : 'Connect Your Account'}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Supabase Live
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Your real account connected directly to your PostgreSQL database.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <span>Full Name</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ayush Jha"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                <span>Account Balance (₹)</span>
              </label>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="50000"
                min="0"
                step="100"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-indigo-400" />
                <span>Phone / UPI Linked</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-sky-400" />
                <span>Language</span>
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="en">English (India)</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <HeartHandshake className="h-3.5 w-3.5 text-amber-400" />
                <span>Accessibility</span>
              </label>
              <button
                type="button"
                onClick={() => setElderMode(!elderMode)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  elderMode
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span>Elder Scam Shield</span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${elderMode ? 'bg-amber-500 text-slate-950 font-extrabold' : 'bg-slate-800 text-slate-400'}`}>
                  {elderMode ? 'ACTIVE' : 'OFF'}
                </span>
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin text-slate-950" />
                  <span>Connecting to Supabase...</span>
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 text-slate-950" />
                  <span>Save & Connect Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
