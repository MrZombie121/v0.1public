
import { AirEvent, FilterState, TargetType, LogEntry } from './types';
import React, { useState, useEffect, useCallback } from 'react';
import MapDisplay from './components/MapDisplay';
import Controls from './components/Controls';
import TelegramFeed from './components/TelegramFeed';
import { mockBackend } from './services/mockBackend';
import { ShieldCheck, Activity, Target, Zap, Clock, TrendingUp, Info, X, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [events, setEvents] = useState<AirEvent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AirEvent | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    types: [TargetType.SHAHED, TargetType.MISSILE, TargetType.KAB],
    showTest: true
  });

  const refreshData = useCallback(async () => {
    try {
      // Используем относительный путь для универсальности
      const res = await fetch('/api/events');
      if (res.ok) {
        const serverEvents = await res.json();
        mockBackend.syncServerEvents(serverEvents);
      }
    } catch (err) {
      console.warn("Backend not reachable, using local store");
    }
    
    const rawEvents = mockBackend.getEvents();
    const filtered = rawEvents.filter(event => {
      const typeMatch = filters.types.includes(event.type);
      const testMatch = filters.showTest || !event.isUserTest;
      return typeMatch && testMatch;
    });

    setEvents(filtered);
    setLogs(mockBackend.getLogs());
  }, [filters]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const stats = {
    shahed: events.filter(e => e.type === TargetType.SHAHED).length,
    missile: events.filter(e => e.type === TargetType.MISSILE).length,
    kab: events.filter(e => e.type === TargetType.KAB).length
  };

  return (
    <div className="relative w-full h-full flex font-mono overflow-hidden bg-[#020617] text-slate-200">
      
      <div className="flex-1 relative z-0">
        <MapDisplay events={events} onSelectEvent={setSelectedEvent} />
      </div>

      {/* HEADER LOGO */}
      <div className="absolute top-6 left-6 z-[1002] flex items-center gap-4 pointer-events-none">
        <div className="glass-panel p-3 rounded-xl border-l-4 border-l-rose-600 pointer-events-auto flex items-center gap-3">
          <div className="p-2 bg-rose-600/20 rounded-lg">
            <ShieldCheck size={20} className="text-rose-500" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter uppercase leading-none">SkyWatch</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Tactical Node Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* ANALYTICS WIDGET */}
      <div className="absolute top-6 right-6 z-[1002] w-64 flex flex-col gap-3 pointer-events-none">
        <div className="glass-panel p-4 rounded-xl pointer-events-auto border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Activity size={12} /> Active Targets
            </h2>
            <span className="text-xs font-black text-rose-500">{events.length}</span>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'Shahed', val: stats.shahed, color: 'text-sky-400', bg: 'bg-sky-500' },
              { label: 'Missile', val: stats.missile, color: 'text-rose-500', bg: 'bg-rose-500' },
              { label: 'KAB', val: stats.kab, color: 'text-amber-500', bg: 'bg-amber-500' }
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{s.label}</span>
                  <span className={`text-sm font-black ${s.color}`}>{s.val}</span>
                </div>
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <div className={`${s.bg} h-full transition-all duration-500`} style={{ width: `${Math.min(100, s.val * 20)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl pointer-events-auto max-h-[300px] flex flex-col border-t border-white/5">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
             <TrendingUp size={12} /> Intel Feed
          </div>
          <div className="overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {logs.length > 0 ? logs.slice(0, 15).map(log => (
              <div key={log.id} className="text-[9px] leading-snug border-l-2 border-slate-800 pl-2 py-0.5">
                <span className="text-slate-500 font-bold mr-1">[{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                <span className="text-slate-300">{log.text}</span>
              </div>
            )) : (
              <div className="text-[9px] text-slate-600 italic">No incoming data...</div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER CONTROLS */}
      <div className="absolute bottom-6 left-6 right-6 z-[1002] flex items-end justify-between pointer-events-none">
        <div className="pointer-events-auto">
          <Controls filters={filters} setFilters={setFilters} />
        </div>
        <div className="flex-1 max-w-xl mx-8 pointer-events-auto">
          <TelegramFeed onMessageProcessed={refreshData} />
        </div>
        <div className="w-64 pointer-events-auto">
           {selectedEvent && (
            <div className="glass-panel p-4 rounded-xl border-l-4 border-l-sky-500 animate-in slide-in-from-right-4">
               <div className="flex justify-between items-start mb-2">
                 <div className="flex items-center gap-2">
                   <Target size={14} className="text-sky-400" />
                   <span className="text-[10px] font-black uppercase text-sky-400">Target Intel</span>
                 </div>
                 <button onClick={() => setSelectedEvent(null)} className="text-slate-500 hover:text-white">
                   <X size={14} />
                 </button>
               </div>
               <div className="grid grid-cols-2 gap-y-2 text-[10px]">
                 <span className="text-slate-500">TYPE:</span>
                 <span className="text-white font-black uppercase text-right">{selectedEvent.type}</span>
                 <span className="text-slate-500">REGION:</span>
                 <span className="text-emerald-400 font-black text-right">{selectedEvent.region}</span>
                 <span className="text-slate-500">SPEED:</span>
                 <span className="text-white font-black text-right">{selectedEvent.speed} KM/H</span>
               </div>
            </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default App;
