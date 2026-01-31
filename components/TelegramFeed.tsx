
import React, { useState } from 'react';
import { Loader2, Terminal, Info, Zap, ChevronRight } from 'lucide-react';

interface TelegramFeedProps {
  onMessageProcessed: () => void;
}

const TelegramFeed: React.FC<TelegramFeedProps> = ({ onMessageProcessed }) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastStatus, setLastStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setLastStatus('idle');
    try {
      const isDev = window.location.port === '5173';
      const API_URL = isDev ? 'http://localhost:3000' : '';
      
      const response = await fetch(`${API_URL}/api/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, source: 'Direct_Command' })
      });

      if (response.ok) {
        setLastStatus('success');
        onMessageProcessed();
        setInput('');
        setTimeout(() => setLastStatus('idle'), 3000);
      } else {
        setLastStatus('error');
      }
    } catch (err) {
      setLastStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl">
        <div className="flex items-center gap-3 bg-white/5 px-4 py-3 border-b border-white/5">
          <Terminal size={14} className="text-sky-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tactical Injection Terminal</span>
          <div className="ml-auto flex items-center gap-3">
             {lastStatus === 'success' && <span className="text-[8px] font-bold text-emerald-500 animate-pulse">INTEL INGESTED</span>}
             {lastStatus === 'error' && <span className="text-[8px] font-bold text-rose-500 animate-pulse">SYSTEM ERROR</span>}
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        <div className="p-4 flex items-center gap-3">
          <ChevronRight size={14} className="text-slate-600" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Введіть тактичні дані (напр: 'Шахеди з моря на Одесу')..."
            className="flex-1 bg-transparent border-none text-slate-200 text-sm font-medium placeholder:text-slate-600 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className={`p-2 rounded-xl transition-all ${isProcessing ? 'bg-sky-500/20 text-sky-500' : 'bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20'} disabled:opacity-20`}
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
          </button>
        </div>
      </div>
      <div className="mt-2 flex justify-center">
        <div className="flex items-center gap-2">
          <Info size={10} className="text-slate-600" />
          <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">AI Grounding via Google Maps Active</span>
        </div>
      </div>
    </div>
  );
};

export default TelegramFeed;
