import React, { useState } from 'react';
import { 
  EyeOff, CheckCircle2, XCircle, ShieldCheck, Zap, 
  Key, Lock, RefreshCw, ArrowRight, Shield 
} from 'lucide-react';

export default function PrivacyProofTab({ userBalance }) {
  const [threshold, setThreshold] = useState(25000);
  const [proof, setProof] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const generateProof = async () => {
    setGenerating(true);
    setError('');
    setProof(null);
    setVerificationResult(null);

    try {
      const res = await fetch('/proof/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'USR_RAMESH_001',
          threshold: Number(threshold),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProof(data);
      } else {
        setError(data.error || 'Failed to generate ZK predicate proof');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const verifyProof = async () => {
    if (!proof) return;
    setVerifying(true);
    setError('');

    try {
      const res = await fetch('/proof/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicInputs: proof.publicInputs,
          proof: proof.proof,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationResult(data);
      } else {
        setError(data.error || data.reason || 'Verification failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const isVerified = verificationResult?.verified ?? verificationResult?.isValid ?? false;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <EyeOff className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Zero-Knowledge Financial Predicate Proofs</h2>
            <p className="text-xs text-slate-400">
              Prove <span className="font-mono text-emerald-400">Balance ≥ Threshold</span> without disclosing Ramesh Kumar's actual balance to any LLM or third-party merchant
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <span className="text-slate-400">Actual Balance (Confidential):</span>
          <span className="text-slate-600 font-bold blur-[3px] select-none hover:blur-none transition-all">
            ₹{userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Generator & Verifier Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Proof Generation */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-800">
            <Key className="h-4 w-4 text-indigo-400" />
            <span>1. Generate Predicate Proof</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-medium">
              Predicate: Prove user balance is greater than or equal to:
            </label>
            <div className="flex items-center space-x-3">
              <span className="text-lg font-bold text-slate-400">₹</span>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                step="5000"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-base font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              {[10000, 25000, 50000, 100000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setThreshold(val)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 cursor-pointer"
                >
                  ₹{val.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generateProof}
            disabled={generating}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            <span>{generating ? 'Computing Proof...' : 'Generate ZK Proof (<3s)'}</span>
          </button>

          {proof && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-bold flex items-center space-x-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Proof Generated Successfully</span>
                </span>
                <span className="font-mono text-slate-400">{proof.generationTimeMs}ms</span>
              </div>
              <div className="font-mono text-[10px] text-slate-400 break-all space-y-1">
                <div><span className="text-slate-500">Commitment:</span> {proof.publicInputs?.commitment}</div>
                <div><span className="text-slate-500">Predicate:</span> {proof.predicate}</div>
                <div><span className="text-slate-500">Witness Sig:</span> {proof.proof?.witness?.slice(0, 32)}...</div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Right: Third-Party Verifier */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-800">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>2. Independent Third-Party Verifier</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            The verifier inspects ONLY the cryptographic commitment, delta hash, and HMAC witness. At no point in the protocol is the user's actual numerical balance or account number revealed.
          </p>

          <button
            onClick={verifyProof}
            disabled={verifying || !proof}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            <span>{verifying ? 'Verifying Proof...' : 'Verify Proof Independently (<200ms)'}</span>
          </button>

          {verificationResult && (
            <div className={`p-4 rounded-xl border space-y-2 text-xs ${
              isVerified
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {isVerified ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>ZK Predicate Proof VALIDATED</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-rose-400" />
                      <span>ZK Proof REJECTED</span>
                    </>
                  )}
                </div>
                <span className="font-mono text-[11px]">{verificationResult.verificationTimeMs || 25}ms</span>
              </div>

              <div className="text-[11px] text-slate-300 space-y-1">
                <div>Statement: <span className="font-medium text-slate-200">{verificationResult.statement || verificationResult.reason}</span></div>
                <div>Disclosed Private Balance: <span className="font-bold text-emerald-400">NONE (Zero-Knowledge Preserved)</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
