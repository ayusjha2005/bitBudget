import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, AlertCircle, Shield, ArrowRight, 
  Lock, Key, FileText, Check, Copy, ExternalLink, HelpCircle
} from 'lucide-react';

export default function ActionCard({ 
  actionData, 
  onConfirmPayment, 
  onTrigger2FA,
  executing, 
  paymentSuccess, 
  elderMode 
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  if (!actionData) return null;

  const {
    intent,
    amount,
    currency = 'INR',
    recipient,
    decision,
    reason,
    riskScore,
    actionToken,
    requires2FA,
    checks = {},
    groundedIn,
    elderAdvice,
    modelRoute,
  } = actionData;

  const isAllow = decision === 'ALLOW';
  const isRefuse = decision === 'REFUSE';
  const isEscalate = decision === 'ESCALATE';

  const copyToken = () => {
    if (actionToken) {
      navigator.clipboard.writeText(actionToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className={`rounded-2xl border transition-all ${
      isAllow 
        ? 'border-emerald-500/40 bg-slate-900/90 glow-emerald' 
        : isRefuse 
        ? 'border-rose-500/40 bg-slate-900/90 glow-rose' 
        : 'border-amber-500/40 bg-slate-900/90 glow-amber'
    }`}>
      {/* Top Banner with Decision */}
      <div className={`px-6 py-4 rounded-t-2xl border-b flex items-center justify-between ${
        isAllow 
          ? 'bg-emerald-500/10 border-emerald-500/20' 
          : isRefuse 
          ? 'bg-rose-500/10 border-rose-500/20' 
          : 'bg-amber-500/10 border-amber-500/20'
      }`}>
        <div className="flex items-center space-x-3">
          {isAllow && <CheckCircle2 className="h-6 w-6 text-emerald-400" />}
          {isRefuse && <XCircle className="h-6 w-6 text-rose-400" />}
          {isEscalate && <AlertCircle className="h-6 w-6 text-amber-400" />}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
                Security Policy Engine
              </span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                isAllow 
                  ? 'bg-emerald-400/20 text-emerald-300' 
                  : isRefuse 
                  ? 'bg-rose-400/20 text-rose-300' 
                  : 'bg-amber-400/20 text-amber-300'
              }`}>
                {decision}
              </span>
            </div>
            <div className={`text-base font-bold ${
              isAllow ? 'text-emerald-300' : isRefuse ? 'text-rose-300' : 'text-amber-300'
            }`}>
              {isAllow && 'Safe to Proceed — Cryptographic Action Token Issued'}
              {isRefuse && 'Transaction Blocked by Deterministic Policy'}
              {isEscalate && 'Escalation Required — High-Risk or High-Value Check'}
            </div>
          </div>
        </div>

        {/* Risk Score */}
        <div className="text-right">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Risk Score</div>
          <div className={`text-xl font-mono font-black ${
            riskScore < 30 ? 'text-emerald-400' : riskScore < 60 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {riskScore !== undefined ? `${riskScore}/100` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Elder Mode Advice Box if present */}
      {elderMode && elderAdvice && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-amber-300">Elder Protection Advisory</div>
              <p className="text-xs leading-relaxed mt-1">{elderAdvice}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Details */}
      <div className="p-6 space-y-6">
        {/* Transaction Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Amount */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-xs text-slate-400 mb-1">Payment Amount</div>
            <div className="text-2xl font-mono font-extrabold text-white">
              ₹{Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-1">
              <span>Grounding:</span>
              <span className={`font-semibold ${
                groundedIn?.includes('invoice') || groundedIn?.includes('bill') 
                  ? 'text-emerald-400' 
                  : 'text-amber-400'
              }`}>
                {groundedIn || 'User Prompt'}
              </span>
            </div>
          </div>

          {/* Recipient */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 md:col-span-2">
            <div className="text-xs text-slate-400 mb-1">Recipient Destination</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-slate-100">
                  {recipient?.name || 'Unknown Recipient'}
                </div>
                <div className="font-mono text-xs text-indigo-400">
                  {recipient?.upiId || recipient?.accountNumber || 'No ID specified'}
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                recipient?.isWhitelisted || checks?.recipientWhitelisted
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {recipient?.isWhitelisted || checks?.recipientWhitelisted ? 'Verified Whitelist' : 'Untrusted Recipient'}
              </span>
            </div>
          </div>
        </div>

        {/* Reason / Explanation */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
            <span>Policy Assessment</span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">
            {reason || 'Transaction reviewed against security rules and recipient limits.'}
          </p>
        </div>

        {/* Security Rule Breakdown */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Deterministic Security Checks
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/70 text-xs">
              <div className="text-slate-400 text-[10px]">Prompt Injection</div>
              <div className="font-semibold flex items-center space-x-1 mt-0.5">
                {checks.injectionDetected ? (
                  <span className="text-rose-400">Detected (Blocked)</span>
                ) : (
                  <span className="text-emerald-400">Clean (0 Injections)</span>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/70 text-xs">
              <div className="text-slate-400 text-[10px]">Recipient Whitelist</div>
              <div className="font-semibold flex items-center space-x-1 mt-0.5">
                {checks.recipientWhitelisted ? (
                  <span className="text-emerald-400">Verified</span>
                ) : (
                  <span className="text-rose-400">Not Whitelisted</span>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/70 text-xs">
              <div className="text-slate-400 text-[10px]">Daily & Tx Limits</div>
              <div className="font-semibold flex items-center space-x-1 mt-0.5">
                {checks.withinDailyLimit !== false && checks.withinTxLimit !== false ? (
                  <span className="text-emerald-400">Within Limits</span>
                ) : (
                  <span className="text-rose-400">Exceeds Limits</span>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/70 text-xs">
              <div className="text-slate-400 text-[10px]">Source Grounding</div>
              <div className="font-semibold flex items-center space-x-1 mt-0.5">
                {checks.groundingVerified !== false ? (
                  <span className="text-emerald-400">100% Grounded</span>
                ) : (
                  <span className="text-amber-400">Ungrounded</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cryptographic Action Token (if issued) */}
        {actionToken && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 text-xs font-mono text-emerald-400">
                <Lock className="h-3.5 w-3.5" />
                <span className="font-semibold">Deterministic Action Token (HMAC-SHA256 Signed)</span>
              </div>
              <button
                onClick={copyToken}
                className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {copiedToken ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedToken ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-2 rounded bg-slate-900/90 font-mono text-[11px] text-slate-400 break-all select-all border border-slate-800/80">
              {actionToken}
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">
              Strict 5-minute validity window. Isolated payment executor rejects any transaction without this exact cryptographic signature.
            </div>
          </div>
        )}

        {/* Execution Success Receipt */}
        {paymentSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <div className="flex items-center space-x-2 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Payment Successfully Executed by Isolated Simulator!</span>
            </div>
            <div className="mt-2 text-xs space-y-1 font-mono text-slate-300">
              <div>Transaction ID: <span className="text-emerald-400">{paymentSuccess.transactionId}</span></div>
              <div>Timestamp: <span className="text-slate-400">{new Date(paymentSuccess.timestamp).toLocaleString()}</span></div>
              <div>Remaining Account Balance: <span className="text-white font-bold">₹{Number(paymentSuccess.newBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div>Audit Block: <span className="text-indigo-400">Recorded to SHA-256 Hash Chain</span></div>
            </div>
          </div>
        )}

        {/* Action Button Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center space-x-2">
            <span>Model Engine:</span>
            <span className="font-mono text-slate-300 px-2 py-0.5 rounded bg-slate-800">
              {modelRoute || 'gemini-1.5-flash'}
            </span>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {isAllow && !paymentSuccess && (
              <button
                onClick={onConfirmPayment}
                disabled={executing}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <span>{executing ? 'Executing isolated transaction...' : 'Confirm & Execute Payment'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {isEscalate && !paymentSuccess && (
              <button
                onClick={onTrigger2FA}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition-all shadow-lg shadow-amber-500/25 cursor-pointer flex items-center justify-center space-x-2"
              >
                <Key className="h-4 w-4" />
                <span>Verify 2FA to Authorize (OTP)</span>
              </button>
            )}

            {isRefuse && (
              <div className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                🛡️ Payment Refused — Money is 100% Safe in Account
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
