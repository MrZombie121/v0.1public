
import React, { useState } from 'react';
import { MessageSquare, Send, Info, Loader2, Sparkles, CheckCircle2, Server, Globe } from 'lucide-react';
import { MONITORING_CHANNELS } from '../constants';
import { mockBackend } from '../services/mockBackend';
import { TGParser } from '../services/tgParser';

interface TelegramFeedProps {
  onMessageProcessed: () => void;
}

const TelegramFeed: React.FC<TelegramFeedProps> = ({ onMessageProcessed }) => {
  const [inputText, setInputText] = useState('');
  const [activeSource, setActiveSource] = useState('Manual');
  const [isParsing, setIsParsing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [useLocalServer, setUseLocalServer] = useState(true);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isParsing) return;
    
    setIsParsing(true);
    try {
      const lines = inputText.split('\n').filter(l => l.trim().length > 5);
      
      if (useLocalServer) {
        try {
          for (const line of lines) {
            const response = await fetch('http://localhost:3000/api/ingest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: line, source: activeSource })
            });
            if (!response.ok) throw new Error("Server unreachable");
          }
        } catch (err) {
          console.warn("Local server offline, fallback to browser");
          setUseLocalServer(false);
          for (const line of lines) {
            const aiResult = await TGParser.parseAI(line);
            if (aiResult) await mockBackend.processManualMessage(line, activeSource, aiResult);
          }
        }
      } else {
        for (const line of lines) {
          const aiResult = await TGParser.parseAI(line);
          if (aiResult) await mockBackend.processManualMessage(line, activeSource, aiResult);
        }
      }
      
      onMessageProcessed();
      setInputText('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error("Processing error:", error);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="absolute top-16 right-4 z-[1000] w-64 pointer-events-none flex flex-col gap-3 overflow-y-auto max-h-[80vh]">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-3.5 rounded-2xl shadow-2xl pointer-events-auto border-t-2 border-t-sky-500/50">
        <div className="flex items-center justify-between mb-3">
           <div className="flex items-center gap-2">
            <Server size={14} className="text-sky-400" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-100">Command</h2>
          </div>
          <button 
            onClick={() => setUseLocalServer(!useLocalServer)}
            className={`text-[7px] px-1.5 py-0.5 rounded border uppercase font-bold transition-all ${useLocalServer ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-amber-500/20 border-amber-500 text-amber-400'}`}
          >
            {useLocalServer ? 'Server' : 'Local'}
          </button>
        </div>
        
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
          <div className="relative">
            <textarea
              value={inputText}
              disabled={isParsing}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Inject tactical data..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-200 focus:outline-none focus:border-sky-500/50 h-20 resize-none transition-all placeholder:text-slate-700"
            />
            {isParsing && (
              <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Loader2 size={16} className="text-sky-500 animate-spin" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mb-1">
            {MONITORING_CHANNELS.map(ch => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveSource(ch.name)}
                className={`px-1.5 py-0.5 rounded-[4px] text-[7px] font-bold border transition-all ${
                  activeSource === ch.name ? 'bg-sky-500/20 border-sky-500 text-sky-400' : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
              >
                {ch.name}
              </button>
            ))}
          </div>

          <button 
            type="submit"
            disabled={isParsing || !inputText.trim()}
            className={`flex items-center justify-center gap-2 h-8 ${showSuccess ? 'bg-emerald-600' : 'bg-sky-600 hover:bg-sky-500'} disabled:bg-slate-800 text-white text-[9px] font-black rounded-lg uppercase tracking-widest transition-all`}
          >
            {isParsing ? 'Processing' : showSuccess ? 'Done' : 'Deploy'}
          </button>
        </form>
      </div>

      <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-2.5 rounded-xl pointer-events-auto">
        <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest text-slate-400">
           <span>Status</span>
           <span className="text-emerald-400">Tactical Online</span>
        </div>
      </div>
    </div>
  );
};

export default TelegramFeed;
