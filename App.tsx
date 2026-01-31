
import { AirEvent, FilterState, TargetType, LogEntry } from './types';
import React, { useState, useEffect, useCallback } from 'react';
import MapDisplay from './components/MapDisplay';
import Controls from './components/Controls';
import TelegramFeed from './components/TelegramFeed';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import { ShieldCheck, Activity, Target, Zap, Clock, TrendingUp, RefreshCw, Loader2, AlertCircle, X, Settings, Lock, LogOut, User as UserIcon, Radio, Globe, Wifi } from 'lucide-react';

interface User {
  email: string;
  role: 'admin' | 'user';
}

interface Source {
  id: string;
  name: string;
  enabled: boolean;
  type: string;
}

const App: React.FC = () => {
  const [events, setEvents] = useState<AirEvent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [systemInitialized, setSystemInitialized] = useState(false);
  
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('skywatch_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AirEvent | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    types: [TargetType.SHAHED, TargetType.MISSILE, TargetType.KAB],
    showTest: true
  });

  const getApiUrl = (path: string) => {
    const isDev = window.location.port === '5173' || window.location.port === '5174' || window.location.port === '3000';
    // If we are on Vite dev port, target the backend on 3000. Otherwise relative.
    return (window.location.port === '5173' || window.location.port === '5174') ? `http://localhost:3000${path}` : path;
  };

  const refreshData = useCallback(async () => {
    try {
      // Use parallel fetching but handle them individually to ensure one doesn't block the other
      const [resEvents, resSources] = await Promise.all([
        fetch(getApiUrl('/api/events')).catch(() => ({ ok: false })),
        fetch(getApiUrl('/api/sources')).catch(() => ({ ok: false }))
      ]);

      if (resEvents.ok) {
        const data = await (resEvents as Response).json();
        setEvents(data.events || []);
        setLogs(data.logs || []);
        setSystemInitialized(data.systemInitialized);
      }
      
      if (resSources.ok) {
        const sourceData = await (resSources as Response).json();
        if (Array.isArray(sourceData)) {
          setSources(sourceData);
        }
      }

      setSystemError(null);
    } catch (err) {
      console.error("Refresh Error:", err);
      setSystemError("Tactical Server Connection Error");
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  const deleteEvent = async (id: string) => {
    const token = localStorage.getItem('skywatch_token');
    try {
      await fetch(getApiUrl(`/api/admin/event/${id}`), { 
        method: 'DELETE',
        headers: { 'auth-token': token || '' }
      });
      refreshData();
    } catch (e) { console.error(e); }
  };

  const logout = () => {
    localStorage.removeItem('skywatch_user');
    localStorage.removeItem('skywatch_token');
    setUser(null);
    setShowAdmin(false);
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  if (isInitialLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#020617] text-slate-400 font-mono text-center px-6">
        <ShieldCheck className="text-rose-500 animate-pulse mb-6" size={64} />
        <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-white">SkyWatch Node</h2>
        <div className="flex items-center gap-2 text-xs mt-6 font-bold text-rose-500/60 uppercase tracking-widest">
          <Loader2 size={14} className="animate-spin" /> Synchronizing Tactical Grid...
        </div>
        <div className="mt-12 max-w-xs text-[10px] text-slate-600 uppercase tracking-tighter leading-relaxed">
          Initial handshakes with orbital and ground intelligence assets in progress. 
          Stand by for data stream authorization.
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen flex font-mono overflow-hidden bg-[#020617] text-slate-200">
      {systemError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[2000] glass-panel border-rose-500/50 px-6 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle size={20} className="text-rose-500 animate-pulse" />
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{systemError}</span>
        </div>
      )}

      <div className="flex-1 relative z-0 h-full w-full">
        <MapDisplay events={events} onSelectEvent={setSelectedEvent} />
      </div>

      {/* Verified Intelligence Network Status (INTEL MESH) */}
      <div className="absolute top-44 left-6 z-[1002] w-56 pointer-events-none">
        <div className="glass-panel p-5 rounded-[1.5rem] pointer-events-auto border-l-2 border-sky-500 space-y-4 opacity-95 hover:opacity-100 transition-all shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
              <span className="text-[11px] font-black text-white uppercase tracking-widest">INTEL MESH</span>
            </div>
            <span className="text-[9px] font-black text-sky-500/70 uppercase">v1.0</span>
          </div>
          
          <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
            {!sources || sources.length === 0 ? (
              <div className="flex flex-col items-center py-4 gap-2">
                <Loader2 size={16} className="text-slate-700 animate-spin" />
                <span className="text-[9px] italic text-slate-600 uppercase tracking-widest text-center">Syncing uplinks...</span>
              </div>
            ) : (
              sources.map(s => (
                <div key={s.id} className="flex flex-col gap-1 group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-300 group-hover:text-sky-400 transition-colors uppercase tracking-tight">@{s.name}</span>
                    <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${s.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      {s.enabled ? 'ONLINE' : 'OFFLINE'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-50">
                     <div className="h-[1px] flex-1 bg-white/10" />
                     <span className="text-[7px] text-slate-500 uppercase font-bold tracking-[0.2em]">{s.type}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-500 uppercase">MESH STATUS:</span>
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.15em] flex items-center gap-1.5">
              <Wifi size={10} /> SYNCED
            </span>
          </div>
        </div>
      </div>

      {/* User Controls / Auth Interface */}
      <div className="absolute bottom-8 right-8 z-[2000] flex gap-3">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="glass-panel px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-4 shadow-xl">
              <div className={`p-1.5 rounded-full ${user.role === 'admin' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-500/20 text-slate-500'}`}>
                <UserIcon size={16} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xs text-white font-black tracking-tight">{user.email}</span>
                <span className="text-[8px] text-slate-500 font-black uppercase mt-0.5 tracking-widest">{user.role}</span>
              </div>
              <div className="w-px h-6 bg-white/5 ml-1" />
              <button onClick={logout} className="p-2 hover:bg-rose-500/10 rounded-full text-rose-500/70 hover:text-rose-500 transition-all">
                <LogOut size={16} />
              </button>
            </div>
            {user.role === 'admin' && (
              <button 
                onClick={() => setShowAdmin(true)} 
                className="bg-sky-600 hover:bg-sky-500 p-3.5 rounded-full text-white shadow-xl shadow-sky-600/20 border border-sky-400/50 transition-all active:scale-95"
              >
                <Settings size={22} />
              </button>
            )}
          </div>
        ) : (
          <button 
            onClick={() => setShowAuth(true)} 
            className="glass-panel p-4 rounded-full text-slate-400 hover:text-white border border-white/10 transition-all shadow-2xl hover:scale-105 active:scale-95"
          >
            <Lock size={22} />
          </button>
        )}
      </div>

      {showAuth && (
        <AuthModal 
          isFirstTime={!systemInitialized} 
          onSuccess={(u, token) => {
            setUser(u);
            localStorage.setItem('skywatch_user', JSON.stringify(u));
            localStorage.setItem('skywatch_token', token);
            setShowAuth(false);
          }} 
          onClose={() => setShowAuth(false)} 
        />
      )}

      {showAdmin && user?.role === 'admin' && (
        <AdminDashboard events={events} onDelete={deleteEvent} onClose={() => setShowAdmin(false)} />
      )}

      {/* Main Header / Branding */}
      <div className="absolute top-8 left-8 z-[1002] pointer-events-none">
        <div className="glass-panel p-4 pr-6 rounded-2xl border-l-4 border-l-rose-600 pointer-events-auto flex items-center gap-4 shadow-2xl">
          <div className="p-2.5 bg-rose-600/20 rounded-xl"><ShieldCheck size={28} className="text-rose-500" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none text-white flex items-baseline gap-2">
              SkyWatch <span className="text-[12px] text-sky-500 font-black opacity-80 tracking-widest">v1.0</span>
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Tactical Node Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Asset Statistics */}
      <div className="absolute top-8 right-8 z-[1002] w-72 pointer-events-none">
        <div className="glass-panel p-5 rounded-2xl pointer-events-auto border-t border-white/10 space-y-5 shadow-2xl">
          <div className="flex justify-between items-center text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
            <span className="flex items-center gap-2 text-sky-400"><Activity size={14} /> LIVE SCAN</span>
            <span className="text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded text-xs">{events.length}</span>
          </div>
          <div className="space-y-3">
            {['shahed', 'missile', 'kab'].map(type => (
              <div key={type} className="flex justify-between items-center group">
                <div className="flex items-center gap-2">
                   <div className={`w-1 h-3 rounded-full ${type === 'missile' ? 'bg-rose-500' : type === 'shahed' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">{type}</span>
                </div>
                <span className="text-sm font-black text-white">{events.filter(e => e.type === type).length}</span>
              </div>
            ))}
          </div>
          <div className="h-px bg-white/5" />
          <div className="flex justify-between items-center text-[8px] text-slate-600 font-black uppercase tracking-widest">
            <span>Scan Frequency:</span>
            <span>0.2 Hz</span>
          </div>
        </div>
      </div>

      {/* Footer Interface: Controls & Input */}
      <div className="absolute bottom-8 left-8 right-8 z-[1002] flex items-end justify-between pointer-events-none">
        <div className="pointer-events-auto"><Controls filters={filters} setFilters={setFilters} /></div>
        <div className="flex-1 max-w-2xl mx-12 pointer-events-auto"><TelegramFeed onMessageProcessed={refreshData} /></div>
        <div className="w-64 invisible md:visible" />
      </div>

      {/* Event Details Card */}
      {selectedEvent && (
        <div className="absolute top-1/2 right-80 -translate-y-1/2 z-[1003] glass-panel p-8 rounded-[2.5rem] border-l-4 border-l-sky-500 w-96 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200">
           <div className="flex justify-between items-start mb-6">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-sky-500/20 rounded-2xl"><Target size={24} className="text-sky-400" /></div>
               <div>
                 <span className="text-[10px] font-black uppercase text-sky-500 tracking-[0.3em]">Detection Data</span>
                 <h3 className="text-xl font-black uppercase text-white tracking-tight">Intercept Vector</h3>
               </div>
             </div>
             <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-all"><X size={24} /></button>
           </div>
           <div className="space-y-4 text-xs font-medium">
             <div className="flex justify-between border-b border-white/5 pb-3">
               <span className="text-slate-500 font-bold uppercase tracking-widest">Asset Type</span>
               <span className="text-white font-black uppercase tracking-wider">{selectedEvent.type}</span>
             </div>
             <div className="flex justify-between border-b border-white/5 pb-3">
               <span className="text-slate-500 font-bold uppercase tracking-widest">Target Region</span>
               <span className="text-emerald-400 font-black uppercase tracking-wider">{selectedEvent.region}</span>
             </div>
             <div className="flex justify-between border-b border-white/5 pb-3">
               <span className="text-slate-500 font-bold uppercase tracking-widest">Est. Speed</span>
               <span className="text-white font-black tracking-widest">{selectedEvent.speed} km/h</span>
             </div>
             <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={12} className="text-slate-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Original Intelligence</span>
                </div>
                <p className="text-slate-400 italic leading-relaxed">"{selectedEvent.rawText}"</p>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
