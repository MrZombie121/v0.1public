
import React, { useState } from 'react';
import { Loader2, Terminal, Info, Zap } from 'lucide-react';

interface TelegramFeedProps {
  onMessageProcessed: () => void;
}

const TelegramFeed: React.FC<TelegramFeedProps> = ({ onMessageProcessed }) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      // Отправляем сырой текст на наш сервер
      const API_URL = window.location.port === '5173' ? 'http://localhost:3000' : '';
      const response = await fetch(`${API_URL}/api/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, source: 'Manual_Console' })
      });

      if (response.ok) {
        onMessageProcessed();
        setInput('');
      } else {
        const err = await response.json();
        console.error("Server error:", err);
      }
    } catch (err) {
      console.error("Network error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="glass-panel rounded-xl overflow-hidden border-t border-white/10 relative">
        <div className="flex items-center gap-3 bg-black/40 px-4 py-2 border-b border-white/5">
          <Terminal size={12} className="text-sky-500" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tactical Injection Terminal</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-bold text-emerald-500/70">SECURE LINK ACTIVE</span>
          </div>
        </div>

        <div className="p-3 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Введіть тактичні дані (напр: 'Шахеди з моря на Одесу')..."
            className="w-full bg-transparent border-none text-slate-200 text-xs font-medium placeholder:text-slate-600 outline-none py-1 pr-10"
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-sky-500 hover:text-sky-300 disabled:text-slate-700 transition-colors"
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          </button>
        </div>
      </div>
      <div className="mt-2 flex justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <Info size={10} className="text-slate-600" />
          <span className="text-[8px] font-bold text-slate-600 uppercase">Input is processed by Cloud AI node</span>
        </div>
      </div>
    </div>
  );
};

export default TelegramFeed;
