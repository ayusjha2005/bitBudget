import React, { useState } from 'react';
import { 
  Users, Smartphone, KeyRound, CheckCircle2, ShieldCheck, 
  RotateCcw, ArrowRight, Lock, AlertCircle 
} from 'lucide-react';

export default function RecoveryTab() {
  const [recoveryId, setRecoveryId] = useState(null);
  const [activeFactors, setActiveFactors] = useState([]);
  const [sessionTokens, setSessionTokens] = useState({});
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState('');

  const startRecovery = async () => {
    setLoading(true);
    setMessage('');
    setCompleted(false);
    setActiveFactors([]);

    try {
      const res = await fetch('/recovery/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'USR_RAMESH_001' }),
      });
      const data = await res.json();
      if (res.ok && data.recoveryId) {
        setRecoveryId(data.recoveryId);
        setSessionTokens({
          FACTOR_A: data.simulatedFactorAOtp,
          FACTOR_B: data.simulatedFactorBToken,
          FACTOR_C: 'REC-KEY-RAMESH-8492-7491-0192',
        });
        setMessage('Recovery session started. Submit any 2 of the 3 independent factors to satisfy the 2-of-3 quorum.');
      } else {
        setMessage(data.error || 'Failed to start recovery.');
      }
    } catch (err) {
      setMessage(`Failed to start recovery: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitFactor = async (factorType) => {
    if (!recoveryId) {
      setMessage('Please click "Initiate Recovery Test" first.');
      return;
    }

    setLoading(true);
    try {
      const factorValue = sessionTokens[factorType] || 'REC-KEY-RAMESH-8492-7491-0192';
      const res = await fetch('/recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recoveryId,
          factorType,
          factorValue,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updated = [...new Set([...activeFactors, factorType])];
        setActiveFactors(updated);
        setMessage(data.message);
        if (data.completed || data.thresholdMet || updated.length >= 2) {
          setCompleted(true);
        }
      } else {
        setMessage(data.error || 'Factor verification failed.');
      }
    } catch (err) {
      setMessage(`Factor submission failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">2-of-3 Multi-Factor Account Recovery</h2>
            <p className="text-xs text-slate-400">
              Recover access securely if a device is lost or compromised — without relying on centralized reset backdoors
            </p>
          </div>
        </div>

        <button
          onClick={startRecovery}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
        >
          <RotateCcw className="h-4 w-4" />
          <span>{recoveryId ? 'Restart Recovery Session' : 'Initiate Recovery Test'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* 3 Factors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Factor A */}
        <div className={`p-5 rounded-2xl border transition-all ${
          activeFactors.includes('FACTOR_A')
            ? 'bg-emerald-500/10 border-emerald-500/40 glow-emerald'
            : 'bg-slate-900/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
              <Smartphone className="h-5 w-5 text-indigo-400" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">FACTOR A</span>
          </div>

          <h3 className="font-bold text-sm text-slate-100">Registered SMS OTP</h3>
          <p className="text-xs text-slate-400 mt-1">Mobile: +91 98765 43210</p>
          {sessionTokens.FACTOR_A && (
            <p className="text-[10px] font-mono text-emerald-400 mt-1">
              Active Code: {sessionTokens.FACTOR_A}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-slate-800/80">
            {activeFactors.includes('FACTOR_A') ? (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Verified ({activeFactors.length} of 2 Factors)</span>
              </div>
            ) : (
              <button
                onClick={() => submitFactor('FACTOR_A')}
                disabled={!recoveryId || loading}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-50"
              >
                Submit Factor A (SMS OTP)
              </button>
            )}
          </div>
        </div>

        {/* Factor B */}
        <div className={`p-5 rounded-2xl border transition-all ${
          activeFactors.includes('FACTOR_B')
            ? 'bg-emerald-500/10 border-emerald-500/40 glow-emerald'
            : 'bg-slate-900/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">FACTOR B</span>
          </div>

          <h3 className="font-bold text-sm text-slate-100">Trusted Contact Verification</h3>
          <p className="text-xs text-slate-400 mt-1">Suresh Kumar (Brother, +91 98765 43211)</p>
          {sessionTokens.FACTOR_B && (
            <p className="text-[10px] font-mono text-emerald-400 mt-1 truncate">
              Token: {sessionTokens.FACTOR_B.slice(0, 18)}...
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-slate-800/80">
            {activeFactors.includes('FACTOR_B') ? (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Verified ({activeFactors.length} of 2 Factors)</span>
              </div>
            ) : (
              <button
                onClick={() => submitFactor('FACTOR_B')}
                disabled={!recoveryId || loading}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-50"
              >
                Submit Factor B (Suresh Approval)
              </button>
            )}
          </div>
        </div>

        {/* Factor C */}
        <div className={`p-5 rounded-2xl border transition-all ${
          activeFactors.includes('FACTOR_C')
            ? 'bg-emerald-500/10 border-emerald-500/40 glow-emerald'
            : 'bg-slate-900/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
              <KeyRound className="h-5 w-5 text-amber-400" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">FACTOR C</span>
          </div>

          <h3 className="font-bold text-sm text-slate-100">Emergency Recovery Key</h3>
          <p className="text-xs text-slate-400 mt-1 font-mono truncate">REC-KEY-RAMESH-8492-7491-0192</p>

          <div className="mt-4 pt-4 border-t border-slate-800/80">
            {activeFactors.includes('FACTOR_C') ? (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Verified ({activeFactors.length} of 2 Factors)</span>
              </div>
            ) : (
              <button
                onClick={() => submitFactor('FACTOR_C')}
                disabled={!recoveryId || loading}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-50"
              >
                Submit Factor C (Emergency Key)
              </button>
            )}
          </div>
        </div>
      </div>

      {completed && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-sm">2-of-3 Quorum Threshold Satisfied: Account Access Restored!</div>
              <div className="text-xs opacity-90">All active session locks cleared. New device access token generated securely.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
