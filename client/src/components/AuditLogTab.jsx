import React, { useState, useEffect } from 'react';
import { 
  History, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert, 
  RefreshCw, Link, Lock, ArrowDown, Database, Bug 
} from 'lucide-react';

export default function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tampering, setTampering] = useState(false);

  useEffect(() => {
    fetchLogs();
    verifyChain();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/audit');
      const data = await res.json();
      const list = data.events || data.auditLogs || [];
      setLogs(list);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    try {
      const res = await fetch('/audit/verify');
      const data = await res.json();
      setVerification(data);
    } catch (err) {
      console.error('Error verifying audit chain:', err);
    }
  };

  const simulateTamper = async () => {
    setTampering(true);
    try {
      const res = await fetch('/audit/tamper-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      // Refetch and verify immediately to demonstrate tamper detection
      await fetchLogs();
      await verifyChain();
    } catch (err) {
      console.error('Error tampering chain:', err);
    } finally {
      setTampering(false);
    }
  };

  const isValid = verification?.valid ?? verification?.isValid ?? true;
  const chainCount = verification?.chainLength ?? verification?.verifiedBlocks ?? logs.length;
  const brokenIndex = verification?.brokenAtIndex ?? verification?.brokenLink?.blockNumber;

  return (
    <div className="space-y-6">
      {/* Top Banner with Integrity Status */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">SHA-256 Tamper-Evident Audit Chain</h2>
            <p className="text-xs text-slate-400">
              Cryptographic hash chain where current_hash = SHA256(previous_hash + canonical_event_data)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          {verification && (
            <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold ${
              isValid
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
            }`}>
              {isValid ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>CHAIN INTEGRITY: VERIFIED ({chainCount} Blocks)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span>TAMPER DETECTED at Block #{brokenIndex !== undefined ? brokenIndex : 1}</span>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => {
              fetchLogs();
              verifyChain();
            }}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            title="Re-verify Chain"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={simulateTamper}
            disabled={tampering}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
            title="Modifies historical database block data to prove SHA-256 integrity detection"
          >
            <Bug className="h-4 w-4" />
            <span>Simulate DB Tampering</span>
          </button>
        </div>
      </div>

      {/* Block Sequence Visualizer */}
      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No audit logs recorded yet.</div>
        ) : (
          logs.map((block, idx) => {
            const isGenesis = idx === 0 || block.eventId === 'AUDIT_GENESIS_000';
            const isBroken = !isValid && brokenIndex === idx;

            const prevHash = block.previousHash || block.previous_hash || '0'.repeat(64);
            const curHash = block.currentHash || block.current_hash || '0'.repeat(64);
            const eventType = block.eventType || block.event_type || 'SYSTEM_EVENT';
            const eventPayload = block.eventData || block.event_data || {};
            const timestamp = block.timestamp ? new Date(block.timestamp).toLocaleString() : 'Recent';

            return (
              <div key={block.id || idx} className="relative">
                <div className={`p-4 rounded-xl border transition-all ${
                  isBroken
                    ? 'border-rose-500 bg-rose-500/10 glow-rose'
                    : 'border-slate-800 bg-slate-900/60'
                }`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3 mb-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-400">
                        Block #{idx}
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        {eventType}
                      </span>
                      {isGenesis && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          GENESIS BLOCK
                        </span>
                      )}
                      {isBroken && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          FORGED / CORRUPTED
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {timestamp}
                    </span>
                  </div>

                  {/* Hash Chain Links */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                        <Link className="h-2.5 w-2.5" />
                        <span>Previous Hash</span>
                      </div>
                      <div className="text-slate-400 truncate mt-0.5">{prevHash}</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
                      <div className="text-[9px] uppercase tracking-wider text-emerald-500/80 flex items-center space-x-1">
                        <Lock className="h-2.5 w-2.5" />
                        <span>Current SHA-256 Hash</span>
                      </div>
                      <div className="text-emerald-400 truncate mt-0.5 font-semibold">{curHash}</div>
                    </div>
                  </div>

                  {/* Event Payload */}
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/50 text-[11px] font-mono text-slate-300">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider block mb-1">Payload Content</span>
                    <pre className="overflow-x-auto whitespace-pre-wrap">
                      {typeof eventPayload === 'object' ? JSON.stringify(eventPayload, null, 2) : eventPayload}
                    </pre>
                  </div>
                </div>

                {/* Connection Arrow between blocks */}
                {idx < logs.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="h-4 w-4 text-slate-600" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
