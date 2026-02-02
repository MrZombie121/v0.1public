
import { AirEvent, FilterState, TargetType, LogEntry } from './types';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MapDisplay from './components/MapDisplay';
import Controls from './components/Controls';
import TelegramFeed from './components/TelegramFeed';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import { ShieldCheck, Activity, Loader2, AlertCircle, X, Settings, Lock, LogOut, Construction, Terminal, Timer } from 'lucide-react';

interface User {
  email: string;
  role: 'owner' | 'admin' | 'user';
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
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceUntil, setMaintenanceUntil] = useState<number>(0);
  
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('skywatch_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AirEvent | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    types: [TargetType.SHAHED, TargetType.MISSILE, TargetType.KAB],
    showTest: true
  });

  const getApiUrl = (path: string) => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal && window.location.port !== '3000' ? `http://localhost:3000${path}` : path;
  };

  const refreshData = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (user) headers['x-user-role'] = user.role;

      const res = await fetch(getApiUrl('/api/events'), { headers });
      
      if (res.status === 503) {
        const data = await res.json();
        setMaintenanceMode(true);
        setMaintenanceUntil(data.until || 0);
        setIsInitialLoading(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setLogs(data.logs || []);
        setSystemInitialized(data.systemInitialized);
        setMaintenanceMode(data.maintenanceMode || false);
        setMaintenanceUntil(data.maintenanceUntil || 0);
        setSystemError(null);
      } else {
        setSystemError("NODE LINK ERROR");
      }

      const resSources = await fetch(getApiUrl('/api/sources'));
      if (resSources.ok) {
        setSources(await resSources.json());
      }
    } catch (err) {
      setSystemError("NODE LINK LOST");
    } finally {
      setIsInitialLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const typeMatch = filters.types.includes(e.type);
      const isTest = !e.isVerified || e.rawText?.toLowerCase().includes('тест');
      const testMatch = filters.showTest ? true : !isTest;
      return typeMatch && testMatch;
    });
  }, [events, filters]);

  const logout = () => {
    localStorage.removeItem('skywatch_user');
    setUser(null);
    setShowAdmin(false);
  };

  const isOwner = user?.role === 'owner';

  const MaintenanceTimer = ({ target }: { target: number }) => {
    const [diff, setDiff] = useState(target - Date.now());
    useEffect(() => {
      const t = setInterval(() => setDiff(target - Date.now()), 1000);
      return () => clearInterval(t);
    }, [target]);

    if (diff <= 0) return <span className="text-amber-500 animate-pulse">ЗАВЕРШЕННЯ...</span>;

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    return (
      <div className="flex flex-col items-center">
        <span className="text-rose-500 font-black text-4xl tracking-widest font-mono">
          {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
        </span>
        <span className="text-[9px] font-black text-slate-600 uppercase mt-2 tracking-[0.4em]">T-Minus Until Restore</span>
      </div>
    );
  };

  if (isInitialLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#020617] text-slate-400">
        <Loader2 className="text-sky-500 animate-spin mb-4" size={48} />
        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Initializing Grid...</span>
      </div>
    );
  }

  if (maintenanceMode && !isOwner) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#020617] p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-rose-600 animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.8)]" />
        <div className="glass-panel p-12 rounded-[3rem] border border-white/5 space-y-10 max-w-xl relative shadow-2xl backdrop-blur-2xl">
          <div className="flex justify-center">
             <div className="p-6 bg-rose-500/10 rounded-full border border-rose-500/20 text-rose-500 animate-pulse shadow-[0_0_40px_rgba(244,63,94,0.1)]">
                <Construction size={64} />
             </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-black uppercase tracking-tighter text-white">Технічні роботи</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Grid Offline for Maintenance</p>
          </div>

          <div className="bg-black/40 border border-white/5 p-8 rounded-3xl">
             <MaintenanceTimer target={maintenanceUntil} />
          </div>

          <p className="text-sm text-slate-500 leading-relaxed font-medium">
             Система тимчасово заблокована для оновлення ядра та оптимізації алгоритмів Gemini 3.0. 
             Всі джерела Telegram продовжують збирати дані в автономному режимі.
          </p>

          <div className="flex items-center justify-center gap-3 pt-4">
             <Terminal size={14} className="text-slate-700" />
             <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">SkyWatch Kernel v1.2.6-stable</span>
          </div>
          
          <div className="absolute bottom-4 right-4 opacity-10 hover:opacity-100 transition-opacity">
             <button onClick={() => setShowAuth(true)} className="p-3 text-slate-600 hover:text-white transition-colors">
                <Lock size={16} />
             </button>
          </div>
        </div>

        {showAuth && (
          <AuthModal isFirstTime={!systemInitialized} onSuccess={(u) => {
              setUser(u);
              localStorage.setItem('skywatch_user', JSON.stringify(u));
              setShowAuth(false);
              refreshData();
            }} onClose={() => setShowAuth(false)} 
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen flex flex-col font-mono overflow-hidden bg-[#020617] text-slate-200">
      {maintenanceMode && isOwner && (
        <div className="absolute top-0 left-0 right-0 z-[3000] bg-amber-600/20 backdrop-blur-sm border-b border-amber-600/30 py-1 text-center">
           <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse flex items-center justify-center gap-4">
              <Timer size={12} /> !! MAINTENANCE MODE ACTIVE (OWNER BYPASS) !! <Timer size={12} />
           </span>
        </div>
      )}

      {systemError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[2000] glass-panel border-rose-500/50 px-6 py-2 rounded-xl flex items-center gap-3">
          <AlertCircle size={16} className="text-rose-500" />
          <span className="text-[10px] font-black text-rose-500 uppercase">{systemError}</span>
        </div>
      )}

      <div className="flex-1 relative z-0">
        <MapDisplay events={filteredEvents} onSelectEvent={setSelectedEvent} />
      </div>

      <div className="absolute top-44 left-6 z-[1002] w-56 pointer-events-none">
        <div className="glass-panel p-5 rounded-[1.5rem] border-l-2 border-sky-500 space-y-4 pointer-events-auto">
          <span className="text-[11px] font-black text-white uppercase tracking-widest block border-b border-white/5 pb-2">INTEL MESH</span>
          <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar">
            {sources.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-300 uppercase truncate">@{s.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${s.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              </div>
            ))}
          </div>
          {isOwner && (
            <button onClick={async () => {
              await fetch(getApiUrl('/api/ingest'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: 'тест', source: 'HUD_ADMIN' })
              });
              refreshData();
            }} className="w-full py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl text-[9px] font-black text-sky-400 uppercase transition-all">
               FORCE TEST SIGNAL
            </button>
          )}
        </div>
      </div>

      <div className="absolute bottom-8 left-8 right-8 z-[1002] flex items-end justify-between pointer-events-none">
        <div className="pointer-events-auto"><Controls filters={filters} setFilters={setFilters} /></div>
        <div className="flex-1 max-w-2xl mx-12 pointer-events-auto"><TelegramFeed onMessageProcessed={refreshData} /></div>
        <div className="w-64" />
      </div>

      <div className="absolute top-8 left-8 z-[1002]">
        <div className="glass-panel p-4 rounded-2xl border-l-4 border-l-rose-600 flex items-center gap-4 shadow-2xl">
          <ShieldCheck size={28} className="text-rose-500" />
          <div>
            <h1 className="text-2xl font-black uppercase leading-none text-white">SkyWatch</h1>
            <span className="text-[10px] text-slate-400 font-black uppercase">TACTICAL NODE ACTIVE</span>
          </div>
        </div>
      </div>

      <div className="absolute top-8 right-8 z-[1002] w-72">
        <div className="glass-panel p-5 rounded-2xl border-t border-white/10 space-y-5 shadow-2xl">
          <div className="flex justify-between items-center text-[11px] font-black text-slate-500 uppercase">
            <span className="flex items-center gap-2 text-sky-400"><Activity size={14} /> LIVE GRID</span>
            <span className="text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded text-sm font-black">{filteredEvents.length}</span>
          </div>
          <div className="space-y-2">
            {['shahed', 'missile', 'kab'].map(type => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase">{type}</span>
                <span className="text-sm font-black text-white">{filteredEvents.filter(e => e.type === type).length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 z-[2000] flex gap-3">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="glass-panel px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-4">
              <span className="text-xs text-white font-black">{user.email}</span>
              <button onClick={logout} className="p-2 text-rose-500 hover:scale-110 transition-transform"><LogOut size={16} /></button>
            </div>
            {(user.role === 'admin' || user.role === 'owner') && (
              <button onClick={() => setShowAdmin(true)} className="bg-sky-600 p-3.5 rounded-full text-white shadow-xl hover:bg-sky-500">
                <Settings size={22} />
              </button>
            )}
          </div>
        ) : (
          <button onClick={() => setShowAuth(true)} className="glass-panel p-4 rounded-full text-slate-400 hover:text-white transition-all">
            <Lock size={22} />
          </button>
        )}
      </div>

      {showAuth && (
        <AuthModal isFirstTime={!systemInitialized} onSuccess={(u) => {
            setUser(u);
            localStorage.setItem('skywatch_user', JSON.stringify(u));
            setShowAuth(false);
            refreshData();
          }} onClose={() => setShowAuth(false)} 
        />
      )}

      {showAdmin && (user?.role === 'admin' || user?.role === 'owner') && (
        <AdminDashboard 
          currentUserRole={user?.role || 'user'} 
          events={events} 
          maintenanceMode={maintenanceMode}
          onDelete={async (id) => {
            await fetch(getApiUrl(`/api/admin/event/${id}`), { method: 'DELETE' });
            refreshData();
          }} 
          onClose={() => setShowAdmin(false)} 
          onMaintenanceToggle={refreshData}
        />
      )}

      {selectedEvent && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1003] glass-panel p-8 rounded-[2.5rem] border-l-4 border-l-sky-500 w-96 shadow-2xl">
           <div className="flex justify-between mb-6">
             <h3 className="text-xl font-black uppercase text-white">Target Data</h3>
             <button onClick={() => setSelectedEvent(null)} className="text-slate-500 hover:text-white"><X size={24} /></button>
           </div>
           <div className="space-y-4 text-xs">
             <div className="flex justify-between border-b border-white/5 pb-2">
               <span className="text-slate-500 uppercase">TYPE</span>
               <span className="text-white font-black uppercase">{selectedEvent.type}</span>
             </div>
             <div className="flex justify-between border-b border-white/5 pb-2">
               <span className="text-slate-500 uppercase">REGION</span>
               <span className="text-emerald-400 font-black uppercase">{selectedEvent.region}</span>
             </div>
             <div className="mt-4 p-4 bg-white/5 rounded-xl text-slate-400 italic">"{selectedEvent.rawText}"</div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
