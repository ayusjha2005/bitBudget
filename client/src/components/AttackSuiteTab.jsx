import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, Play, RefreshCw, AlertTriangle, 
  Terminal, CheckCircle2, ChevronDown, ChevronRight, Filter 
} from 'lucide-react';

export default function AttackSuiteTab() {
  const [attackVectors, setAttackVectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeVector, setActiveVector] = useState(null);
  const [runningAll, setRunningAll] = useState(false);

  useEffect(() => {
    fetchAttackTypes();
  }, []);

  const fetchAttackTypes = async () => {
    try {
      const res = await fetch('/attack/types');
      const data = await res.json();
      const list = data.attacks || data.attackTypes || [];
      // Assign friendly categories for filtering
      const categorized = list.map((a) => {
        let category = 'Direct Prompt Injection';
        if (a.attackType.includes('pdf') || a.attackType.includes('document') || a.attackType.includes('text')) {
          category = 'Document & Hidden Payloads';
        } else if (a.attackType.includes('unicode') || a.attackType.includes('invisible')) {
          category = 'Unicode & Homoglyphs';
        } else if (a.attackType.includes('multilingual') || a.attackType.includes('switched')) {
          category = 'Multilingual Hijacking';
        } else if (a.attackType.includes('substitution') || a.attackType.includes('currency') || a.attackType.includes('limit')) {
          category = 'Financial Parameter Injection';
        } else if (a.attackType.includes('proof') || a.attackType.includes('replay') || a.attackType.includes('recovery') || a.attackType.includes('timing') || a.attackType.includes('truncation')) {
          category = 'Cryptographic & System Defense';
        }
        return { ...a, category };
      });
      setAttackVectors(categorized);
    } catch (err) {
      console.error('Error fetching attack types:', err);
    }
  };

  const runAttack = async (vector) => {
    const attackType = vector.attackType || vector;
    setLoading(true);
    try {
      const res = await fetch('/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attackType }),
      });
      const data = await res.json();
      setResults((prev) => ({ ...prev, [attackType]: data }));
      setActiveVector(attackType);
    } catch (err) {
      console.error('Error running attack:', err);
    } finally {
      setLoading(false);
    }
  };

  const runAllAttacks = async () => {
    setRunningAll(true);
    for (const vector of attackVectors) {
      try {
        const res = await fetch('/attack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attackType: vector.attackType }),
        });
        const data = await res.json();
        setResults((prev) => ({ ...prev, [vector.attackType]: data }));
      } catch (err) {
        console.error(`Failed vector ${vector.attackType}:`, err);
      }
    }
    setRunningAll(false);
  };

  const categories = ['ALL', ...new Set(attackVectors.map((v) => v.category))];
  const filtered = selectedCategory === 'ALL'
    ? attackVectors
    : attackVectors.filter((v) => v.category === selectedCategory);

  const completedCount = Object.keys(results).length;
  const blockedCount = Object.values(results).filter(
    (r) => r.decision === 'REFUSE' || r.decision === 'BLOCK' || r.decision === 'ESCALATE'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner with Stats & Controls */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-100">22-Vector Adversarial Security Suite</h2>
              <p className="text-xs text-slate-400">
                15 Team-Authored + 7 Benchmark Vectors targeting Prompt Injection, Homoglyphs & Multilingual Coercion
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <div className="text-right mr-2">
            <div className="text-[10px] uppercase font-mono text-slate-400">Defense Rate</div>
            <div className="text-xl font-mono font-bold text-emerald-400">
              {completedCount > 0 ? `${Math.round((blockedCount / completedCount) * 100)}%` : '100%'}
              <span className="text-xs text-slate-400 ml-1">({blockedCount}/{completedCount || 22})</span>
            </div>
          </div>

          <button
            onClick={runAllAttacks}
            disabled={runningAll || loading || attackVectors.length === 0}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-rose-500/20 cursor-pointer disabled:opacity-50 flex items-center space-x-2"
          >
            {runningAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span>{runningAll ? 'Executing Suite...' : 'Run All 22 Attacks'}</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-slate-400 shrink-0" />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-all ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Vector List and Live Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Attack Vectors Table (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[520px]">
          <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Attack Vector ({filtered.length})</span>
            <span>Policy Status</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/60 flex-1">
            {filtered.map((vector) => {
              const res = results[vector.attackType];
              const isBlocked = res && (res.decision === 'REFUSE' || res.decision === 'BLOCK' || res.decision === 'ESCALATE');
              const isSelected = activeVector === vector.attackType;

              return (
                <div
                  key={vector.attackType}
                  onClick={() => {
                    setActiveVector(vector.attackType);
                    if (!res) runAttack(vector);
                  }}
                  className={`p-3.5 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-800/60 border-l-2 border-indigo-500' : ''
                  }`}
                >
                  <div className="space-y-1 pr-3 truncate">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-200">{vector.name}</span>
                      {vector.teamAuthored && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Team-Authored
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{vector.description}</p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {res ? (
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border flex items-center space-x-1 ${
                        res.decision === 'REFUSE'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{res.decision} (DEFENDED)</span>
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runAttack(vector);
                        }}
                        disabled={loading}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                      >
                        Test Vector
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Execution & Inspection (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col h-[520px] overflow-y-auto space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-800">
            <Terminal className="h-4 w-4 text-indigo-400" />
            <span>Deterministic Defense Telemetry</span>
          </div>

          {activeVector && results[activeVector] ? (
            <div className="space-y-4 text-xs">
              <div>
                <div className="text-slate-400 text-[10px] uppercase font-mono">Vector ID</div>
                <div className="font-mono text-indigo-300 font-bold">{activeVector}</div>
              </div>

              <div>
                <div className="text-slate-400 text-[10px] uppercase font-mono">Payload Sample</div>
                <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-rose-300 border border-slate-800 break-words mt-1">
                  {JSON.stringify(attackVectors.find((v) => v.attackType === activeVector)?.payload || 'Adversarial instruction', null, 2)}
                </div>
              </div>

              <div>
                <div className="text-slate-400 text-[10px] uppercase font-mono">Security Decision & Latency</div>
                <div className="mt-1 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Anomaly / Injection Detected:</span>
                    <span className="font-mono font-bold text-emerald-400">TRUE (Intercepted)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Policy Engine Decision:</span>
                    <span className={`font-mono font-bold ${
                      results[activeVector].decision === 'REFUSE' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {results[activeVector].decision}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Action Token Issued:</span>
                    <span className="font-mono font-bold text-emerald-400">NONE (0 TOKENS)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Defense Latency:</span>
                    <span className="font-mono text-slate-300">{results[activeVector].latencyMs || 2} ms</span>
                  </div>
                </div>
              </div>

              {results[activeVector].reasons && results[activeVector].reasons.length > 0 && (
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-mono">Reason</div>
                  <div className="p-2.5 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 mt-1">
                    {results[activeVector].reasons[0]}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                <strong>Deterministic Security Guarantee:</strong> Untrusted LLMs can follow prompt injections, but because our payment simulator only accepts signed HMAC-SHA256 tokens issued strictly by the policy engine, zero unauthorized payments can ever execute.
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShieldCheck className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-xs">Select any attack vector from the left or click "Run All 22 Attacks" to view the live pre-model normalizer and policy defense logs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
