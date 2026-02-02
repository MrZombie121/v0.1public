
import React from 'react';
import { TargetType, FilterState } from '../types';
import { Filter, Activity, Eye, EyeOff, LayoutGrid } from 'lucide-react';

interface ControlsProps {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
}

const Controls: React.FC<ControlsProps> = ({ filters, setFilters }) => {
  const toggleType = (type: TargetType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    setFilters({ ...filters, types: newTypes });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="glass-panel p-2 px-3 rounded-xl flex items-center gap-4 shadow-xl border border-white/5">
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <LayoutGrid size={14} className="text-sky-500" />
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">HUD Layout</span>
        </div>
        
        <div className="flex gap-1.5">
          {Object.values(TargetType).map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all uppercase tracking-wider flex items-center gap-2 border ${
                filters.types.includes(type) 
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/40 shadow-lg shadow-sky-500/5' 
                  : 'bg-white/5 text-slate-500 border-transparent hover:bg-white/10'
              }`}
            >
              <div className={`w-1 h-1 rounded-full ${filters.types.includes(type) ? 'bg-sky-500 animate-pulse' : 'bg-slate-700'}`} />
              {type}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-white/10" />

        <button
          onClick={() => setFilters({ ...filters, showTest: !filters.showTest })}
          className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all border ${
            filters.showTest 
              ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' 
              : 'bg-white/5 text-slate-500 border-transparent'
          }`}
        >
          {filters.showTest ? <Eye size={12} /> : <EyeOff size={12} />}
          <span>{filters.showTest ? 'TEST: ON' : 'TEST: OFF'}</span>
        </button>
      </div>
      <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest pl-2">
        Tactical Grid v1.0 // System Verified
      </div>
    </div>
  );
};

export default Controls;
