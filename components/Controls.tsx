
import React from 'react';
import { TargetType, FilterState } from '../types';
import { Filter, Activity, Eye, EyeOff } from 'lucide-react';

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
    <div className="absolute top-16 left-4 z-[1000] flex flex-col gap-2 max-w-[200px] pointer-events-none">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-2xl shadow-2xl pointer-events-auto border-l-2 border-l-sky-500">
        <div className="flex items-center gap-2 mb-2 text-slate-200 border-b border-slate-800 pb-2">
          <Filter size={14} className="text-sky-400" />
          <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
        </div>
        
        <div className="flex flex-col gap-1.5">
          {Object.values(TargetType).map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-[9px] font-black transition-all uppercase tracking-wider ${
                filters.types.includes(type) 
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.05)]' 
                  : 'bg-slate-800/40 text-slate-600 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2">
                <div className={`w-1 h-1 rounded-full ${filters.types.includes(type) ? 'bg-sky-500 animate-pulse' : 'bg-slate-700'}`} />
                {type}
              </span>
              {filters.types.includes(type) && <Activity size={10} className="opacity-50" />}
            </button>
          ))}

          <div className="h-px bg-slate-800 my-1" />

          <button
            onClick={() => setFilters({ ...filters, showTest: !filters.showTest })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
              filters.showTest ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'bg-slate-800/40 text-slate-600'
            }`}
          >
            {filters.showTest ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>{filters.showTest ? 'Test Mode' : 'Real Mode'}</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-2 rounded-xl pointer-events-auto">
        <p className="text-[8px] text-slate-500 leading-tight uppercase font-bold text-center">
          OSINT Accuracy: Low
        </p>
      </div>
    </div>
  );
};

export default Controls;
