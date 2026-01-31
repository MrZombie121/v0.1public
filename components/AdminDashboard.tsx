
import React, { useState, useEffect } from 'react';
import { AirEvent } from '../types';
import { Trash2, ShieldAlert, X, Database, Users, Shield, ShieldOff, Radio, Plus, Link } from 'lucide-react';

interface AdminDashboardProps {
  events: AirEvent[];
  onDelete: (id: string) => void;
  onClose: () => void;
}

interface UserRecord {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

interface SourceRecord {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ events, onDelete, onClose }) => {
  const [activeTab, setActiveTab] = useState<'events' | 'personnel' | 'sources'>('events');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [newSourceName, setNewSourceName] = useState('');

  const getApiUrl = (path: string) => {
    const isDev = window.location.port === '5173' || window.location.port === '5174';
    return isDev ? `http://localhost:3000${path}` : path;
  };

  const fetchData = async () => {
    const token = localStorage.getItem('skywatch_token');
    try {
      if (activeTab === 'personnel') {
        const res = await fetch(getApiUrl('/api/admin/users'), { headers: { 'auth-token': token || '' } });
        if (res.ok) setUsers(await res.json());
      } else if (activeTab === 'sources') {
        const res = await fetch(getApiUrl('/api/sources'));
        if (res.ok) setSources(await res.json());
      }
    } catch (e) { console.error(e); }
  };

  const addSource = async () => {
    if (!newSourceName.trim()) return;
    const token = localStorage.getItem('skywatch_token');
    try {
      const res = await fetch(getApiUrl('/api/admin/sources'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'auth-token': token || '' },
        body: JSON.stringify({ name: newSourceName.replace('@', ''), type: 'telegram' })
      });
      if (res.ok) {
        setNewSourceName('');
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const deleteSource = async (id: string) => {
    const token = localStorage.getItem('skywatch_token');
    try {
      await fetch(getApiUrl(`/api/admin/sources/${id}`), {
        method: 'DELETE',
        headers: { 'auth-token': token || '' }
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const updateRole = async (userId: string, newRole: string) => {
    const token = localStorage.getItem('skywatch_token');
    try {
      await fetch(getApiUrl(`/api/admin/users/${userId}/role`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'auth-token': token || '' },
        body: JSON.stringify({ role: newRole })
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden flex flex-col border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-6 bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-500/20 rounded-xl"><ShieldAlert size={24} className="text-sky-400" /></div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest text-white">Command Center</h2>
              <div className="flex gap-4 mt-2">
                <button onClick={() => setActiveTab('events')} className={`text-[10px] font-bold uppercase flex items-center gap-2 transition-all ${activeTab === 'events' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}><Database size={10} /> Air Assets</button>
                <button onClick={() => setActiveTab('personnel')} className={`text-[10px] font-bold uppercase flex items-center gap-2 transition-all ${activeTab === 'personnel' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}><Users size={10} /> Personnel</button>
                <button onClick={() => setActiveTab('sources')} className={`text-[10px] font-bold uppercase flex items-center gap-2 transition-all ${activeTab === 'sources' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}><Radio size={10} /> Sources</button>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'events' && (
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                <tr><th className="pb-4">Asset</th><th className="pb-4">Location</th><th className="pb-4">Source</th><th className="pb-4 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {events.map(e => (
                  <tr key={e.id} className="hover:bg-white/5"><td className="py-4"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${e.type === 'missile' ? 'bg-rose-500' : 'bg-sky-400'}`} /><span className="font-black uppercase">{e.type}</span></div></td><td className="py-4 text-emerald-400 font-bold">{e.region}</td><td className="py-4 text-slate-400 italic">@{e.source}</td><td className="py-4 text-right"><button onClick={() => onDelete(e.id)} className="p-2 text-rose-500/50 hover:text-rose-500"><Trash2 size={16} /></button></td></tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'personnel' && (
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                <tr><th className="pb-4">Email</th><th className="pb-4">Role</th><th className="pb-4 text-right">Control</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-white/5"><td className="py-4 text-white font-bold">{u.email}</td><td className="py-4"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-500/20 text-slate-400'}`}>{u.role}</span></td><td className="py-4 text-right flex justify-end gap-2">{u.role === 'admin' ? <button onClick={() => updateRole(u.id, 'user')} className="p-2 text-amber-500/50 hover:text-amber-500"><ShieldOff size={16} /></button> : <button onClick={() => updateRole(u.id, 'admin')} className="p-2 text-emerald-500/50 hover:text-emerald-500"><Shield size={16} /></button>}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'sources' && (
            <div className="space-y-6">
              <div className="flex gap-3">
                <input type="text" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} placeholder="Telegram channel name..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
                <button onClick={addSource} className="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs uppercase"><Plus size={16} /> Add Source</button>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500 uppercase font-black tracking-widest border-b border-white/5">
                  <tr><th className="pb-4">Channel</th><th className="pb-4">Type</th><th className="pb-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sources.map(s => (
                    <tr key={s.id} className="hover:bg-white/5"><td className="py-4 font-bold text-sky-400 flex items-center gap-2"><Link size={12} className="text-slate-500"/> @{s.name}</td><td className="py-4 text-slate-400 uppercase font-black text-[9px]">{s.type}</td><td className="py-4 text-right"><button onClick={() => deleteSource(s.id)} className="p-2 text-rose-500/50 hover:text-rose-500"><Trash2 size={16} /></button></td></tr>
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
