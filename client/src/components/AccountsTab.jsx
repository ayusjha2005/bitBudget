import React, { useState, useEffect } from 'react';
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, ShieldCheck, Plus, 
  Building2, Smartphone, Zap, Flame, UserCheck, RefreshCw, CheckCircle2 
} from 'lucide-react';

export default function AccountsTab({
  userName,
  userBalance,
  onRefreshBalance,
  onPayRecipient,
  onOpenProfile,
  elderMode,
}) {
  const [recipients, setRecipients] = useState([]);
  const [depositAmount, setDepositAmount] = useState('5000');
  const [depositing, setDepositing] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(null);
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientAccount, setNewRecipientAccount] = useState('');
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      const res = await fetch('/assistant/recipients');
      const data = await res.json();
      if (data.success && data.recipients) {
        setRecipients(data.recipients);
      }
    } catch (e) {
      console.error('Fetch recipients error:', e);
    }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) return;

    setDepositing(true);
    setDepositSuccess(null);

    try {
      const res = await fetch('/assistant/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (data.success) {
        setDepositSuccess(`Added ₹${amt.toLocaleString('en-IN')} to account.`);
        if (onRefreshBalance) onRefreshBalance();
        setTimeout(() => setDepositSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Deposit error:', err);
    } finally {
      setDepositing(false);
    }
  };

  const handleAddRecipient = async (e) => {
    e.preventDefault();
    if (!newRecipientName || !newRecipientAccount) return;

    setAddingRecipient(true);
    try {
      const res = await fetch('/assistant/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRecipientName.trim(),
          accountNumber: newRecipientAccount.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewRecipientName('');
        setNewRecipientAccount('');
        setShowAddForm(false);
        fetchRecipients();
      }
    } catch (err) {
      console.error('Add recipient error:', err);
    } finally {
      setAddingRecipient(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner: Account Card + Quick Deposit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Bank Card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/20 p-6 sm:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col justify-between h-full min-h-[200px]">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">SafePay AI Primary Account</span>
                <h3 className="text-2xl font-extrabold text-white mt-1">{userName || 'Active Account'}</h3>
                <span className="text-xs text-slate-400 font-mono">SUPABASE POSTGRESQL VERIFIED</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-indigo-400" />
              </div>
            </div>

            <div className="my-6">
              <span className="text-xs font-semibold text-slate-400">Available Balance</span>
              <div className="text-4xl sm:text-5xl font-extrabold text-emerald-400 mt-1 tracking-tight">
                ₹{Number(userBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Deterministic Shield: ACTIVE</span>
              </div>
              <button
                onClick={onOpenProfile}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <span>Edit Profile</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Deposit / Top-up */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 flex flex-col justify-between shadow-xl">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
              <span>Add Balance (Top-up)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Add simulated funds to your live Supabase account.
            </p>

            <form onSubmit={handleDeposit} className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Amount (₹)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    min="100"
                    step="500"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {[1000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(String(amt))}
                    className="flex-1 py-1 px-2 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={depositing}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {depositing ? 'Updating Supabase...' : 'Confirm Deposit'}
              </button>
            </form>

            {depositSuccess && (
              <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center font-medium animate-fadeIn">
                {depositSuccess}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Whitelisted Recipients Section */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <span>Whitelisted Payees Directory</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Registered recipients verified by the deterministic security engine.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Payee</span>
          </button>
        </div>

        {/* Add Payee Drawer Form */}
        {showAddForm && (
          <form onSubmit={handleAddRecipient} className="mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 animate-fadeIn">
            <h4 className="text-xs font-bold text-slate-200">Register New Whitelisted Payee</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newRecipientName}
                onChange={(e) => setNewRecipientName(e.target.value)}
                placeholder="Payee Name (e.g. Tata Power)"
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
              <input
                type="text"
                value={newRecipientAccount}
                onChange={(e) => setNewRecipientAccount(e.target.value)}
                placeholder="Account or UPI Ref (e.g. TATA-PWR-01)"
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 text-xs hover:bg-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingRecipient}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                {addingRecipient ? 'Saving...' : 'Add to Whitelist'}
              </button>
            </div>
          </form>
        )}

        {/* Recipient Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recipients.length === 0 ? (
            <div className="col-span-4 text-center py-8 text-slate-500 text-xs">
              No recipients registered yet. Click "Add Payee" or run onboarding to populate utilities.
            </div>
          ) : (
            recipients.map((rec) => (
              <div
                key={rec.id}
                className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-slate-900 text-indigo-400">
                      {rec.name.toLowerCase().includes('electricity') || rec.name.includes('BESCOM') ? (
                        <Zap className="h-4 w-4 text-amber-400" />
                      ) : rec.name.toLowerCase().includes('gas') ? (
                        <Flame className="h-4 w-4 text-rose-400" />
                      ) : rec.name.toLowerCase().includes('airtel') || rec.name.toLowerCase().includes('mobile') ? (
                        <Smartphone className="h-4 w-4 text-sky-400" />
                      ) : (
                        <Building2 className="h-4 w-4 text-indigo-400" />
                      )}
                    </span>
                    <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>WHITELISTED</span>
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-100">{rec.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                    {rec.account_reference || 'REF-ACTIVE'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onPayRecipient && onPayRecipient(rec.name)}
                  className="mt-4 w-full py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Pay with AI
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
