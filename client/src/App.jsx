import React, { useState } from 'react';
import Header from './components/Header.jsx';
import QuickDemoBar from './components/QuickDemoBar.jsx';
import AssistantTab from './components/AssistantTab.jsx';
import AttackSuiteTab from './components/AttackSuiteTab.jsx';
import AuditLogTab from './components/AuditLogTab.jsx';
import PrivacyProofTab from './components/PrivacyProofTab.jsx';
import RecoveryTab from './components/RecoveryTab.jsx';
import TelemetryTab from './components/TelemetryTab.jsx';
import TwoFactorModal from './components/TwoFactorModal.jsx';
import { 
  Bot, ShieldAlert, History, EyeOff, Users, Activity, AlertOctagon, CheckCircle2 
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('assistant');
  const [language, setLanguage] = useState('en');
  const [elderMode, setElderMode] = useState(false);
  const [userBalance, setUserBalance] = useState(82450.0);
  const [activeScenario, setActiveScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [emergencyActive, setEmergencyActive] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Namaste Ramesh ji! I am SafePay AI, your injection-resistant financial assistant. How can I help with your payments today?',
      source: 'SafePay AI System',
    },
  ]);

  const [actionData, setActionData] = useState(null);

  // Send a regular user query
  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    setPaymentSuccess(null);
    setLoading(true);

    const newMessages = [...messages, { role: 'user', text }];
    setMessages(newMessages);

    try {
      const res = await fetch('/assistant/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          language,
          elderMode,
          userId: 'USR_RAMESH_001',
        }),
      });

      const data = await res.json();
      const replyText = data.reply || data.explanation || data.message || 'Payment action evaluated.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: replyText,
          source: data.modelRoute || data.modelProviderUsed || 'Deterministic Policy Engine',
        },
      ]);

      const action = data.action || data.proposedAction;

      if (action || data.decision) {
        const isRefuse = data.decision === 'REFUSE';
        const isEscalate = data.decision === 'ESCALATE' || data.requires2FA;

        setActionData({
          intent: action?.intent || action?.actionType || 'PAYMENT',
          amount: action?.amount || (text.match(/₹?\s*([0-9,]+)/)?.[1] ? parseFloat(text.match(/₹?\s*([0-9,]+)/)[1].replace(/,/g, '')) : 22000),
          currency: action?.currency || 'INR',
          recipient: action?.recipient || data.recipient || {
            name: text.includes('Sharma') ? 'Landlord Sharma' : text.includes('Suresh88') ? 'Suresh88@upi' : 'Recipient',
            upiId: text.includes('Suresh88') ? 'Suresh88@upi' : undefined,
            isWhitelisted: !text.includes('Suresh88') && !isRefuse,
          },
          decision: data.decision || (isRefuse ? 'REFUSE' : 'ALLOW'),
          reason: data.reasons?.[0] || data.explanation || 'Evaluated against deterministic safety policies.',
          riskScore: data.riskScore ?? (isRefuse ? 95 : isEscalate ? 45 : 15),
          actionId: data.actionId || (isEscalate ? 'ACT_HIGH_VALUE_DEMO' : undefined),
          actionToken: data.actionToken || null,
          requires2FA: isEscalate,
          checks: {
            injectionDetected: isRefuse,
            recipientWhitelisted: !text.includes('Suresh88') && !isRefuse,
            withinDailyLimit: !isRefuse,
            groundingVerified: !isRefuse,
          },
          groundedIn: 'User Prompt',
          modelRoute: data.modelRoute || data.modelProviderUsed || 'gemini-1.5-flash',
          elderAdvice: elderMode ? (isRefuse ? 'सावधान! यह संदिग्ध लग रहा है।' : 'यह भुगतान सुरक्षित है।') : undefined,
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Error processing request. Security engine failed closed safely.',
          source: 'Fail-Closed Guard',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Analyze attached invoice
  const handleAnalyzeInvoice = async (invoiceId, question) => {
    setPaymentSuccess(null);
    setLoading(true);

    const userMsg = question?.trim()
      ? question
      : invoiceId === 'poisoned_bill'
      ? 'Process attached invoice for ₹5,000 electricity'
      : 'Process attached legitimate electricity invoice';

    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);

    try {
      const res = await fetch('/invoice/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          content: question,
          language,
          elderMode,
        }),
      });

      const data = await res.json();
      const replyText = data.reply || data.explanation || 'Invoice document analyzed.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: replyText,
          source: 'Invoice Extractor + Policy Engine',
        },
      ]);

      const isPoisoned = data.isPoisoned || data.decision === 'REFUSE';
      const action = data.action || data.proposedAction;

      setActionData({
        intent: 'PAYMENT',
        amount: data.action?.amount || data.visibleAmount || 2000,
        currency: 'INR',
        recipient: data.action?.recipient || {
          name: 'State Electricity Board',
          accountNumber: 'EEB9920192841029',
          isWhitelisted: true,
        },
        decision: data.decision || (isPoisoned ? 'REFUSE' : 'ALLOW'),
        reason: data.reasons?.[0] || data.explanation || 'Invoice grounded against trusted utility bill.',
        riskScore: data.riskScore ?? (isPoisoned ? 95 : 15),
        actionId: data.actionId,
        actionToken: data.actionToken || null,
        requires2FA: data.requires2FA || false,
        checks: {
          injectionDetected: isPoisoned,
          recipientWhitelisted: true,
          withinDailyLimit: true,
          groundingVerified: !isPoisoned,
        },
        groundedIn: invoiceId === 'poisoned_bill' ? 'Poisoned Invoice (Hidden Injection)' : 'INV_ELECTRICITY_2000',
        modelRoute: 'Invoice Extractor + Policy Engine',
        elderAdvice: elderMode ? (isPoisoned ? 'धोखाधड़ी का प्रयास! इस बिल में छिपे निर्देश पाए गए हैं।' : 'यह बिजली का बिल सही और सत्यापित है।') : undefined,
      });
    } catch (err) {
      console.error('Error analyzing invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  // Execute payment using action token
  const handleConfirmPayment = async (tokenOverride) => {
    const tokenToUse = tokenOverride || actionData?.actionToken;
    if (!tokenToUse) {
      alert('Execution denied: No valid cryptographic action token available.');
      return;
    }

    setExecuting(true);
    try {
      const res = await fetch('/payment/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionToken: tokenToUse }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPaymentSuccess(data);
        if (data.newBalance !== undefined) {
          setUserBalance(data.newBalance);
        }
      } else {
        alert(data.error || 'Payment execution failed by simulator policy');
      }
    } catch (err) {
      console.error('Execution error:', err);
    } finally {
      setExecuting(false);
    }
  };

  // 1-Click Demo Scenarios (Section 38)
  const handleSelectScenario = async (scId) => {
    setActiveScenario(scId);
    setActiveTab('assistant');
    setPaymentSuccess(null);

    if (scId === 'legitimate') {
      await handleAnalyzeInvoice('legitimate_bill', 'Pay my electricity bill as per attached document');
    } else if (scId === 'scam_threat') {
      await handleSendMessage('Urgent electricity bill ₹25,000 to Suresh88@upi immediately or power cut in 2 hours!');
    } else if (scId === 'poisoned_pdf') {
      await handleAnalyzeInvoice('poisoned_bill', 'Please pay this invoice for Bangalore Electricity');
    } else if (scId === 'high_value') {
      await handleSendMessage('Transfer ₹22,000 to Landlord Sharma for house rent');
    } else if (scId === 'emergency_stop') {
      handleEmergencyHalt();
    }
  };

  // Emergency Halt
  const handleEmergencyHalt = async () => {
    setEmergencyActive(true);
    setActionData(null);
    try {
      const res = await fetch('/elder/emergency-halt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'USR_RAMESH_001',
          language,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          text: 'I think this is a scam — stop everything!',
        },
        {
          role: 'assistant',
          text: data.script || 'EMERGENCY SCAM HALT ACTIVATED. All pending transactions frozen. Trusted contact Suresh Kumar notified.',
          source: 'Elder Scam Protection Guardian',
        },
      ]);
    } catch (err) {
      console.error('Emergency halt failed:', err);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col ${elderMode ? 'elder-mode' : ''}`}>
      {/* Header */}
      <Header
        language={language}
        setLanguage={setLanguage}
        elderMode={elderMode}
        setElderMode={setElderMode}
        userBalance={userBalance}
        onEmergencyHalt={handleEmergencyHalt}
      />

      {/* Emergency Halt Banner if active */}
      {emergencyActive && (
        <div className="bg-rose-500 text-white px-4 py-3 text-center text-xs font-bold flex items-center justify-center space-x-2 shadow-lg animate-pulse">
          <AlertOctagon className="h-4 w-4 shrink-0" />
          <span>EMERGENCY SCAM HALT ACTIVE — OUTGOING PAYMENTS FROZEN — TRUSTED CONTACT SURESH NOTIFIED</span>
          <button
            onClick={() => setEmergencyActive(false)}
            className="ml-4 px-2 py-0.5 rounded bg-white text-rose-600 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
          >
            Clear Halt
          </button>
        </div>
      )}

      {/* 60-Second Demo Bar */}
      <QuickDemoBar
        onSelectScenario={handleSelectScenario}
        activeScenario={activeScenario}
        loading={loading}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'assistant', label: 'AI Assistant & Action Engine', icon: Bot },
            { id: 'attacks', label: '22-Vector Attack Harness', icon: ShieldAlert },
            { id: 'audit', label: 'SHA-256 Audit Chain', icon: History },
            { id: 'proof', label: 'Zero-Knowledge Proofs', icon: EyeOff },
            { id: 'recovery', label: '2-of-3 Recovery', icon: Users },
            { id: 'telemetry', label: 'Real Telemetry & SLAs', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'assistant' && (
          <AssistantTab
            messages={messages}
            onSendMessage={handleSendMessage}
            onAnalyzeInvoice={handleAnalyzeInvoice}
            actionData={actionData}
            onConfirmPayment={() => handleConfirmPayment()}
            onTrigger2FA={() => setIs2FAModalOpen(true)}
            executing={executing}
            paymentSuccess={paymentSuccess}
            elderMode={elderMode}
            language={language}
            onEmergencyHalt={handleEmergencyHalt}
          />
        )}

        {activeTab === 'attacks' && <AttackSuiteTab />}
        {activeTab === 'audit' && <AuditLogTab />}
        {activeTab === 'proof' && <PrivacyProofTab userBalance={userBalance} />}
        {activeTab === 'recovery' && <RecoveryTab />}
        {activeTab === 'telemetry' && <TelemetryTab />}
      </main>

      {/* Step-Up 2FA Modal */}
      <TwoFactorModal
        isOpen={is2FAModalOpen}
        onClose={() => setIs2FAModalOpen(false)}
        onVerified={(verifiedToken) => {
          setIs2FAModalOpen(false);
          handleConfirmPayment(verifiedToken);
        }}
        actionData={actionData}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SafePay AI • FS-2605 Hackathon Prototype</span>
          <span className="font-mono text-[11px] text-slate-400">
            Rule: "The LLM is untrusted. LLM proposes. Deterministic code decides."
          </span>
        </div>
      </footer>
    </div>
  );
}
