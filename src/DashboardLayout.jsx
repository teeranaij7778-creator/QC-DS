import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { RefreshCw, X, DownloadCloud, Loader2, ArrowLeft, BarChart2, Users, Settings, Filter, Table2, PieChart, Search, Save, Trash2, LayoutDashboard, CheckSquare, Square, FileUp, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch, query, where, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { useFirebase } from './useFirebase';
import { calculateCrosstab } from './dataProcessing.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

// --- 1. กล่องตัวแปรที่สามารถลากได้ (Draggable) ---
const DraggableVariable = ({ id, name }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
         className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-red-500/50 hover:shadow-[0_4px_12px_rgba(239,68,68,0.15)] hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 group">
      <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 group-hover:bg-red-500 transition-colors" />
      <span className="text-xs font-bold text-neutral-400 truncate group-hover:text-white transition-colors">{name}</span>
    </div>
  );
};

// --- 2. พื้นที่สำหรับวางตัวแปร (Droppable Area) ---
const DroppableArea = ({ id, title, items, onRemoveItem, children }) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  const bg = isOver ? 'bg-red-500/10 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]' : 'bg-neutral-900/40 border-neutral-700/50 hover:border-neutral-600/60 hover:bg-neutral-800/40';

  return (
    <div ref={setNodeRef} className={`border-2 border-dashed rounded-2xl p-5 min-h-[140px] transition-all flex flex-col ${bg}`}>
      <h3 className="font-black text-neutral-500 text-[10px] uppercase tracking-widest mb-3">{title}</h3>
      <div className="flex-1 flex flex-wrap content-start gap-2">
        {items.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600">
            <p className="text-xs font-bold">ลากตัวแปรมาวางที่นี่</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item} className="bg-neutral-800 border border-neutral-700 text-red-400 pl-2.5 pr-1.5 py-1.5 rounded-lg shadow-sm text-xs font-black flex items-center gap-1.5 animate-in zoom-in duration-200 group">
              <span className="text-[9px] bg-neutral-900 px-1.5 py-0.5 rounded-md text-red-500">{index + 1}</span>
              {item}
              <button onClick={(e) => { e.stopPropagation(); onRemoveItem(id, item); }} className="ml-1 p-0.5 text-red-500/70 hover:text-red-400 hover:bg-red-500/20 rounded-md transition-colors" title="ลบตัวแปร">
                <X size={12} />
              </button>
            </div>
          ))
        )}
        {children}
      </div>
    </div>
  );
};

