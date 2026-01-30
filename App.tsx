
import { AirEvent, FilterState, TargetType, LogEntry } from './types';
import React, { useState, useEffect, useCallback } from 'react';
import MapDisplay from './components/MapDisplay';
import Controls from './components/Controls';
import TelegramFeed from './components/TelegramFeed';
import { mockBackend } from './services/mockBackend';
import { ShieldCheck, Activity, Target, Zap, Clock, TrendingUp, Info, X, Navigation } from 'lucide-react';

const App: React.FC = () => {
  const [events, setEvents] = useState<AirEvent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AirEvent | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    types: [TargetType.SHAHED, TargetType.MISSILE, TargetType.KAB],
    showTest: true
  });

  const API_URL = window.location.port === '5173' ? 'http://localhost:3000' : window.location.origin;

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/events`);
      if (res.ok) {
        setIsApiConnected(true);
        const serverEvents = await res.json();
        // Полная синхронизация вместо простого инжекта
        mockBackend.syncServerEvents(serverEvents);
      } else {
        setIsApiConnected(false);
      }
    } catch {
      setIsApiConnected(false);
    }
    
    const rawEvents = mockBackend.getEvents();
    const filtered = rawEvents.filter(event => {
      const typeMatch = filters.types.includes(event.type);
      const testMatch = filters.showTest || !event.isUserTest;
      return typeMatch && testMatch;
    });

    setEvents(filtered);
    setLogs(mockBackend.getLogs());
  }, [filters, API_URL]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const stats = {
    shahed: events.filter(e => e.type === TargetType.SHAHED).length,
    missile: events.filter(e => e.type === TargetType.MISSILE).length,
    kab: events.filter(e => e.type === TargetType.KAB).length
  };

  const getSpatialLabel = (offset?: string | null) => {
    if (!offset) return '';
    const map: Record<string, string> = {
      north: 'севернее',
      south: 'южнее',
      east: 'восточнее',
      west: 'западнее',
      'north-east': 'северо-восточнее',
      'north-west': 'северо-западнее',
      'south-east': 'юго-восточнее',
      'south-west': 'юго-западнее'
    };
    return map[offset] || offset;
  };

  const getOriginLabel = (event: AirEvent) => {
    if (event.midpointRegions && event.midpointRegions.length >= 2) {
      return `между ${event.midpointRegions[0]} и ${event.midpointRegions[1]}`;
    }
    if (event.originRegion) {
      return `${getSpatialLabel(event.spatialOffset)} ${event.originRegion}`;
    }
    return null;
  };

  return (
    <div className="relative w-full h-full flex font-mono overflow-hidden bg-slate-950 text-slate-200">
      
      {/* LEFT SIDEBAR: ANALYTICS */}
      <div className="w-64 bg-slate-900/60 backdrop-blur-xl border-r border-slate-800 p-4 flex flex-col gap-6 z-[1002]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-500/20 rounded-lg border border-rose-500/50">
            <ShieldCheck size={18} className="text-rose-500" />
          </div>
          <div>
            <h1 className="text-md font-black tracking-tighter uppercase leading-none">SkyWatch</h1>
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">UA Tactical</span>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <TrendingUp size={12} /> Live Threats
          </h2>
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Shahed</span>
                <span className="text-lg font-black text-sky-400">{stats.shahed}</span>
              </div>
              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full" style={{ width: `${Math.min(100, stats.shahed * 10)}%` }} />
              </div>
            </div>
            
            <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Missile</span>
                <span className="text-lg font-black text-rose-500">{stats.missile}</span>
              </div>
              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full" style={{ width: `${Math.min(100, stats.missile * 20)}%` }} />
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-xl">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">KAB</span>
                <span className="text-lg font-black text-amber-500">{stats.kab}</span>
              </div>
              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, stats.kab * 15)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Selected Target Info */}
        {selectedEvent && (
          <div className="bg-slate-800/60 border border-sky-500/30 rounded-xl p-4 relative animate-in fade-in slide-in-from-left-4">
            <button 
              onClick={() => setSelectedEvent(null)}
              className="absolute top-2 right-2 text-slate-500 hover:text-white"
            >
              <X size={14} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-sky-400" />
              <span className="text-[10px] font-black uppercase text-sky-400">Target Info</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">TYPE:</span>
                <span className="font-bold uppercase text-white">{selectedEvent.type}</span>
              </div>
              <div className="flex flex-col gap-1 text-[10px]">
                <span className="text-slate-500">VECTOR:</span>
                <span className="font-bold text-emerald-400 leading-tight">
                  {getOriginLabel(selectedEvent) ? `${getOriginLabel(selectedEvent)} → ` : ''}
                  {selectedEvent.region}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">SPEED:</span>
                <span className="font-bold text-white">{selectedEvent.speed} km/h</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">RELIABILITY:</span>
                <span className={`font-bold uppercase ${selectedEvent.reliability === 'official' ? 'text-blue-400' : 'text-amber-400'}`}>
                  {selectedEvent.reliability}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto space-y-2">
           <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase">
             <Info size={12} /> Live Intel Feed
           </div>
           <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
             {logs.slice(0, 10).map(log => (
               <div key={log.id} className={`p-2 rounded border border-slate-800/50 text-[8px] leading-tight ${log.isTest ? 'bg-blue-500/5 border-blue-500/20' : 'bg-slate-950/40'}`}>
                 <div className="flex justify-between mb-1">
                   <span className="text-slate-500 font-black">@{log.source}</span>
                   <span className="text-[7px] opacity-50">{new Date(log.timestamp).toLocaleTimeString()}</span>
                 </div>
                 <p className="text-slate-300 italic">"{log.text}"</p>
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* MAIN CONTENT: MAP */}
      <div className="flex-1 relative">
        <MapDisplay events={events} onSelectEvent={setSelectedEvent} />
        <Controls filters={filters} setFilters={setFilters} />
        <TelegramFeed onMessageProcessed={refreshData} />
        
        {/* Top Header Over Map */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] pointer-events-none">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 px-6 py-2 rounded-full flex items-center gap-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Live Monitor</span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-rose-500" />
              <span className="text-[10px] font-black uppercase text-rose-500">Active Threats: {events.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
