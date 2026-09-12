import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Mic, MicOff, FileUp, Sparkles, AlertTriangle, ShieldCheck, 
  HelpCircle, Bot, User, FileText, CheckCircle2, ChevronRight 
} from 'lucide-react';
import ActionCard from './ActionCard.jsx';

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
  const [isListening, setIsListening] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState('none');
  const [speechSupported, setSpeechSupported] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-IN';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, actionData]);

  const toggleListening = () => {
    if (!speechSupported) {
      alert('Speech recognition is not supported in this browser. Please type your message.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Speech recognition error:', err);
      }
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Active Mode Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span className="text-slate-300">
            <strong>Deterministic Isolation Active:</strong> Natural language models propose typed actions; the policy engine deterministically enforces checks.
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onSendMessage('Is this electricity bill safe to pay?')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 transition-colors text-[11px] cursor-pointer"
          >
            "Is this safe?" Check
          </button>
          <button
            onClick={() => onSendMessage('Mujhe bijli ka bill bharna hai')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-[11px] cursor-pointer"
          >
            Hindi Quick Test
          </button>
        </div>
      </div>

      {/* Main Conversation & Decision Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Chat Transcript (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col h-[560px] rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200">Financial Assistant Dialogue</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Untrusted AI Layer</span>
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
                  <div className="h-7 w-7 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 text-indigo-400" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-none'
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.source && (
                    <div className="mt-1 text-[9px] opacity-75 font-mono">
                      Source: {msg.source}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Invoice Picker */}
          <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/40 flex items-center space-x-2 text-xs">
            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 text-[11px] shrink-0">Attach Invoice:</span>
            <select
              value={selectedInvoice}
              onChange={(e) => setSelectedInvoice(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-[11px] w-full cursor-pointer"
            >
              <option value="none">No Document Attached</option>
              <option value="legitimate_bill">Legitimate Bill (₹2,000 Bangalore Electricity)</option>
              <option value="poisoned_bill">Poisoned Invoice (Visible ₹5,000, Hidden ₹2,00,000 Attack)</option>
            </select>
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center space-x-2">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
              }`}
              title={isListening ? 'Listening... click to stop' : 'Click to speak via Web Speech API'}
            >
              {isListening ? <Mic className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedInvoice !== 'none'
                  ? 'Ask about attached invoice (or click send)...'
                  : 'Type or speak your financial request...'
              }
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <button
              type="submit"
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
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
            <div className="h-[560px] rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 flex flex-col items-center justify-center p-8 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-4 text-indigo-400">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-200">No Pending Financial Action</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Choose a 1-click scenario from the top bar or send a payment request. The LLM will propose a typed action, and the deterministic security engine will evaluate it in real time.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => onSendMessage('Pay ₹2,000 to Bangalore Electricity Board')}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
                >
                  "Pay ₹2,000 for electricity"
                </button>
                <button
                  onClick={() => onSendMessage('Immediate payment ₹25,000 to Suresh88@upi or account suspended')}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
                >
                  "Test Urgent Scam Message"
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
