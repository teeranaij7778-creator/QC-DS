import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, BarChart2, Table2, AlertCircle, Eye, Search, X, Rows3, Hash } from 'lucide-react';
import { useFirebase } from './useFirebase';
import { calculateCrosstab } from './dataProcessing.js';

const ANIMATION_STYLES = `
  @keyframes gradient-x { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .animate-gradient-x { background-size: 200% 200%; animation: gradient-x 4s ease infinite; }
`;

// ── Crosstab Table ──
const CrosstabTable = ({ data, rowVar, colVar, totalOnly = false }) => {
  if (!data) return null;
  const { rowCategories, colCategories, table, rowTotals, colTotals, totalCount, grandTotalAverage, pctType, aggType } = data;

  // ── Total Only Mode: แสดงแค่แถว Total ──
  if (totalOnly) {
    return (
      <div className="w-full overflow-auto">
        <table className="w-full text-xs border-separate border-spacing-0 min-w-max">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-r border-slate-200 bg-slate-50">{colVar}</th>
              {colCategories.map(c => (
                <th key={c} className="px-3 py-3 text-center text-[10px] font-black border-b border-slate-200 bg-white text-slate-700 max-w-[120px]">{c}</th>
              ))}
              <th className="px-5 py-3 text-center text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 bg-slate-50 min-w-[70px]">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#842327]/5 border-t border-slate-200">
              <td className="sticky left-0 z-10 px-5 py-4 text-[#842327] font-black text-[13px] uppercase border-r border-slate-200 bg-[#842327]/5">Total</td>
              {colCategories.map(c => (
                <td key={c} className="px-3 py-4 text-center border-r border-slate-200">
                  <div className="font-black text-sm text-slate-700">{aggType === 'average' ? colTotals[c].average : colTotals[c].count}</div>
                  {aggType === 'count' && <div className="text-[10px] text-slate-400">{pctType === 'col' ? '(100.0%)' : `(${totalCount > 0 ? ((colTotals[c].count / totalCount) * 100).toFixed(1) : 0}%)`}</div>}
                </td>
              ))}
              <td className="px-5 py-4 text-center bg-slate-50 border-l border-slate-200">
                <div className="font-black text-[#842327] text-base">{aggType === 'average' ? grandTotalAverage : totalCount}</div>
                {aggType === 'count' && <div className="text-[10px] text-slate-400">(100.0%)</div>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // ── Full Table Mode ──
  return (
    <div className="w-full overflow-auto">
      <table className="w-full text-xs border-separate border-spacing-0 min-w-max">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="sticky left-0 z-20 px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-r border-slate-200 bg-slate-50">{`${rowVar} \\ ${colVar}`}</th>
            {colCategories.map(c => (
              <th key={c} className="px-3 py-3 text-center text-[10px] font-black border-b border-slate-200 bg-white text-slate-700 max-w-[120px]">{c}</th>
            ))}
            <th className="px-5 py-3 text-center text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 bg-slate-50 min-w-[70px]">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rowCategories.map(r => (
            <tr key={r} className="hover:bg-slate-50 transition-colors group">
              <td className="sticky left-0 z-10 px-5 py-3 font-bold text-[13px] text-slate-700 border-r border-slate-200 bg-white group-hover:bg-slate-50 transition-colors">{r}</td>
              {colCategories.map(c => (
                <td key={c} className="px-3 py-3 text-center border-r border-slate-100">
                  <div className="font-black text-sm text-slate-700">{aggType === 'average' ? table[r][c].average : table[r][c].count}</div>
                  {aggType === 'count' && <div className="text-[10px] text-slate-400">({table[r][c].percentage}%)</div>}
                </td>
              ))}
              <td className="px-5 py-3 text-center bg-slate-50 border-l border-slate-200">
                <div className="font-black text-slate-700">{aggType === 'average' ? rowTotals[r].average : rowTotals[r].count}</div>
                {aggType === 'count' && <div className="text-[10px] text-slate-400">{pctType === 'row' ? '(100.0%)' : `(${totalCount > 0 ? ((rowTotals[r].count / totalCount) * 100).toFixed(1) : 0}%)`}</div>}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-100 border-t-2 border-slate-200 font-black">
            <td className="sticky left-0 z-10 px-5 py-3.5 text-[#842327] font-black text-[13px] uppercase border-r border-slate-200 bg-slate-100">Total</td>
            {colCategories.map(c => (
              <td key={c} className="px-3 py-3.5 text-center border-r border-slate-200">
                <div className="font-black text-sm text-slate-700">{aggType === 'average' ? colTotals[c].average : colTotals[c].count}</div>
                {aggType === 'count' && <div className="text-[10px] text-slate-400">{pctType === 'col' ? '(100.0%)' : `(${totalCount > 0 ? ((colTotals[c].count / totalCount) * 100).toFixed(1) : 0}%)`}</div>}
              </td>
            ))}
            <td className="px-5 py-3.5 text-center bg-slate-50 border-l border-slate-200">
              <div className="font-black text-[#842327] text-base">{aggType === 'average' ? grandTotalAverage : totalCount}</div>
              {aggType === 'count' && <div className="text-[10px] text-slate-400">(100.0%)</div>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ── Chart ──
const CrosstabChart = ({ data }) => {
  const colors = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#f97316','#06b6d4','#84cc16','#d946ef','#ec4899','#14b8a6','#f43f5e'];
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis unit={data.aggType === 'count' ? '%' : ''} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px', color: '#64748b' }} iconType="circle" />
          {data.colCategories.map((c, i) => (
            <Bar key={c} dataKey={String(c)} name={String(c)} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Single Report Card ──
const ReportCard = ({ config, rawData }) => {
  const [crosstabData, setCrosstabData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [viewMode, setViewMode] = useState(config.viewMode || 'chart');
  const [totalOnly, setTotalOnly] = useState(false);

  useEffect(() => {
    if (!rawData || rawData.length === 0) return;
    setIsProcessing(true);
    const timer = setTimeout(() => {
      let data = rawData;
      if (config.filterVars?.length > 0 && config.filterValue?.length > 0) {
        const vals = Array.isArray(config.filterValue) ? config.filterValue : [config.filterValue];
        if (vals.length > 0) data = rawData.filter(d => vals.includes(String(d[config.filterVars[0]])));
      }
      const result = calculateCrosstab(data, config.rowVars, config.colVars, config.pctType, config.aggType, config.valueVars);
      setCrosstabData(result);
      setIsProcessing(false);
    }, 80);
    return () => clearTimeout(timer);
  }, [config, rawData]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden hover:shadow-[0_12px_40px_rgba(0,0,0,0.09)] transition-shadow duration-300">
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h3 className="font-black text-slate-800 text-sm truncate">{config.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-slate-400 font-semibold">
              {config.rowVars?.join(' ❯ ')} <span className="text-slate-300 mx-1">×</span> {config.colVars?.join(' ❯ ')}
            </span>
            {config.filterVars?.length > 0 && config.filterValue?.length > 0 && (
              <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase">
                กรอง: {config.filterValue.length} ค่า
              </span>
            )}
          </div>
        </div>
        {/* toggle controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Total Only toggle — แสดงเฉพาะ mode ตาราง */}
          {viewMode === 'table' && (
            <button
              onClick={() => setTotalOnly(p => !p)}
              title={totalOnly ? 'แสดงตารางทั้งหมด' : 'แสดงเฉพาะ Total'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border transition ${
                totalOnly
                  ? 'bg-[#842327] text-white border-[#842327] shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-[#842327]/40 hover:text-[#842327]'
              }`}
            >
              <Hash size={11} />
              {totalOnly ? 'Total Only' : 'Full Table'}
            </button>
          )}
          {/* Chart / Table toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setViewMode('chart')} className={`px-3 py-1 rounded-lg text-[10px] font-black transition ${viewMode === 'chart' ? 'bg-white text-[#842327] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <BarChart2 size={12} />
            </button>
            <button onClick={() => setViewMode('table')} className={`px-3 py-1 rounded-lg text-[10px] font-black transition ${viewMode === 'table' ? 'bg-white text-[#842327] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <Table2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex-1 p-5 min-h-[320px] flex flex-col justify-center">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center gap-3 m-auto">
            <Loader2 size={28} className="animate-spin text-[#842327]" />
            <span className="text-xs text-slate-400 font-semibold">กำลังประมวลผล...</span>
          </div>
        ) : crosstabData ? (
          viewMode === 'chart'
            ? <CrosstabChart data={crosstabData} />
            : <CrosstabTable data={crosstabData} rowVar={config.rowVars?.join(' ❯ ')} colVar={config.colVars?.join(' ❯ ')} totalOnly={totalOnly} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 m-auto text-slate-400">
            <AlertCircle size={24} />
            <span className="text-xs font-semibold">ไม่สามารถประมวลผลข้อมูลได้</span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-semibold">
          {config.aggType === 'average' ? 'ค่าเฉลี่ย (Average)' : `จำนวน · ${config.pctType === 'row' ? 'Row %' : config.pctType === 'col' ? 'Col %' : 'Total %'}`}
        </span>
        {crosstabData && (
          <span className="text-[10px] text-slate-400 font-semibold">{crosstabData.totalCount?.toLocaleString()} records</span>
        )}
      </div>
    </div>
  );
};

// ── Main ReportViewer ──
const ReportViewer = () => {
  const { db, isAuthenticated } = useFirebase();

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(() => {
    try { return localStorage.getItem('active_project_id') || ''; } catch(e) { return ''; }
  });
  const [activeProjectName, setActiveProjectName] = useState('');

  const [publishedViews, setPublishedViews] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [isLoadingViews, setIsLoadingViews] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');

  // โหลดโปรเจกต์
  useEffect(() => {
    if (!db) return;
    getDocs(collection(db, 'projects')).then(snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(console.error);
  }, [db]);

  // โหลดชื่อโปรเจกต์
  useEffect(() => {
    if (!db || !activeProjectId) return;
    getDoc(doc(db, 'projects', activeProjectId)).then(snap => {
      if (snap.exists()) setActiveProjectName(snap.data().name || '');
    }).catch(console.error);
  }, [db, activeProjectId]);

  // โหลด published views
  useEffect(() => {
    if (!db || !activeProjectId) return;
    setIsLoadingViews(true);
    const q = query(collection(db, 'dashboard_views'), where('projectId', '==', activeProjectId), where('published', '==', true));
    getDocs(q).then(snap => {
      const views = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setPublishedViews(views);
      setIsLoadingViews(false);
    }).catch(err => {
      console.error(err);
      setIsLoadingViews(false);
    });
  }, [db, activeProjectId]);

  // โหลด rawData
  useEffect(() => {
    if (!db || !activeProjectId) return;
    setIsLoadingData(true);
    const q = query(collection(db, 'interview_responses'), where('projectId', '==', activeProjectId));
    getDocs(q).then(snap => {
      const data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      setRawData(data);
      setLastUpdated(new Date());
      setIsLoadingData(false);
    }).catch(err => {
      console.error(err);
      setIsLoadingData(false);
    });
  }, [db, activeProjectId]);

  const filteredViews = useMemo(() => {
    if (!search.trim()) return publishedViews;
    return publishedViews.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));
  }, [publishedViews, search]);

  const isLoading = isLoadingViews || isLoadingData;

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans">
      <style>{ANIMATION_STYLES}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-2xl border-b border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-[#842327] flex items-center justify-center shadow-md shadow-[#842327]/25">
                <BarChart2 size={17} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">INTAGE</div>
                <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">Report Viewer</div>
              </div>
            </div>

            <div className="hidden sm:block w-px h-8 bg-slate-200" />

            {/* Project selector */}
            {projects.length > 1 ? (
              <select
                value={activeProjectId}
                onChange={e => setActiveProjectId(e.target.value)}
                className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#842327]/30 transition min-w-0 max-w-[200px]"
              >
                <option value="">— เลือกโปรเจกต์ —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <div className="min-w-0">
                <div className="text-base font-black text-slate-800 truncate">{activeProjectName || 'รายงาน'}</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {lastUpdated && (
              <span className="hidden sm:block text-[10px] text-slate-400 font-semibold">
                อัปเดต {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl">
              <Eye size={12} className="text-indigo-500" />
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">View Only</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8">

        {/* Project not selected */}
        {!activeProjectId ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
              <BarChart2 size={28} className="text-slate-300" />
            </div>
            <p className="font-bold text-slate-500">กรุณาเลือกโปรเจกต์</p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 size={36} className="animate-spin text-[#842327]" />
            <p className="text-sm font-bold text-slate-400">กำลังโหลดข้อมูล...</p>
          </div>
        ) : publishedViews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
              <Eye size={28} className="text-slate-300" />
            </div>
            <p className="font-bold text-slate-500">ยังไม่มีรายงานที่เผยแพร่</p>
            <p className="text-xs text-slate-400">Admin สามารถเผยแพร่รายงานได้จากหน้า Dashboard</p>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">{activeProjectName}</h1>
                <p className="text-sm text-slate-400 mt-1 font-medium">{publishedViews.length} รายงาน · {rawData.length.toLocaleString()} records</p>
              </div>
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหารายงาน..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#842327]/20 focus:border-[#842327]/50 text-slate-700 placeholder:text-slate-400 transition"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Grid ของ Report Cards */}
            {filteredViews.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-semibold text-sm">ไม่พบรายงานที่ค้นหา</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredViews.map(view => (
                  <ReportCard key={view.id} config={view} rawData={rawData} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ReportViewer;
