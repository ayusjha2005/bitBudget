import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Mic, FileUp, Sparkles, AlertTriangle, ShieldCheck, 
  HelpCircle, Bot, User, FileText, CheckCircle2, ChevronRight, Volume2 
} from 'lucide-react';
import ActionCard from './ActionCard.jsx';
import VoiceController from './VoiceController.jsx';

export default function AssistantTab({
  messages,
  onSendMessage,
  onAnalyzeInvoice,
  actionData,
  onConfirmPayment,
  onTrigger2FA,
  executing,
  paymentSuccess,
  elderMode,
  language,
  onEmergencyHalt,
}) {
  const [input, setInput] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState('none');
  const messagesEndRef = useRef(null);

  // Find the most recent assistant message for voice readout
  const lastAssistantMessage = messages
    .slice()
    .reverse()
    .find((m) => m.role === 'assistant');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, actionData]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim() && selectedInvoice === 'none') return;

    if (selectedInvoice !== 'none') {
      onAnalyzeInvoice(selectedInvoice, input);
    } else {
      onSendMessage(input);
    }
    setInput('');
    setSelectedInvoice('none');
  };

  const handleVoiceInput = (speechText) => {
    if (!speechText.trim()) return;
    setInput(speechText);
    onSendMessage(speechText);
    setInput('');
  };

  const handleReplaySpeech = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/[*_#`~]/g, '')
        .replace(/₹\s*([0-9,]+)/g, '$1 rupees')
        .replace(/Rs\.?\s*([0-9,]+)/gi, '$1 rupees');
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = elderMode ? 0.88 : 0.96;
      u.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className="space-y-6">
      {/* Prominent Two-Way AI Voice Assistant Controller for Elders */}
      <VoiceController
        onVoiceInput={handleVoiceInput}
        language={language}
        elderMode={elderMode}
        lastAssistantMessage={lastAssistantMessage}
        disabled={executing}
      />

      {/* Main Conversation & Decision Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Chat Transcript (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col h-[580px] rounded-3xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-4 w-4 text-indigo-400" />
              <span className={`font-bold text-slate-200 ${elderMode ? 'text-base' : 'text-xs'}`}>
                SafePay Voice & Chat Assistant
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              SHIELD ACTIVE
            </span>
          </div>

          {/* Message List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2.5 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role !== 'user' && (
                  <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-indigo-400" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    elderMode ? 'text-sm' : 'text-xs'
                  } leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-md'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-none shadow-md'
                  }`}
                >
                  <p>{msg.text}</p>
                  
                  {/* Replay audio button for assistant responses */}
                  {msg.role !== 'user' && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                      <span className="text-[10px] opacity-75 font-mono">
                        {msg.source || 'SafePay Shield'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleReplaySpeech(msg.text)}
                        className="flex items-center space-x-1 text-[11px] text-indigo-300 hover:text-white bg-slate-700/60 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                        title="Listen to this message"
                      >
                        <Volume2 className="h-3 w-3" />
                        <span>Listen</span>
                      </button>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Invoice Picker */}
          <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 flex items-center space-x-2 text-xs">
            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-slate-400 text-[11px] shrink-0">Scan Invoice:</span>
            <select
              value={selectedInvoice}
              onChange={(e) => setSelectedInvoice(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs w-full cursor-pointer focus:outline-none focus:border-indigo-500"
            >
              <option value="none">No Document Attached</option>
              <option value="legitimate_bill">Legitimate Electricity Bill (₹2,000 BESCOM)</option>
              <option value="poisoned_bill">Suspicious Invoice (Hidden ₹2,00,000 scam text)</option>
            </select>
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                elderMode
                  ? 'Type or speak your payment request...'
                  : selectedInvoice !== 'none'
                  ? 'Ask about attached invoice...'
                  : 'Type or speak: "Pay ₹1,200 for electricity"'
              }
              className={`flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 ${
                elderMode ? 'text-sm' : 'text-xs'
              }`}
            />

            <button
              type="submit"
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md active:scale-95 cursor-pointer"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Right: Security Decision & Action Engine (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          {actionData ? (
            <ActionCard
              actionData={actionData}
              onConfirmPayment={onConfirmPayment}
              onTrigger2FA={onTrigger2FA}
              executing={executing}
              paymentSuccess={paymentSuccess}
              elderMode={elderMode}
            />
          ) : (
            <div className="h-[580px] rounded-3xl border border-dashed border-slate-800 bg-slate-900/20 flex flex-col items-center justify-center p-8 text-center">
              <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400 shadow-inner">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className={`font-bold text-slate-100 ${elderMode ? 'text-xl' : 'text-base'}`}>
                Ready for Financial Requests
              </h3>
              <p className={`text-slate-400 max-w-md mt-2 leading-relaxed ${elderMode ? 'text-sm' : 'text-xs'}`}>
                Speak or type a bill payment, transfer, or ask if a message or invoice is safe. SafePay AI evaluates every request with deterministic prompt-injection checks before touching your funds.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5 justify-center max-w-md">
                <button
                  onClick={() => onSendMessage('Pay electricity bill of ₹1,200 to BESCOM')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  ⚡ "Pay ₹1,200 to BESCOM"
                </button>
                <button
                  onClick={() => onSendMessage('Is it safe to transfer money to an unknown caller claiming to be bank manager?')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-300 hover:text-rose-200 transition-colors cursor-pointer"
                >
                  🛡️ "Is this caller safe?"
                </button>
                <button
                  onClick={() => onSendMessage('Mujhe bijli ka bill bharna hai')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
                >
                  🇮🇳 "बिजली का बिल भरना है"
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
