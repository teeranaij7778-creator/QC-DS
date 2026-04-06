import React from 'react';
import { Activity, CheckSquare, Square } from 'lucide-react';
import { getResultColor, formatResultDisplay } from './utils';

export const Logo = () => (
  <div className="flex items-center gap-3">
    <div className="relative">
      <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-300">
        <Activity size={18} className="text-white" />
      </div>
      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
    </div>
    <div>
      <div className="text-sm font-black tracking-widest text-slate-800 uppercase leading-none">INTAGE</div>
      <div className="text-[9px] font-bold text-slate-400 tracking-[0.2em] uppercase leading-none mt-0.5">Firebase Edition</div>
    </div>
  </div>
);

export const StatusBadge = ({ result }) => {
  const color = getResultColor(result);
  const label = formatResultDisplay(result);
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase"
      style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}>
      {label}
    </span>
  );
};

export const FilterSection = ({ title, items, selectedItems, onToggle, onSelectAll, onClear, maxH = "max-h-40" }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</label>
      <div className="flex gap-3">
        <button onClick={onSelectAll} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600">เลือกทั้งหมด</button>
        <button onClick={onClear} className="text-[10px] font-bold text-slate-400 hover:text-rose-500">ล้าง</button>
      </div>
    </div>
    <div className={`overflow-y-auto space-y-1 ${maxH}`}>
      {items.map(item => (
        <div key={item} onClick={() => onToggle(item)}
          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-[11px] font-semibold transition-all
            ${selectedItems.includes(item) ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'hover:bg-slate-50 text-slate-500 border border-transparent'}`}>
          {selectedItems.includes(item)
            ? <CheckSquare size={13} className="text-indigo-600 shrink-0" />
            : <Square size={13} className="shrink-0 text-slate-300" />}
          <span className="truncate">{formatResultDisplay(item)}</span>
        </div>
      ))}
    </div>
  </div>
);