// --- Component กราฟแท่ง ---
const CrosstabChart = ({ data }) => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'];
  return (
    <div className="w-full h-96 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
          <XAxis dataKey="name" tick={{fontSize: 11, fill: '#737373'}} axisLine={false} tickLine={false} />
          <YAxis unit={data.aggType === 'count' ? "%" : ""} tick={{fontSize: 11, fill: '#737373'}} axisLine={false} tickLine={false} />
          <Tooltip cursor={{fill: '#171717'}} contentStyle={{backgroundColor: '#0a0a0a', borderColor: '#262626', color: '#fafafa', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)'}} />
          <Legend wrapperStyle={{fontSize: '12px', paddingTop: '20px', color: '#737373'}} iconType="circle" />
          {data.colCategories.map((c, i) => (
            <Bar key={c} dataKey={String(c)} name={String(c)} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- 3. Component สำหรับแสดงตาราง Crosstab ---
const CrosstabTable = ({ data, rowVar, colVar }) => {
  if (!data) {
    return <p className="text-neutral-500">เกิดข้อผิดพลาดในการประมวลผลข้อมูล</p>;
  }

  const { rowCategories, colCategories, table, rowTotals, colTotals, totalCount, grandTotalAverage, pctType, aggType } = data;

  return (
    <div className="w-full overflow-auto p-1">
      <table className="w-full text-xs border-separate border-spacing-0 min-w-max">
        <thead className="sticky top-0 z-20 bg-neutral-900/90 backdrop-blur-md shadow-sm">
          <tr>
            <th className="sticky left-0 z-30 px-6 py-3 text-left text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-r border-neutral-800 bg-neutral-950/95 backdrop-blur-md shadow-[2px_0_5px_-2px_rgba(0,0,0,0.8)]">{`${rowVar} \\ ${colVar}`}</th>
            {colCategories.map(c => (
              <th key={c} className="px-3 py-3 text-center text-[10px] font-black border-b border-neutral-800 bg-neutral-900/95 backdrop-blur-md max-w-[120px] text-neutral-300">{c}</th>
            ))}
            <th className="px-6 py-3 text-center text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-800 bg-neutral-800/95 backdrop-blur-md min-w-[80px]">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/50">
          {rowCategories.map(r => (
            <tr key={r} className="hover:bg-neutral-800/40 transition-colors group">
              <td className="sticky left-0 z-10 px-6 py-3.5 font-bold text-[13px] text-neutral-300 border-r border-neutral-800 bg-neutral-900 group-hover:bg-neutral-800/80 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">{r}</td>
              {colCategories.map(c => (
                <td key={c} className="px-3 py-3.5 text-center border-r border-neutral-800/50">
                  <div className="font-black text-sm text-neutral-200">{aggType === 'average' ? table[r][c].average : table[r][c].count}</div>
                  {aggType === 'count' && <div className="text-[10px] text-neutral-500">({table[r][c].percentage}%)</div>}
                </td>
              ))}
              <td className="px-6 py-3.5 text-center bg-neutral-950 border-l border-neutral-800">
                <div className="font-black text-neutral-200">{aggType === 'average' ? rowTotals[r].average : rowTotals[r].count}</div>
                {aggType === 'count' && <div className="text-[10px] text-neutral-500">{pctType==='row' ? '(100.0%)' : `(${totalCount > 0 ? ((rowTotals[r].count / totalCount) * 100).toFixed(1) : 0}%)`}</div>}
              </td>
            </tr>
          ))}
          <tr className="bg-neutral-800 border-t-2 border-neutral-700 font-black">
            <td className="sticky left-0 z-10 px-6 py-4 text-red-500 font-black text-[13px] uppercase border-r border-neutral-700 bg-neutral-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">Total</td>
            {colCategories.map(c => (
              <td key={c} className="px-3 py-4 text-center border-r border-neutral-700 text-neutral-200">
                <div className="font-black text-sm text-neutral-200">{aggType === 'average' ? colTotals[c].average : colTotals[c].count}</div>
                {aggType === 'count' && <div className="text-[10px] text-neutral-400">{pctType==='col' ? '(100.0%)' : `(${totalCount > 0 ? ((colTotals[c].count / totalCount) * 100).toFixed(1) : 0}%)`}</div>}
              </td>
            ))}
            <td className="px-6 py-4 text-center bg-neutral-900 border-l border-neutral-700">
              <div className="font-black text-red-500 text-base">{aggType === 'average' ? grandTotalAverage : totalCount}</div>
              {aggType === 'count' && <div className="text-[10px] text-neutral-400">(100.0%)</div>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// --- Component สำหรับแสดง กราฟ/ตาราง ที่ถูกบันทึกไว้ ---
const SavedViewCard = ({ config, rawData, onClose }) => {
  const [crosstabData, setCrosstabData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    if (rawData && rawData.length > 0) {
      setIsProcessing(true);
      const timer = setTimeout(() => {
        let dataToProcess = rawData;
        if (config.filterVars.length > 0 && config.filterValue) {
          const fVals = Array.isArray(config.filterValue) ? config.filterValue : [config.filterValue];
          if (fVals.length > 0) {
            dataToProcess = rawData.filter(d => fVals.includes(String(d[config.filterVars[0]])));
          }
        }
        const result = calculateCrosstab(dataToProcess, config.rowVars, config.colVars, config.pctType, config.aggType, config.valueVars);
        setCrosstabData(result);
        setIsProcessing(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [config, rawData]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl flex flex-col h-[450px] animate-in zoom-in-95 duration-300">
      <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950 rounded-t-2xl shrink-0">
        <h4 className="font-black text-neutral-200 text-sm truncate flex-1 pr-4" title={config.name}>{config.name}</h4>
        <button onClick={() => onClose(config.id)} className="text-neutral-500 hover:text-red-400 hover:bg-neutral-900 p-1.5 rounded-lg transition-colors shrink-0" title="ซ่อนมุมมองนี้">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 p-4 overflow-auto flex flex-col relative">
        {isProcessing ? (
          <Loader2 className="animate-spin m-auto text-red-500" size={32} />
        ) : crosstabData ? (
          config.viewMode === 'chart' 
            ? <CrosstabChart data={crosstabData} /> 
            : <CrosstabTable data={crosstabData} rowVar={config.rowVars.join(' ❯ ')} colVar={config.colVars.join(' ❯ ')} />
        ) : (
          <p className="m-auto text-sm font-bold text-red-400">เกิดข้อผิดพลาดในการประมวลผล</p>
        )}
      </div>
    </div>
  );
};

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { db, storage, userRole } = useFirebase(); // ดึง connection database และ storage
  
  const [activeProjectId, setActiveProjectId] = useState(() => {
    try { return localStorage.getItem('active_project_id') || ''; } catch(e) { return ''; }
  });
  const [activeProjectName, setActiveProjectName] = useState('');

  const [variables, setVariables] = useState([]); // เก็บรายชื่อ Header จาก Sheet
  const [rawData, setRawData] = useState([]); // เก็บข้อมูลดิบทั้งหมด
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [rowVars, setRowVars] = useState([]);
  const [colVars, setColVars] = useState([]);
  const [valueVars, setValueVars] = useState([]);
  const [filterVars, setFilterVars] = useState([]);
  const [filterValue, setFilterValue] = useState([]);

  const [crosstabData, setCrosstabData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [pctType, setPctType] = useState('row');
  const [aggType, setAggType] = useState('count');
  const [viewMode, setViewMode] = useState('chart'); // 'chart' or 'table'

  // ข้อมูลมุมมองที่บันทึกไว้จาก Firebase
  const [savedViews, setSavedViews] = useState([]);
  const [selectedViewIds, setSelectedViewIds] = useState([]); // เก็บ ID ของมุมมองที่เลือกเปิดดู
  const [isFetchingViews, setIsFetchingViews] = useState(true);
  const [sortMode, setSortMode] = useState('grouped'); // 'original', 'az', 'grouped'

  const [variableSearch, setVariableSearch] = useState("");

  const filteredVariables = React.useMemo(() => {
    if (!variableSearch) return variables;
    return variables.filter(v => v.toLowerCase().includes(variableSearch.toLowerCase()));
  }, [variables, variableSearch]);

  // --- จัดหมวดหมู่ตัวแปร ---
  const categorizedVariables = React.useMemo(() => {
    if (!filteredVariables) return {};
    if (sortMode === 'az') return { 'เรียงตามตัวอักษร A-Z': [...filteredVariables].sort() };
    if (sortMode === 'original') return { 'เรียงตามคอลัมน์ต้นฉบับ': filteredVariables };
    
    const groups = {
      '📅 ข้อมูลระบบ & วันที่': [],
      '👤 ข้อมูลพนักงาน': [],
      '⭐ ข้อมูลตรวจประเมิน (QC)': [],
      '📝 ตัวแปรคำถาม': [],
      '📦 ตัวแปรอื่นๆ': []
    };
    
    filteredVariables.forEach(v => {
      const lower = String(v).toLowerCase();
      if (/(date|month|time|วัน|เวลา|touchpoint|เดือน)/.test(lower)) groups['📅 ข้อมูลระบบ & วันที่'].push(v);
      else if (/(agent|interviewer|name|sup|พนักงาน|หัวหน้า|รหัส|ผู้สัมภาษณ์)/.test(lower)) groups['👤 ข้อมูลพนักงาน'].push(v);
      else if (/(result|type|comment|audio|ผล|เสียง|คอมเมนต์|ประเภท|สถานะ|evaluations)/.test(lower)) groups['⭐ ข้อมูลตรวจประเมิน (QC)'].push(v);
      else if (/^(q\d+|p\d+|criteria|ข้อ)/.test(lower)) groups['📝 ตัวแปรคำถาม'].push(v);
      else groups['📦 ตัวแปรอื่นๆ'].push(v);
    });
    
    Object.keys(groups).forEach(k => { if(groups[k].length === 0) delete groups[k]; });
    return groups;
  }, [filteredVariables, sortMode]);

  // สกัดตัวเลือกย่อยของ Filter ออกมาอัตโนมัติ
  const filterOptions = React.useMemo(() => {
    if (!Array.isArray(filterVars) || filterVars.length === 0 || !Array.isArray(rawData) || rawData.length === 0) return [];
    return [...new Set(rawData.map(item => item[filterVars[0]]).filter(v => v !== null && v !== undefined && v !== ''))].sort();
  }, [filterVars, rawData]);

  // เมื่อลาก Filter ใหม่มาลง ให้ตั้งค่าเริ่มต้นเป็นค่าแรกอัตโนมัติ
  useEffect(() => {
    if (filterVars.length > 0 && filterOptions.length > 0 && filterValue.length === 0) {
      setFilterValue(filterOptions.map(String));
    }
  }, [filterOptions]);

  useEffect(() => {
    if(db && activeProjectId) {
      getDoc(doc(db, 'projects', activeProjectId)).then(snap => {
        if(snap.exists()) setActiveProjectName(snap.data().name);
      }).catch(console.error);
    }
  }, [db, activeProjectId]);


  const fetchData = async () => {
    if (!db || !activeProjectId) {
      setError("กำลังเชื่อมต่อ Database...");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      
      // ดึงข้อมูลจาก Collection 'interview_responses'
      const q = query(collection(db, "interview_responses"), where("projectId", "==", activeProjectId));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ _id: doc.id, ...doc.data() }); // นำ id ไปซ่อนไว้ใน _id เผื่อใช้
      });
      
      if (data && data.length > 0) {
        setRawData(data); // เก็บข้อมูลเตรียมไว้ทำตาราง/กราฟ
        // ดึงชื่อตัวแปรจาก properties (ยกเว้น _id)
        const headers = Object.keys(data[0]).filter(key => key !== '_id' && key.trim() !== '');
        setVariables(headers);
      } else {
        setError("ยังไม่มีข้อมูลในระบบ (interview_responses ว่างเปล่า)");
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("เกิดข้อผิดพลาดในการดึงข้อมูลจาก Firebase: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- ดึงข้อมูลมุมมองที่บันทึกไว้จาก Firebase ---
  const fetchSavedViews = async () => {
    if (!db || !activeProjectId) return;
    setIsFetchingViews(true);
    try {
      const q = query(collection(db, "dashboard_views"), where("projectId", "==", activeProjectId));
      const snap = await getDocs(q);
      const views = [];
      snap.forEach(document => views.push({ id: document.id, ...document.data() }));
      // เรียงลำดับตามเวลาสร้างล่าสุด
      setSavedViews(views.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch (err) {
      console.error("Error fetching saved views:", err);
    } finally {
      setIsFetchingViews(false);
    }
  };

  // --- คำนวณ Crosstab เมื่อตัวแปรเปลี่ยน ---
  useEffect(() => {
    if (rowVars.length > 0 && colVars.length > 0 && rawData.length > 0) {
      setIsProcessing(true);
      // ใช้ Timeout เพื่อให้ UI แสดง "กำลังประมวลผล" ก่อนเริ่มคำนวณจริง
      const timer = setTimeout(() => {
        let dataToProcess = rawData;
        // ถ้ามีการระบุ Filter ให้ทำการกรองข้อมูลทิ้งก่อนนำไปคำนวณ
        if (filterVars.length > 0 && filterValue.length > 0) {
          dataToProcess = rawData.filter(d => filterValue.includes(String(d[filterVars[0]])));
        }
        const result = calculateCrosstab(dataToProcess, rowVars, colVars, pctType, aggType, valueVars);
        setCrosstabData(result);
        setIsProcessing(false);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setCrosstabData(null);
    }
  }, [rowVars, colVars, valueVars, filterVars, filterValue, rawData, pctType, aggType]);

  // Fetch ข้อมูลเมื่อโหลด Component และ db พร้อมทำงาน
  useEffect(() => {
    if (db) {
      fetchData();
      fetchSavedViews();
    }
  }, [db]);

  // เมื่อปล่อยเมาส์ (Drag End)
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return; // ลากไปปล่อยที่อื่นที่ไม่ใช่เป้าหมาย

    const variableName = active.id;
    if (over.id === 'row-zone' && !rowVars.includes(variableName)) {
      setRowVars([...rowVars, variableName]); // เพิ่มต่อท้ายแถว
    } else if (over.id === 'col-zone' && !colVars.includes(variableName)) {
      setColVars([...colVars, variableName]); // เพิ่มต่อท้ายคอลัมน์
    } else if (over.id === 'value-zone' && !valueVars.includes(variableName)) {
      setValueVars([variableName]); // ให้มีตัวเดียวสำหรับคำนวณค่าเฉลี่ย
    } else if (over.id === 'filter-zone' && !filterVars.includes(variableName)) {
      setFilterVars([variableName]); // Filter ให้มีแค่ 1 ตัวแปรพอเพื่อความไม่ซับซ้อน
      setFilterValue([]); // Reset ค่า dropdown เพื่อให้ useEffect เลือกทั้งหมดอัตโนมัติ
    }
  };

  // --- ฟังก์ชันสำหรับลบตัวแปรออกจากกล่อง ---
  const handleRemoveVariable = (zoneId, variableName) => {
    if (zoneId === 'row-zone') setRowVars(rowVars.filter(v => v !== variableName));
    if (zoneId === 'col-zone') setColVars(colVars.filter(v => v !== variableName));
    if (zoneId === 'value-zone') setValueVars([]);
    if (zoneId === 'filter-zone') {
      setFilterVars([]);
      setFilterValue([]);
    }
  };

  // --- ฟังก์ชันสำหรับบันทึกมุมมองปัจจุบัน ---
  const handleSaveView = async () => {
    if (rowVars.length === 0 || colVars.length === 0) {
      alert("กรุณาลากตัวแปรลงในช่อง แกน Y (Rows) และ แกน X (Columns) ให้ครบก่อนบันทึก");
      return;
    }
    
    const defaultName = `${rowVars.join('/')} × ${colVars.join('/')} ${filterValue.length > 0 ? `(กรอง: ${filterValue.length} ค่า)` : ''}`;
    const viewName = prompt("ตั้งชื่อสำหรับมุมมอง (Report) นี้:", defaultName);
    
    if (!viewName) return; // กดยกเลิก

    const newView = {
      projectId: activeProjectId,
      name: viewName,
      rowVars, colVars, valueVars, filterVars, filterValue, pctType, aggType, viewMode,
      createdAt: Date.now()
    };

    try {
      const docRef = await addDoc(collection(db, "dashboard_views"), newView);
      const savedViewWithId = { id: docRef.id, ...newView };
      setSavedViews([savedViewWithId, ...savedViews]); // เอาของใหม่ไว้บนสุด
      setSelectedViewIds([...selectedViewIds, docRef.id]); // สั่งให้เปิดดูกราฟนี้อัตโนมัติ
    } catch (err) {
      console.error("Error saving view:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกมุมมอง");
    }
  };

  const handleDeleteSavedView = async (id, name) => {
    if (!window.confirm(`ยืนยันการลบมุมมอง: ${name} หรือไม่?`)) return;
    try {
      await deleteDoc(doc(db, "dashboard_views", id));
      setSavedViews(savedViews.filter(v => v.id !== id));
      setSelectedViewIds(selectedViewIds.filter(vId => vId !== id));
    } catch (err) {
      console.error("Error deleting view:", err);
    }
  };

  // --- ฟังก์ชันสำหรับดาวน์โหลดตาราง Crosstab ปัจจุบันเป็น Excel ---
  const handleExportExcel = () => {
    if (!crosstabData) return;
    const { rowCategories, colCategories, table, rowTotals, colTotals, totalCount, grandTotalAverage } = crosstabData;
    const aoa = []; // Array of Arrays
    const rowTitle = rowVars.join(' ❯ ');
    const colTitle = colVars.join(' ❯ ');
    
    // Header Row
    aoa.push([`${rowTitle} \\ ${colTitle}`, ...colCategories, 'Total']);
    
    // Data Rows
    rowCategories.forEach(r => {
      const row = [r];
      colCategories.forEach(c => row.push(aggType === 'average' ? table[r][c].average : table[r][c].count));
      row.push(aggType === 'average' ? rowTotals[r].average : rowTotals[r].count);
      aoa.push(row);
    });
    
    // Footer Row (Total)
    const footer = ['Total'];
    colCategories.forEach(c => footer.push(aggType === 'average' ? colTotals[c].average : colTotals[c].count));
    footer.push(aggType === 'average' ? grandTotalAverage : totalCount);
    aoa.push(footer);
    
    // Generate and Download File
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Crosstab Report");
    XLSX.writeFile(wb, `Dashboard_Export_${activeProjectName || 'Report'}_${new Date().toISOString().slice(0,10)}.xlsx`);
    
    showNotif('success', 'ส่งออกไฟล์ Excel สำเร็จ!');
  };

  // ── Notify helper ──
  const showNotif = (type, message) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const [notifications, setNotifications] = useState([]);

  // Ref สำหรับ File Input ที่ซ่อนอยู่
  const fileInputRef = React.useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    showNotif('info', `กำลังอัปโหลดไฟล์ "${file.name}" ไปยัง Storage...`);

    if (!storage) {
      showNotif('error', "ไม่พบการเชื่อมต่อ Firebase Storage");
      setIsUploading(false);
      return;
    }

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `uploads/excel/${activeProjectId}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload error:", error);
          showNotif('error', "อัปโหลดไฟล์ไม่สำเร็จ: " + error.message);
          setIsUploading(false);
          setUploadProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
        () => {
          showNotif('success', `✅ โยนไฟล์เข้า Storage สำเร็จ! (ระบบกำลังประมวลผลเบื้องหลัง)`);
          setIsUploading(false);
          setUploadProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      );
    } catch (err) {
      console.error("Error initiating upload:", err);
      showNotif('error', "เกิดข้อผิดพลาด: " + err.message);
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-300 font-sans p-4 md:p-6 flex flex-col overflow-y-auto selection:bg-red-500/30 selection:text-white">
      
      {/* Global Notification */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
        {notifications.map(notif => (
          <div key={notif.id} className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all animate-in slide-in-from-bottom-2 fade-in duration-300
            ${notif.type==='error' ? 'bg-red-950/90 border-red-900/50 text-red-200' : 'bg-neutral-800/90 border-neutral-700/50 text-white'}`}>
            {notif.type==='error' ? <AlertCircle size={16}/> : <CheckCircle size={16} className="text-red-500"/>}
            <span className="text-sm font-semibold">{notif.message}</span>
            <button onClick={()=>setNotifications(p=>p.filter(n=>n.id!==notif.id))} className="ml-2 opacity-50 hover:opacity-100 text-neutral-400"><X size={13}/></button>
          </div>
        ))}
      </div>
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls" style={{ display: 'none' }} />

      <div className="max-w-screen-2xl mx-auto w-full space-y-5 flex-1 flex flex-col">
        
        {/* Header */}
        <header className="sticky top-0 z-40 bg-neutral-900/80 backdrop-blur-xl rounded-2xl border border-neutral-800 shadow-xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-neutral-800 text-neutral-400 rounded-xl transition">
              <ArrowLeft size={18} />
            </button>
            <div className="hidden sm:block w-px h-8 bg-neutral-800" />
            <div>
              <h1 className="font-black text-white text-lg tracking-tight flex items-center gap-2">
                {activeProjectName || 'Interview Data Dashboard'}
              </h1>
              <p className="text-[10px] text-neutral-500 font-semibold mt-0.5 uppercase tracking-widest">
                ลากตัวแปรเพื่อสร้าง Crosstab
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading || isLoading} className="flex items-center gap-1.5 px-4 py-2 bg-neutral-950 text-red-400 border border-neutral-800 hover:border-red-500/50 hover:bg-red-500/10 rounded-xl shadow-sm text-xs font-black transition disabled:opacity-50">
              <FileUp size={13} className={isUploading ? "animate-bounce" : ""} />
              {isUploading ? `กำลังอัปโหลด ${uploadProgress}%` : 'อัปโหลด Excel'}
            </button>
            <button onClick={fetchData} disabled={isLoading} className="flex items-center gap-1.5 px-4 py-2 bg-neutral-950 text-red-400 border border-neutral-800 hover:border-red-500/50 hover:bg-red-500/10 rounded-xl shadow-sm text-xs font-black transition disabled:opacity-50">
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              อัปเดตข้อมูล
            </button>
            <button onClick={handleSaveView} className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl shadow-lg text-xs font-black transition-all hover:-translate-y-0.5 shadow-red-900/30 border border-red-500/50">
              <Save size={13} />
              บันทึกมุมมอง
            </button>
            <button onClick={() => { setRowVars([]); setColVars([]); setFilterVars([]); setValueVars([]); setFilterValue([]); setSelectedViewIds([]); }} className="flex items-center gap-1.5 px-4 py-2 bg-black text-neutral-500 border border-neutral-800 hover:text-white hover:bg-neutral-800 rounded-xl shadow-sm text-xs font-black transition">
              <X size={13} />
              เคลียร์กระดาน
            </button>
            {userRole === 'Admin' && (
              <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded-xl shadow-sm text-xs font-black transition">
                <Shield size={13} />
                จัดการระบบ
              </button>
            )}
          </div>
        </header>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex flex-col lg:flex-row gap-5 min-h-[500px]">
          
          {/* Sidebar สำหรับเลือกตัวแปร */}
          <div className="w-full lg:w-72 bg-neutral-900 border border-neutral-800 p-5 rounded-2xl shadow-xl overflow-y-auto flex flex-col shrink-0 max-h-[800px]">
            <h2 className="font-black text-white text-sm flex items-center justify-between mb-3 uppercase tracking-wide">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20"><BarChart2 size={13} className="text-red-500"/></div>
                รายการตัวแปร
              </div>
              {variables.length > 0 && <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-full">{variables.length}</span>}
            </h2>
            
            <div className="mb-4 relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
              <input
                type="text"
                placeholder="ค้นหาตัวแปร..."
                value={variableSearch}
                onChange={e => setVariableSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-black/50 border border-neutral-800 rounded-xl text-xs font-semibold outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-white placeholder:text-neutral-600 transition-all"
              />
            </div>
            
            {/* โหมดการจัดเรียงตัวแปร */}
            <div className="flex bg-black p-1 rounded-xl border border-neutral-800 mb-3 shrink-0">
              <button onClick={() => setSortMode('grouped')} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-black transition ${sortMode === 'grouped' ? 'bg-neutral-800 text-red-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>หมวดหมู่</button>
              <button onClick={() => setSortMode('az')} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-black transition ${sortMode === 'az' ? 'bg-neutral-800 text-red-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>A-Z</button>
              <button onClick={() => setSortMode('original')} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-black transition ${sortMode === 'original' ? 'bg-neutral-800 text-red-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>ดั้งเดิม</button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 size={24} className="text-red-500 animate-spin mb-2" />
                  <p className="text-xs font-bold text-neutral-500">กำลังโหลด...</p>
                </div>
              ) : error ? (
                <p className="text-xs font-bold text-red-400 bg-red-950/30 p-3 rounded-lg border border-red-900/50">{error}</p>
              ) : (
                Object.entries(categorizedVariables).map(([groupName, vars]) => (
                  <div key={groupName} className="mb-4 last:mb-0">
                    {sortMode === 'grouped' && <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 px-1">{groupName}</h4>}
                    <div className="space-y-1.5">
                      {vars.map(v => (
                        <DraggableVariable key={v} id={v} name={v} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* --- พื้นที่แสดงรายการมุมมองที่บันทึกไว้ --- */}
            <div className="mt-6 pt-5 border-t border-neutral-800 flex-1 flex flex-col min-h-[200px]">
              <h2 className="font-black text-white text-sm flex items-center justify-between gap-2 mb-3 uppercase tracking-wide">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Save size={13} className="text-emerald-500"/></div>
                  มุมมองที่บันทึก
                </div>
                <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-full">{savedViews.length}</span>
              </h2>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {isFetchingViews ? (
                  <div className="flex justify-center py-4"><Loader2 size={20} className="text-emerald-500 animate-spin"/></div>
                ) : savedViews.length === 0 ? (
                  <p className="text-xs font-semibold text-neutral-500 text-center py-4 italic">ยังไม่มีมุมมองที่ถูกบันทึกไว้</p>
                ) : (
                  savedViews.map(view => {
                    const isSelected = selectedViewIds.includes(view.id);
                    return (
                      <div key={view.id} className={`flex items-center justify-between p-2 rounded-xl border transition-all ${isSelected ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-neutral-800/50 border-neutral-700 hover:border-emerald-500/30'}`}>
                        <button onClick={() => isSelected ? setSelectedViewIds(selectedViewIds.filter(id => id !== view.id)) : setSelectedViewIds([...selectedViewIds, view.id])} className="flex-1 flex items-center gap-2 text-left truncate pr-2">
                          {isSelected ? <CheckSquare size={14} className="text-emerald-500 shrink-0" /> : <Square size={14} className="text-neutral-500 shrink-0" />}
                          <span className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-400' : 'text-neutral-300'}`}>{view.name}</span>
                        </button>
                        <button onClick={() => handleDeleteSavedView(view.id, view.name)} className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-900 rounded-lg transition-colors shrink-0" title="ลบทิ้ง">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* พื้นที่หลัก (Droppable Zones & พื้นที่แสดงกราฟ) */}
          <div className="flex-1 flex flex-col gap-5 min-w-0 max-h-[800px]">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 shrink-0">
              <DroppableArea id="row-zone" title="แกน Y (Rows) - จัดกลุ่มตามลำดับ" items={rowVars} onRemoveItem={handleRemoveVariable} />
              <DroppableArea id="col-zone" title="แกน X (Columns) - จัดกลุ่มตามลำดับ" items={colVars} onRemoveItem={handleRemoveVariable} />
              <DroppableArea id="value-zone" title="ค่าข้อมูล (Values)" items={valueVars} onRemoveItem={handleRemoveVariable} />
              <DroppableArea id="filter-zone" title="ตัวกรอง (Filter)" items={filterVars} onRemoveItem={handleRemoveVariable}>
                {filterVars.length > 0 && filterOptions.length > 0 && (
                  <div className="mt-3 w-full animate-in fade-in duration-300 flex flex-col">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[10px] font-bold text-neutral-500">เลือกข้อมูล ({filterValue.length})</span>
                      <div className="flex gap-2">
                        <button onClick={() => setFilterValue(filterOptions.map(String))} className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors">ทั้งหมด</button>
                        <button onClick={() => setFilterValue([])} className="text-[10px] font-bold text-neutral-500 hover:text-neutral-300 transition-colors">ล้าง</button>
                      </div>
                    </div>
                    <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {filterOptions.map(opt => {
                        const valStr = String(opt);
                        const isSelected = filterValue.includes(valStr);
                        return (
                          <div key={opt} onClick={() => {
                            setFilterValue(prev => prev.includes(valStr) ? prev.filter(v => v !== valStr) : [...prev, valStr]);
                          }} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-[11px] font-semibold transition-all ${isSelected ? 'bg-red-950/30 text-red-400 border border-red-900/50' : 'hover:bg-neutral-800 text-neutral-400 border border-transparent hover:border-neutral-700'}`}>
                            {isSelected ? <CheckSquare size={14} className="shrink-0 text-red-500" /> : <Square size={14} className="shrink-0 text-neutral-600" />}
                            <span className="truncate" title={valStr}>{valStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </DroppableArea>
            </div>

            {/* กล่องสำหรับวาดตาราง Crosstab หรือ กราฟ */}
            <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl p-6 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4 shrink-0 pb-3 border-b border-neutral-800">
                <h3 className="font-black text-white text-sm flex items-center gap-2 uppercase tracking-wide">
                  <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center border border-neutral-700">
                    {viewMode === 'chart' ? <PieChart size={13} className="text-neutral-400"/> : <Table2 size={13} className="text-neutral-400"/>}
                  </div>
                  ผลการวิเคราะห์ {filterVars.length > 0 && filterValue.length > 0 && <span className="text-red-400 text-xs ml-2 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 hidden sm:inline-block">กรองเฉพาะ: {filterValue.length} รายการ</span>}
                </h3>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button onClick={handleExportExcel} disabled={!crosstabData || isProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 text-emerald-400 hover:text-emerald-300 border border-neutral-700 hover:border-emerald-500/50 hover:bg-emerald-950/30 rounded-lg text-xs font-black transition disabled:opacity-50 shadow-sm">
                    <DownloadCloud size={13}/>
                    <span className="hidden sm:inline">Export Excel</span>
                  </button>
                  <div className="w-px h-5 bg-neutral-800 mx-1 hidden sm:block"></div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={aggType} 
                      onChange={(e) => setAggType(e.target.value)}
                      className="text-xs font-bold bg-black border border-neutral-800 text-red-400 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                    >
                      <option value="count">นับจำนวน (Count)</option>
                      <option value="average">ค่าเฉลี่ย (Average)</option>
                    </select>
                    
                    {aggType === 'count' && (
                      <select 
                        value={pctType} 
                        onChange={(e) => setPctType(e.target.value)}
                        className="text-xs font-bold bg-black border border-neutral-800 text-neutral-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                      >
                        <option value="row">% แนวนอน (Row %)</option>
                        <option value="col">% แนวตั้ง (Col %)</option>
                        <option value="total">% ทั้งหมด (Total %)</option>
                      </select>
                    )}
                  </div>
                  <div className="flex bg-black p-1 rounded-lg border border-neutral-800">
                    <button onClick={() => setViewMode('chart')} className={`px-3 py-1 rounded-md text-xs font-black transition ${viewMode === 'chart' ? 'bg-neutral-800 text-red-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>กราฟ</button>
                    <button onClick={() => setViewMode('table')} className={`px-3 py-1 rounded-md text-xs font-black transition ${viewMode === 'table' ? 'bg-neutral-800 text-red-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>ตาราง</button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto flex flex-col">
                {(rowVars.length > 0 && colVars.length > 0) ? (
                  (aggType === 'average' && valueVars.length === 0) ? (
                    <p className="m-auto text-sm font-bold text-amber-400 bg-amber-950/30 px-4 py-3 rounded-xl border border-amber-900/50 shadow-sm">
                      ⚠️ กรุณาลากตัวแปรมาวางในช่อง "ค่าข้อมูล (Values)" เพื่อคำนวณค่าเฉลี่ย
                    </p>
                  ) : isProcessing ? (
                    <div className="m-auto flex flex-col items-center justify-center">
                      <Loader2 size={32} className="text-red-500 animate-spin mb-4" />
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">กำลังประมวลผลข้อมูล...</h3>
                      <p className="text-xs font-semibold text-neutral-400 mt-2 bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700">
                        <span className="text-red-400">{rowVars.join(' ❯ ') || '?'}</span> <span className="mx-1 text-neutral-500">×</span> <span className="text-red-400">{colVars.join(' ❯ ') || '?'}</span>
                      </p>
                    </div>
                  ) : (
                    crosstabData 
                      ? (viewMode === 'chart' 
                          ? <CrosstabChart data={crosstabData} /> 
                          : <CrosstabTable data={crosstabData} rowVar={rowVars.join(' ❯ ')} colVar={colVars.join(' ❯ ')} />)
                      : <p className="m-auto text-sm font-bold text-red-400 bg-red-950/30 px-4 py-2 rounded-xl border border-red-900/50">ไม่สามารถสร้างตารางได้ กรุณาตรวจสอบข้อมูล</p>
                  )
                ) : (
                  <div className="m-auto text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-4 border border-neutral-700">
                      <BarChart2 className="h-8 w-8 text-neutral-500" />
                    </div>
                    <h3 className="text-sm font-black text-neutral-300 uppercase tracking-widest">ยังไม่มีข้อมูลแสดงผล</h3>
                    <p className="mt-2 text-xs font-semibold text-neutral-500">กรุณาลากตัวแปรจากเมนูด้านซ้าย มาวางเพื่อเริ่มต้น</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </DndContext>

      {/* --- พื้นที่สำหรับแสดงกราฟที่บันทึกไว้ --- */}
      {selectedViewIds.length > 0 && (
        <div className="mt-10 pt-8 border-t-2 border-neutral-800 border-dashed space-y-6">
          <h2 className="font-black text-white text-xl flex items-center gap-2">
            <LayoutDashboard size={24} className="text-red-500" />
            เปรียบเทียบรายงานที่เลือก ({selectedViewIds.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {selectedViewIds.map(id => {
              const viewConfig = savedViews.find(v => v.id === id);
              if (!viewConfig) return null;
              return (
                <SavedViewCard 
                  key={viewConfig.id} 
                  config={viewConfig} 
                  rawData={rawData} 
                  onClose={(vid) => setSelectedViewIds(prev => prev.filter(p => p !== vid))} 
                />
              );
            })}
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default DashboardLayout;