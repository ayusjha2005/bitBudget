import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Radio, Sparkles, AlertCircle } from 'lucide-react';

/**
 * VoiceController Component
 * Provides two-way voice assistant (Speech-to-Text & Text-to-Speech)
 * Tailored for senior citizens & elderly accessibility:
 * - High contrast, large tactile hit areas
 * - Live animated listening soundwaves
 * - Speech synthesis with configurable rate, clear inflection, and auto-readout
 */
export default function VoiceController({
  onVoiceInput,
  language = 'en',
  elderMode = false,
  lastAssistantMessage = null,
  disabled = false,
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    // Set recognition language
    recognition.lang = language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-IN';

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);

      // When speech is final
      if (event.results[0].isFinal) {
        const finalText = event.results[0][0].transcript.trim();
        if (finalText) {
          onVoiceInput(finalText);
          setTranscript('');
        }
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition status:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch (e) {}
    };
  }, [language, onVoiceInput]);

  // Speech Synthesis (TTS)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Automatically speak assistant responses when Elder Mode is active or TTS is enabled
  useEffect(() => {
    if (!lastAssistantMessage || !ttsEnabled || !synthRef.current) return;

    // Only speak assistant messages
    if (lastAssistantMessage.role === 'assistant' && lastAssistantMessage.text) {
      speakText(lastAssistantMessage.text);
    }
  }, [lastAssistantMessage, elderMode, ttsEnabled]);

  const speakText = (text) => {
    if (!synthRef.current) return;

    try {
      synthRef.current.cancel(); // Cancel any ongoing speech

      // Clean text for speech (remove markdown asterisks, URLs, hashes)
      const cleanText = text
        .replace(/[*_#`~]/g, '')
        .replace(/₹\s*([0-9,]+)/g, '$1 rupees')
        .replace(/Rs\.?\s*([0-9,]+)/gi, '$1 rupees');

      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Voice rate slightly slower (0.92) for elderly comprehension
      utterance.rate = elderMode ? 0.88 : 0.96;
      utterance.pitch = 1.0;
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current.speak(utterance);
    } catch (err) {
      console.warn('TTS error:', err);
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (!speechSupported) {
      alert('Speech recognition is not available in this browser. Please type your message.');
      return;
    }

    if (isSpeaking && synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Mic start error:', err);
      }
    }
  };

  const toggleTts = () => {
    if (isSpeaking && synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
    setTtsEnabled((prev) => !prev);
  };

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      elderMode 
        ? 'bg-amber-950/20 border-amber-500/40 shadow-xl' 
        : 'bg-slate-900/80 border-slate-800/80'
    }`}>
      <div className="flex items-center justify-between gap-4">
        {/* Left: Interactive Big Mic Button */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            className={`relative group flex items-center justify-center rounded-2xl font-bold transition-all shadow-lg active:scale-95 cursor-pointer ${
              elderMode ? 'w-16 h-16' : 'w-13 h-13'
            } ${
              isListening
                ? 'bg-rose-500 text-white ring-4 ring-rose-500/30 animate-pulse'
                : elderMode
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white ring-2 ring-indigo-500/30'
            }`}
            title={isListening ? 'Tap to stop listening' : 'Tap to speak'}
          >
            {isListening ? (
              <Radio className={elderMode ? 'h-8 w-8 animate-spin' : 'h-6 w-6 animate-pulse'} />
            ) : (
              <Mic className={elderMode ? 'h-8 w-8' : 'h-6 w-6'} />
            )}

            {/* Pulsing ring indicator when listening */}
            {isListening && (
              <span className="absolute -inset-1 rounded-2xl border-2 border-rose-400 animate-ping opacity-75"></span>
            )}
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <span className={`font-bold ${elderMode ? 'text-lg text-amber-200' : 'text-sm text-slate-100'}`}>
                {isListening ? 'Listening to your voice...' : 'Speak to SafePay AI'}
              </span>
              {isListening && (
                <span className="flex space-x-1 items-center">
                  <span className="w-1.5 h-3 bg-rose-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-5 bg-rose-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                  <span className="w-1.5 h-4 bg-rose-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                </span>
              )}
            </div>

            <p className={`text-slate-400 ${elderMode ? 'text-sm' : 'text-xs'}`}>
              {isListening 
                ? 'Say "Pay BESCOM bill 1200 rupees" or in Hindi "Bijli ka bill bhar do"'
                : 'Tap microphone to speak bills, transfers, or scam questions'}
            </p>
          </div>
        </div>

        {/* Right: Audio Voice Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={toggleTts}
            className={`p-2.5 rounded-xl border flex items-center space-x-1.5 text-xs font-semibold transition-all cursor-pointer ${
              ttsEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
            title={ttsEnabled ? 'Voice responses are turned ON' : 'Voice responses are turned OFF'}
          >
            {ttsEnabled ? (
              <>
                <Volume2 className={`h-4 w-4 ${isSpeaking ? 'text-emerald-400 animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{isSpeaking ? 'Speaking...' : 'Voice Readout ON'}</span>
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4" />
                <span className="hidden sm:inline">Voice Muted</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Speech Recognition Transcription Banner */}
      {isListening && transcript && (
        <div className="mt-3 p-3 bg-slate-950/80 rounded-xl border border-rose-500/30 text-slate-200 text-sm flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2 overflow-hidden">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0 animate-spin" />
            <span className="truncate italic">"{transcript}"</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-2">Listening...</span>
        </div>
      )}
    </div>
  );
}
