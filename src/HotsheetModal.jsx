import React from 'react';
import { FolderOpen, ChevronRight, X, ChevronLeft, Calendar, Loader2, FileSpreadsheet, DownloadCloud } from 'lucide-react';

export const HotsheetModal = ({
  hotsheetPath,
  setHotsheetPath,
  hotsheetAvailableMonths,
  selectedHotsheetMonth,
  setSelectedHotsheetMonth,
  hotsheetLoading,
  hotsheetFolders,
  filteredHotsheetFiles,
  downloadHotsheetFile,
  setShowHotsheetModal
}) => {
  return (
    <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center">
              <FolderOpen size={20} className="text-orange-600"/>
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg tracking-tight">Hotsheet Download</h3>
              <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 mt-0.5 uppercase tracking-wide">
                {hotsheetPath.split('/').map((p, i, arr) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight size={10} className="text-slate-300"/>}
                    <span className={`px-1.5 py-0.5 rounded ${i === arr.length - 1 ? 'bg-slate-200 text-slate-700' : 'cursor-pointer hover:bg-orange-100 hover:text-orange-600 transition'}`}
                      onClick={() => setHotsheetPath(arr.slice(0, i + 1).join('/'))}>
                      {p}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => setShowHotsheetModal(false)} className="p-2 hover:bg-rose-100 hover:text-rose-600 rounded-xl transition text-slate-400">
            <X size={20}/>
          </button>
        </div>

        {/* Toolbar (Back & Filter) */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 h-14">
          {hotsheetPath !== 'Hotsheet' ? (
            <button onClick={() => { const parts = hotsheetPath.split('/'); parts.pop(); setHotsheetPath(parts.join('/')); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition uppercase border border-slate-200">
              <ChevronLeft size={14}/> Back
            </button>
          ) : <div/>}

          {hotsheetAvailableMonths.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                <Calendar size={13} className="text-indigo-500"/>
                <select value={selectedHotsheetMonth} onChange={e => setSelectedHotsheetMonth(e.target.value)}
                  className="bg-transparent text-[11px] font-black text-indigo-700 outline-none cursor-pointer uppercase tracking-wider appearance-none pr-2">
                  <option value="">ALL MONTHS</option>
                  {hotsheetAvailableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {hotsheetLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 size={30} className="animate-spin text-orange-500"/>
              <p className="text-xs font-black tracking-widest uppercase">Loading Storage...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Folders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {hotsheetFolders.map(folder => (
                  <div key={folder} onClick={() => setHotsheetPath(`${hotsheetPath}/${folder}`)} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-orange-300 hover:bg-orange-50 hover:shadow-md transition-all group">
                    <FolderOpen size={24} className="text-orange-400 group-hover:text-orange-600"/>
                    <span className="font-black text-slate-700 text-sm group-hover:text-orange-700">{folder}</span>
                  </div>
                ))}
              </div>
              {hotsheetFolders.length > 0 && filteredHotsheetFiles.length > 0 && <hr className="border-slate-200 my-6" />}
              {/* Files */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredHotsheetFiles.map(file => {
                  const match = file.name.match(/_(\d{2})(\d{2})(\d{4})\./);
                  return (
                    <div key={file.name} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0"><FileSpreadsheet size={18} className="text-emerald-600"/></div>
                        <div className="truncate pr-4"><p className="font-bold text-slate-700 text-xs truncate group-hover:text-emerald-600 transition-colors" title={file.name}>{file.name}</p><p className="text-[9px] text-slate-400 font-black tracking-wider uppercase mt-1">{match ? `Date: ${match[2]}/${match[1]}/${match[3]}` : 'Excel Document'}</p></div>
                      </div>
                      <button onClick={() => downloadHotsheetFile(file.fullPath, file.url, file.name)} className="shrink-0 flex items-center justify-center w-10 h-10 bg-slate-50 hover:bg-emerald-500 hover:text-white text-slate-400 rounded-xl transition border border-slate-200 hover:border-emerald-500"><DownloadCloud size={16}/></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};