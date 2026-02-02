
import React, { useState, useEffect } from 'react';
import { AirEvent } from '../types';
import { Trash2, ShieldAlert, X, Database, Users, Shield, ShieldOff, Radio, Plus, Link, Bomb, AlertTriangle, RefreshCw, Key, Eraser, Construction, ToggleLeft, ToggleRight, Calendar } from 'lucide-react';

interface AdminDashboardProps {
  currentUserRole: string;
  events: AirEvent[];
  maintenanceMode: boolean;
  onDelete: (id: string) => void;
  onClose: () => void;
  onMaintenanceToggle: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUserRole, events, maintenanceMode, onDelete, onClose, onMaintenanceToggle }) => {
  const [activeTab, setActiveTab] = useState<'events' | 'personnel' | 'sources'>('events');
  const [users, setUsers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [maintDate, setMaintDate] = useState<string>('');
  
  const isOwner = currentUserRole === 'owner';

  const getApiUrl = (path: string) => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal && window.location.port !== '3000' ? `http://localhost:3000${path}` : path;
  };

  const fetchData = async () => {
    try {
      if (activeTab === 'personnel' && isOwner) {
        // Fetching users could be implemented if needed, but for now we focus on maintenance
      } else if (activeTab === 'sources') {
        const res = await fetch(getApiUrl('/api/sources'));
        if (res.ok) setSources(await res.json());
      }
    } catch (e) { console.error(e); }
  };

  const toggleMaintenance = async () => {
    if (!isOwner) return;
    const untilTimestamp = maintDate ? new Date(maintDate).getTime() : 0;
    
    try {
      const res = await fetch(getApiUrl('/api/admin/maintenance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enabled: !maintenanceMode, 
          until: untilTimestamp,
          userRole: currentUserRole 
        })
      });
      if (res.ok) onMaintenanceToggle();
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden flex flex-col border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-6 bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isOwner ? 'bg-amber-500/20' : 'bg-sky-500/20'}`}>
              {isOwner ? <Key size={24} className="text-amber-400" /> : <ShieldAlert size={24} className="text-sky-400" />}
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest text-white">Command Center</h2>
              <div className="flex gap-4 mt-2">
                <button onClick={() => setActiveTab('events')} className={`text-[10px] font-bold uppercase flex items-center gap-2 transition-all ${activeTab === 'events' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}><Database size={10} /> Air Assets</button>
                <button onClick={() => setActiveTab('personnel')} className={`text-[10px] font-bold uppercase flex items-center gap-2 transition-all ${activeTab === 'personnel' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}><Users size={10} /> Maintenance & Security</button>
                <button onClick={() => setActiveTab('sources')} className={`text-[10px] font-bold uppercase flex items-center gap-2 transition-all ${activeTab === 'sources' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}><Radio size={10} /> Sources</button>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'events' && (
            <div className="space-y-4">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                  <tr><th className="pb-4">Asset</th><th className="pb-4">Location</th><th className="pb-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {events.map(e => (
                    <tr key={e.id} className="hover:bg-white/5">
                      <td className="py-4 font-black uppercase">{e.type}</td>
                      <td className="py-4 text-emerald-400 font-bold">{e.region}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => onDelete(e.id)} className="p-2 text-rose-500/50 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'personnel' && (
            <div className="space-y-8">
              {isOwner && (
                 <div className="p-8 rounded-[2rem] border border-sky-500/20 bg-sky-500/5 space-y-6">
                    <div className="flex items-center gap-4">
                       <div className={`p-4 rounded-2xl ${maintenanceMode ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                          <Construction size={32} />
                       </div>
                       <div>
                          <h3 className="text-lg font-black uppercase tracking-widest text-white">Технічні Роботи (Lockdown)</h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">Configure the maintenance window and live countdown</p>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block ml-1">Maintenance Ends At</label>
                          <div className="relative">
                             <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                             <input 
                               type="datetime-local" 
                               value={maintDate} 
                               onChange={(e) => setMaintDate(e.target.value)}
                               className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-3 text-sm text-white focus:outline-none focus:border-sky-500/50"
                             />
                          </div>
                       </div>
                       
                       <div className="flex items-end">
                          <button 
                            onClick={toggleMaintenance}
                            className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-xl ${
                              maintenanceMode ? 'bg-rose-600 text-white shadow-rose-600/20' : 'bg-sky-600 text-white shadow-sky-600/20'
                            }`}
                          >
                             {maintenanceMode ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                             {maintenanceMode ? 'Lockdown Active' : 'Start Lockdown'}
                          </button>
                       </div>
                    </div>
                    
                    {maintenanceMode && (
                      <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 flex items-center gap-3">
                         <ShieldAlert size={16} className="text-rose-500" />
                         <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                            System is currently invisible to all operators except the Owner.
                         </span>
                      </div>
                    )}
                 </div>
              )}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="space-y-6">
              <div className="flex gap-3">
                <input type="text" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} placeholder="Telegram channel name..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white" />
                <button onClick={async () => {
                  if (!newSourceName.trim()) return;
                  await fetch(getApiUrl('/api/admin/sources'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newSourceName.replace('@', ''), type: 'telegram' })
                  });
                  setNewSourceName('');
                  fetchData();
                }} className="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase"><Plus size={16} /> Add Source</button>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                  <tr><th className="pb-4">Channel</th><th className="pb-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sources.map(s => (
                    <tr key={s.id} className="hover:bg-white/5">
                      <td className="py-4 font-bold text-sky-400 flex items-center gap-2"><Link size={12} className="text-slate-500"/> @{s.name}</td>
                      <td className="py-4 text-right">
                        <button onClick={async () => {
                           await fetch(getApiUrl(`/api/admin/sources/${s.id}`), { method: 'DELETE' });
                           fetchData();
                        }} className="p-2 text-rose-500/50 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
