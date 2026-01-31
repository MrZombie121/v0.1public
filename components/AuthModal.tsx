
import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, AlertCircle, Loader2, ArrowRight, UserPlus, LogIn } from 'lucide-react';

interface AuthModalProps {
  isFirstTime: boolean;
  onSuccess: (user: any, token: string) => void;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isFirstTime, onSuccess, onClose }) => {
  const [isRegistering, setIsRegistering] = useState(isFirstTime);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync state if prop changes
  useEffect(() => {
    setIsRegistering(isFirstTime);
  }, [isFirstTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const isDev = window.location.port === '5173' || window.location.port === '5174';
      const base = isDev ? 'http://localhost:3000' : '';
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      
      const res = await fetch(`${base}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.user, data.token);
      } else {
        setError(data.message || 'Access Denied');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Tactical Node Connection Failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
      <div className="glass-panel w-full max-w-md p-8 rounded-[2rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-sky-500/10 blur-[80px] rounded-full" />
        
        <div className="relative">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className={`p-4 rounded-2xl mb-4 transition-colors ${isRegistering ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}>
              {isRegistering ? <UserPlus size={32} /> : <LogIn size={32} />}
            </div>
            <h2 className="text-xl font-black uppercase tracking-[0.2em] text-white">
              {isFirstTime ? 'Master Node Access' : isRegistering ? 'New Operator' : 'Security Clearance'}
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-2 tracking-widest leading-relaxed">
              {isFirstTime 
                ? 'Create the primary administrative credential' 
                : 'Authentication required for tactical command'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="group">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-1.5 block group-focus-within:text-sky-500 transition-colors">Operator Email</label>
              <input
                type="email"
                required
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@skywatch.gov"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white font-mono text-sm placeholder:text-slate-800 focus:outline-none focus:border-sky-500/40 focus:bg-white/10 transition-all disabled:opacity-50"
              />
            </div>
            
            <div className="group">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-1.5 block group-focus-within:text-sky-500 transition-colors">Command Password</label>
              <input
                type="password"
                required
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white font-mono text-sm placeholder:text-slate-800 focus:outline-none focus:border-sky-500/40 focus:bg-white/10 transition-all disabled:opacity-50"
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className={`w-full font-black uppercase tracking-[0.3em] py-4 rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${
                isRegistering 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20' 
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20'
              } disabled:opacity-50 disabled:active:scale-100`}
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isRegistering ? 'Register Node' : 'Initialize Session'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {!isFirstTime && (
              <button 
                type="button"
                disabled={isLoading}
                onClick={() => setIsRegistering(!isRegistering)}
                className="w-full text-[10px] text-slate-500 hover:text-sky-400 font-bold uppercase tracking-widest transition-all mt-4"
              >
                {isRegistering ? 'Existing Operator? Sign In' : 'Request New Access'}
              </button>
            )}

            {error && (
              <div className="flex items-center gap-3 text-rose-500 text-[10px] font-black uppercase bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </form>

          <button 
            onClick={onClose}
            disabled={isLoading}
            className="w-full mt-8 text-[10px] text-slate-700 hover:text-slate-500 font-black uppercase tracking-[0.3em] transition-all"
          >
            DISCONNECT
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
