
import { AirEvent, FilterState, TargetType, LogEntry } from './types';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MapDisplay from './components/MapDisplay';
import Controls from './components/Controls';
import TelegramFeed from './components/TelegramFeed';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import { ShieldCheck, Activity, Loader2, AlertCircle, X, Settings, Lock, LogOut } from 'lucide-react';

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
      const res = await fetch(getApiUrl('/api/events'));
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setLogs(data.logs || []);
        setSystemInitialized(data.systemInitialized);
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
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const typeMatch = filters.types.includes(e.type);
      const isTest = !e.isVerified || e.rawText?.toLowerCase().includes('тест');
      const testMatch = filters.showTest ? true : !isTest;
      return typeMatch && testMatch;
    });
  }, [events, filters]);

  const forceTest = async () => {
    try {
      await fetch(getApiUrl('/api/ingest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'тест', source: 'HUD_ADMIN' })
      });
      refreshData();
    } catch (e) {}
  };

  const deleteEvent = async (id: string) => {
    try {
      await fetch(getApiUrl(`/api/admin/event/${id}`), { method: 'DELETE' });
      refreshData();
    } catch (e) {}
  };

  const logout = () => {
    localStorage.removeItem('skywatch_user');
    setUser(null);
    setShowAdmin(false);
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const canAccessAdmin = user?.role === 'admin' || user?.role === 'owner';

  if (isInitialLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#020617] text-slate-400">
        <Loader2 className="text-sky-500 animate-spin mb-4" size={48} />
        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Initializing Grid...</span>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen flex flex-col font-mono overflow-hidden bg-[#020617] text-slate-200">
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
          {canAccessAdmin && (
            <button onClick={forceTest} className="w-full py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl text-[9px] font-black text-sky-400 uppercase transition-all">
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
            {canAccessAdmin && (
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
        <AuthModal isFirstTime={!systemInitialized} onSuccess={(u, token) => {
            setUser(u);
            localStorage.setItem('skywatch_user', JSON.stringify(u));
            setShowAuth(false);
            refreshData();
          }} onClose={() => setShowAuth(false)} 
        />
      )}

      {showAdmin && canAccessAdmin && (
        <AdminDashboard currentUserRole={user?.role || 'user'} events={events} onDelete={deleteEvent} onClose={() => setShowAdmin(false)} />
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
