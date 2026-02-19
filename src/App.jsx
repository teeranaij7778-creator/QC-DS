import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, ComposedChart, Line
} from 'recharts';
import { 
  Users, CheckCircle, AlertTriangle, XCircle, Search, 
  FileText, BarChart2, MessageSquare, TrendingUp, Database, RefreshCw, Trash2, FilterX, PlayCircle, Settings, AlertCircle, Info, ChevronRight, ExternalLink, User, ChevronDown, CheckSquare, Square, X, Lock, Activity, Filter, Clock, Award, Save, Edit2, Hash, Star, Zap, MousePointerClick, UserPlus, MapPin, Flame, Cloud, Loader2, Upload, FileJson, Download, AlertOctagon
} from 'lucide-react';
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, updateDoc, addDoc, query, orderBy, serverTimestamp, writeBatch, getDocs } from "firebase/firestore";

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyACA30Lms1pRejuA2FdtYDYDSe8fD2lNB8",
  authDomain: "test-qc-a33b6.firebaseapp.com",
  projectId: "test-qc-a33b6",
  storageBucket: "test-qc-a33b6.firebasestorage.app",
  messagingSenderId: "647004289726",
  appId: "1:647004289726:web:f60202a45d6ef961eebcef"
};

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwIZCWN9z0IfAvJp-Q0GUnLq9OJRp6fkzR9DRLFu5lzOkZkaXIClwqod0vvreiBSBUoMA/exec";

const RESULT_ORDER = [
  'ดีเยี่ยม: ครบถ้วนตามมาตรฐาน (พนักงานทำได้ดีทุกข้อ น้ำเสียงเป็นมืออาชีพ ข้อมูลแม่นยำ 100%)',
  'ผ่านเกณฑ์: ปฏิบัติงานได้ถูกต้อง (ทำได้ตามมาตรฐาน มีข้อผิดพลาดเล็กน้อยที่ไม่กระทบคุณภาพข้อมูลหลัก)',
  'ควรปรับปรุง: มารยาทและน้ำเสียง (มีคำฟุ่มเฟือย/หัวเราะขณะสัมภาษณ์ หรือสนิทสนมกับผู้ตอบมากเกินไป)',
  'ควรปรับปรุง: การอ่านคำถาม/ตัวเลือก (อ่านไม่ครบถ้วน อ่านข้ามตัวเลือก หรือรวบรัดคำถามตามความเข้าใจตนเอง)',
  'ควรปรับปรุง: การจดบันทึก Open-end (จดบันทึกไม่ละเอียด ไม่ครบทุกคำ หรือซักคำถามปลายเปิดไม่เพียงพอ)',
  'พบข้อผิดพลาด: มีการชี้นำคำตอบ (แสดงความเห็นส่วนตัว แนะนำคำตอบ หรือพูดแทรกเพื่อเร่งรัดการสัมภาษณ์)',
  'พบข้อผิดพลาด: ข้อมูลไม่ตรงตามจริง (บันทึกคำตอบผิดจากที่ตอบจริง หรือทำผิดเงื่อนไข Logic ของแบบสอบถาม)',
  'ไม่ผ่านเกณฑ์: ต้องอบรมใหม่ทันที (มีข้อผิดพลาดรุนแรงในจุดสำคัญหลายข้อซึ่งส่งผลเสียต่อคุณภาพงานวิจัย)'
];

const SCORE_LABELS = { '5': '5.ดี', '4': '4.ค่อนข้างดี', '3': '3.ปานกลาง', '2': '2.ไม่ค่อยดี', '1': '1.ไม่ดีเลย', '-': '-' };
const SUPERVISOR_OPTIONS = ['เสกข์พลกฤต', 'ศรัณยกร', 'นิตยา', 'มณีรัตน์', 'Gallup'];

const formatResultDisplay = (text) => (text ? text.split('(')[0].trim() : '-');

const RESULT_COLORS = {
  'ดีเยี่ยม': '#6366f1',
  'ผ่านเกณฑ์': '#10B981',
  'ควรปรับปรุง': '#F59E0B',
  'พบข้อผิดพลาด': '#f43f5e',
  'ไม่ผ่านเกณฑ์': '#be123c',
};

const getResultColor = (fullText) => {
  if (!fullText) return '#94a3b8';
  for (const [key, color] of Object.entries(RESULT_COLORS)) {
    if (fullText.startsWith(key)) return color;
  }
  return '#94a3b8';
};

const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
  }
  return str;
};

// ──────────────────────────────────────────────
// MINI COMPONENTS
// ──────────────────────────────────────────────

const Logo = () => (
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

const StatusBadge = ({ result }) => {
  const color = getResultColor(result);
  const label = formatResultDisplay(result);
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase"
      style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}>
      {label}
    </span>
  );
};

const FilterSection = ({ title, items, selectedItems, onToggle, onSelectAll, onClear, maxH = "max-h-40" }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">{title}</label>
      <div className="flex gap-3">
        <button onClick={onSelectAll} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-600">เลือกทั้งหมด</button>
        <button onClick={onClear} className="text-[9px] font-bold text-slate-400 hover:text-rose-500">ล้าง</button>
      </div>
    </div>
    <div className={`overflow-y-auto space-y-1 ${maxH}`}>
      {items.map(item => (
        <div key={item} onClick={() => onToggle(item)}
          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-[10px] font-semibold transition-all
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

// ──────────────────────────────────────────────
// MAIN APP
// ──────────────────────────────────────────────

export default function App() {
  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [inputUser, setInputUser] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Data
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Firebase
  const [db, setDb] = useState(null);
  const [firebaseConfigStr, setFirebaseConfigStr] = useState(
    (() => { try { return localStorage.getItem('firebase_config_str') || JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2); } catch(e) { return JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2); } })()
  );
  const [showSettings, setShowSettings] = useState(false);
  const [importMode, setImportMode] = useState('config');
  const [importJson, setImportJson] = useState('');
  const [importStatus, setImportStatus] = useState(null);
  const [appsScriptUrl, setAppsScriptUrl] = useState(
    (() => { try { return localStorage.getItem('apps_script_url') || DEFAULT_SCRIPT_URL; } catch(e) { return DEFAULT_SCRIPT_URL; } })()
  );

  // Modals
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notification, setNotification] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedSups, setSelectedSups] = useState([]);
  const [selectedResults, setSelectedResults] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedTouchpoints, setSelectedTouchpoints] = useState([]);
  const [activeKpiFilter, setActiveKpiFilter] = useState(null);

  // UI
  const [activeCell, setActiveCell] = useState({ agent: null, resultType: null });
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  const [editingCase, setEditingCase] = useState(null);

  // ── Init Firebase ──
  useEffect(() => {
    if (!firebaseConfigStr) return;
    try {
      const config = JSON.parse(firebaseConfigStr);
      const appName = "QC_DASH_V5";
      const existing = getApps().find(a => a.name === appName);
      const app = existing || initializeApp(config, appName);
      setDb(getFirestore(app));
      setError(null);
    } catch (e) {
      setError("Firebase Config ไม่ถูกต้อง: " + e.message);
    }
  }, [firebaseConfigStr]);

  // ── Real-time listener ──
  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const q = query(collection(db, "audit_cases"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => {
      if (err.code === 'permission-denied') {
        setError("⚠️ Permission Denied! กรุณาไปที่ Firebase Console > Firestore > Rules แล้วเปลี่ยนเป็น 'allow read, write: if true;'");
      } else {
        setError("Connection Error: " + err.message);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  // ── Notify helper ──
  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── Save Firebase config ──
  const handleSaveFirebaseConfig = () => {
    try {
      JSON.parse(firebaseConfigStr);
      try { localStorage.setItem('firebase_config_str', firebaseConfigStr); } catch(e) {}
      window.location.reload();
    } catch (e) {
      showNotif('error', "Config format ไม่ถูกต้อง (ต้องเป็น JSON Object)");
    }
  };

  // ── Update case ──
  const handleUpdateCase = async () => {
    if (!db || !editingCase) return;
    if (editingCase.type === "ยังไม่ได้ตรวจ") {
      showNotif('error', "กรุณาเลือกประเภทงาน (AC หรือ BC) ก่อนบันทึก");
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "audit_cases", editingCase.id), {
        type: editingCase.type,
        supervisor: editingCase.supervisor || '',
        supervisorFilter: editingCase.supervisor || 'N/A',
        result: editingCase.result,
        comment: editingCase.comment || '',
        evaluations: editingCase.evaluations,
        last_edited_by: userRole,
        last_edited_at: serverTimestamp()
      });
      setEditingCase(null);
      showNotif('success', "บันทึกข้อมูลเรียบร้อยแล้ว ✓");
    } catch (err) {
      showNotif('error', "Error: " + err.message);
    }
    setIsSaving(false);
  };

  // ── Clear DB ──
  const executeClearDatabase = async () => {
    setShowClearConfirm(false);
    if (!db) return;
    setImportStatus({ type: 'loading', msg: '⏳ Deleting all records...' });
    try {
      const snap = await getDocs(collection(db, "audit_cases"));
      if (snap.empty) { setImportStatus({ type: 'success', msg: "Database is already empty." }); setTimeout(() => setImportStatus(null), 3000); return; }
      const chunks = [];
      for (let i = 0; i < snap.docs.length; i += 400) chunks.push(snap.docs.slice(i, i + 400));
      let deleted = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        deleted += chunk.length;
        setImportStatus({ type: 'loading', msg: `🗑️ Deleted ${deleted} / ${snap.docs.length}...` });
      }
      setImportStatus({ type: 'success', msg: `✅ Cleared ${deleted} records.` });
      setTimeout(() => setImportStatus(null), 3000);
    } catch (e) {
      setImportStatus({ type: 'error', msg: "Delete Failed: " + e.message });
    }
  };

  // ── Export CSV ──
  const handleExportCSV = () => {
    const headers = ["Month","Date","QuestionnaireNo","Touchpoint","Agent","InterviewerID","Name","Type","Result","Supervisor","Comment","Audio",...Array.from({length:13},(_,i)=>`Criteria ${i+1}`)];
    const esc = t => `"${String(t||'').replace(/"/g,'""')}"`;
    const rows = [headers.join(','), ...baseFilteredData.map(item => {
      const evals = Array.isArray(item.evaluations) ? item.evaluations.map(e=>esc(e.value)).join(',') : Array(13).fill('""').join(',');
      return [esc(item.month),esc(item.date),esc(item.questionnaireNo),esc(item.touchpoint),esc(item.agent),esc(item.interviewerId),esc(item.rawName),esc(item.type),esc(item.result),esc(item.supervisor),esc(item.comment),esc(item.audio),evals].join(',');
    })];
    const blob = new Blob(["\uFEFF" + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `QC_Export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  // ── Process & Upload ──
  const processAndUploadData = async (rawData) => {
    if (!db) { showNotif('error', "ไม่พบการเชื่อมต่อ Database"); return; }
    try {
      if (!Array.isArray(rawData)) throw new Error("ข้อมูลต้องเป็น Array [...]");
      setImportStatus({ type: 'loading', msg: `Analyzing ${rawData.length} records...` });
      const currentDataMap = new Map(data.map(d => [d.id, d]));
      let dataRows = rawData;
      if (rawData.length > 0) {
        const first = rawData[0];
        const str = (Array.isArray(first) ? first : Object.values(first)).join(' ').toLowerCase();
        if (str.includes('month') || str.includes('เดือน')) dataRows = rawData.slice(1);
      }
      const uniqueMap = new Map();
      dataRows.forEach(item => {
        if (Array.isArray(item)) {
          const qNo = item[4] ? String(item[4]).trim() : '';
          const agentId = item[9] ? String(item[9]).trim() : '';
          const agentName = item[10] ? String(item[10]).trim() : '';
          if (!qNo && !agentId && !agentName) return;
        }
        let qNo = Array.isArray(item) ? (item[4] ? String(item[4]).trim() : '') : (item.questionnaireNo || item.QuestionnaireNo || '');
        if (['QuestionnaireNo','เลขชุด','Questionnaire No.'].includes(qNo)) return;
        const key = qNo ? String(qNo).replace(/\//g,'_') : `NO_ID_${Math.random()}`;
        uniqueMap.set(key, item);
      });
      const uniqueData = Array.from(uniqueMap.values());
      const chunks = [];
      for (let i = 0; i < uniqueData.length; i += 400) chunks.push(uniqueData.slice(i, i + 400));
      let total = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(item => {
          let norm = {};
          let docId = '';
          const getVal = (obj, keys) => { for (const k of keys) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return String(obj[k]); } return ''; };
          const matchResult = (raw) => {
            const r = String(raw || 'N/A').trim();
            return RESULT_ORDER.find(opt => r.startsWith(opt.split(':')[0].trim())) || r;
          };
          if (Array.isArray(item)) {
            const rawQNo = item[4] ? String(item[4]).trim().replace(/\//g,'_') : '';
            docId = (rawQNo && rawQNo !== '-' && rawQNo !== 'N/A') ? rawQNo : doc(collection(db,"audit_cases")).id;
            const evals = Array(13).fill(0).map((_,i) => ({ label:`Criteria ${i+1}`, value: String(item[15+i]||'-') }));
            norm = {
              month: item[2]||'N/A', date: item[3] ? String(item[3]).split('T')[0] : new Date().toISOString().split('T')[0],
              questionnaireNo: item[4] ? String(item[4]) : '-', touchpoint: item[5]||'N/A',
              agent: `${item[9]||'-'} : ${item[10]||'-'}`, interviewerId: item[9]||'-', rawName: item[10]||'-',
              supervisor: item[7]||'', supervisorFilter: item[7]||'N/A', type: item[6]||'ยังไม่ได้ตรวจ',
              audio: item[11] ? String(item[11]).trim() : '', result: matchResult(item[12]), comment: item[13]||'',
              evaluations: evals, timestamp: serverTimestamp()
            };
          } else {
            const rawQNo = (getVal(item,['questionnaireNo','QuestionnaireNo'])||'').trim().replace(/\//g,'_');
            docId = (rawQNo && rawQNo !== '-' && rawQNo !== 'N/A') ? rawQNo : doc(collection(db,"audit_cases")).id;
            const evals = Array.isArray(item.evaluations) ? item.evaluations : Array(13).fill(0).map((_,i) => ({
              label:`Criteria ${i+1}`, value: String(item[`P${i+1}`]||item[`Criteria ${i+1}`]||'-')
            }));
            norm = {
              month: item.month||item.Month||'N/A', date: item.date||item.Date||new Date().toISOString().split('T')[0],
              questionnaireNo: item.questionnaireNo||item.QuestionnaireNo||'-', touchpoint: item.touchpoint||item.Touchpoint||'N/A',
              agent: item.agent||item.Agent||'Unknown', interviewerId: (item.agent||'').split(':')[0]?.trim()||'-',
              rawName: (item.agent||'').split(':')[1]?.trim()||'-', type: item.type||item.Type||'ยังไม่ได้ตรวจ',
              supervisor: item.supervisor||'', supervisorFilter: item.supervisorFilter||item.supervisor||'N/A',
              result: matchResult(item.result||item.Result), comment: item.comment||item.Comment||'',
              audio: getVal(item,['Link ไฟล์เสียง','ไฟล์เสียง','audio','Audio']),
              evaluations: evals, timestamp: serverTimestamp()
            };
          }
          // Safe Sync
          const ex = currentDataMap.get(docId);
          if (ex) {
            if (ex.type && ex.type !== 'ยังไม่ได้ตรวจ' && (!norm.type || norm.type === 'ยังไม่ได้ตรวจ')) delete norm.type;
            const exResValid = ex.result && !ex.result.startsWith('N/A') && ex.result !== '-';
            const inResEmpty = !norm.result || norm.result.startsWith('N/A') || norm.result === '-';
            if (exResValid && inResEmpty) { delete norm.result; delete norm.evaluations; }
            if (ex.comment?.trim() && !norm.comment?.trim()) delete norm.comment;
            if (ex.supervisor && !norm.supervisor) { delete norm.supervisor; delete norm.supervisorFilter; }
          }
          batch.set(doc(db,"audit_cases",docId), norm, { merge: true });
        });
        await batch.commit();
        total += chunk.length;
        setImportStatus({ type: 'success', msg: `✅ Sync Complete! ${total} records.` });
        setTimeout(() => setImportStatus(null), 5000);
      }
    } catch (e) {
      setImportStatus({ type: 'error', msg: "Upload Failed: " + e.message });
      setTimeout(() => setImportStatus(null), 8000);
    }
  };

  const handleBulkImport = async () => {
    if (!importJson) { showNotif('error', "กรุณาวาง JSON Data"); return; }
    setImportStatus({ type: 'loading', msg: 'Validating JSON...' });
    setTimeout(async () => {
      try { await processAndUploadData(JSON.parse(importJson)); setImportJson(''); }
      catch (e) { setImportStatus({ type: 'error', msg: "Invalid JSON" }); }
    }, 400);
  };

  const handleSyncFromSheet = async () => {
    if (!appsScriptUrl) { showNotif('error', "กรุณาระบุ Web App URL"); return; }
    setImportStatus({ type: 'loading', msg: 'Fetching from Google Sheets...' });
    try {
      const res = await fetch(appsScriptUrl);
      if (!res.ok) throw new Error("Fetch failed");
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json.data || []);
      if (!rows.length) throw new Error("No data found in Sheet");
      await processAndUploadData(rows);
    } catch (e) {
      setImportStatus({ type: 'error', msg: "Sync Error: " + e.message });
      setTimeout(() => setImportStatus(null), 5000);
    }
  };

  // ──────────────────────────────────────────────
  // COMPUTED DATA
  // ──────────────────────────────────────────────

  const availableMonths = useMemo(() => [...new Set(data.map(d=>d.month).filter(m=>m&&m!=='N/A'&&m!=='Month'&&m!=='เดือน'))].sort(), [data]);
  const availableSups = useMemo(() => [...new Set(data.map(d=>d.supervisorFilter).filter(Boolean).filter(s=>s!=='N/A'))].sort(), [data]);
  const availableTypes = useMemo(() => [...new Set(data.map(d=>d.type).filter(t=>t&&t!=='N/A'))].sort(), [data]);
  const availableTouchpoints = useMemo(() => [...new Set(data.map(d=>d.touchpoint).filter(t=>t&&t!=='N/A'))].sort(), [data]);

  const availableAgents = useMemo(() => {
    let f = data;
    if (dateRange.start) f = f.filter(d => normalizeDate(d.date) >= dateRange.start);
    if (dateRange.end) f = f.filter(d => normalizeDate(d.date) <= dateRange.end);
    if (selectedSups.length) f = f.filter(d => selectedSups.includes(d.supervisorFilter));
    if (selectedMonths.length) f = f.filter(d => selectedMonths.includes(d.month));
    if (selectedTypes.length) f = f.filter(d => selectedTypes.includes(d.type));
    if (selectedTouchpoints.length) f = f.filter(d => selectedTouchpoints.includes(d.touchpoint));
    return [...new Set(f.map(d=>d.agent).filter(a=>a&&a!=='Unknown'))].sort();
  }, [data, selectedSups, selectedMonths, selectedTypes, selectedTouchpoints, dateRange]);

  const baseFilteredData = useMemo(() => data.filter(item => {
    const invAgent = !item.agent || item.agent === '- : -' || item.agent === 'Unknown';
    const invQNo = !item.questionnaireNo || item.questionnaireNo === '-' || item.questionnaireNo === 'N/A';
    if (invAgent && invQNo) return false;
    const s = searchTerm.toLowerCase();
    if (s && !String(item.agent||'').toLowerCase().includes(s) && !String(item.questionnaireNo||'').toLowerCase().includes(s)) return false;
    const nd = normalizeDate(item.date);
    if (dateRange.start && nd < dateRange.start) return false;
    if (dateRange.end && nd > dateRange.end) return false;
    if (selectedResults.length && !selectedResults.includes(item.result)) return false;
    if (selectedSups.length && !selectedSups.includes(item.supervisorFilter)) return false;
    if (selectedAgents.length && !selectedAgents.includes(item.agent)) return false;
    if (selectedMonths.length && !selectedMonths.includes(item.month)) return false;
    if (selectedTypes.length && !selectedTypes.includes(item.type)) return false;
    if (selectedTouchpoints.length && !selectedTouchpoints.includes(item.touchpoint)) return false;
    return true;
  }), [data, searchTerm, selectedResults, selectedSups, selectedAgents, selectedMonths, selectedTypes, selectedTouchpoints, dateRange]);

  const finalFilteredData = useMemo(() => {
    if (!activeKpiFilter) return baseFilteredData;
    return baseFilteredData.filter(item => {
      if (activeKpiFilter === 'audited') return item.type !== 'ยังไม่ได้ตรวจ' && item.type !== 'N/A' && item.type !== '';
      if (activeKpiFilter === 'pass') return item.result.startsWith('ดีเยี่ยม') || item.result.startsWith('ผ่านเกณฑ์');
      if (activeKpiFilter === 'improve') return item.result.startsWith('ควรปรับปรุง');
      if (activeKpiFilter === 'error') return item.result.startsWith('พบข้อผิดพลาด');
      return true;
    });
  }, [baseFilteredData, activeKpiFilter]);

  const totalWorkByMonth = useMemo(() => selectedMonths.length === 0 ? data.length : data.filter(d=>selectedMonths.includes(d.month)).length, [data, selectedMonths]);
  const totalAudited = useMemo(() => baseFilteredData.filter(d=>d.type&&d.type!=='ยังไม่ได้ตรวจ'&&d.type!=='N/A'&&d.type!=='').length, [baseFilteredData]);
  const passCount = useMemo(() => baseFilteredData.filter(d=>d.result?.startsWith('ดีเยี่ยม')||d.result?.startsWith('ผ่านเกณฑ์')).length, [baseFilteredData]);
  const improveCount = useMemo(() => baseFilteredData.filter(d=>d.result?.startsWith('ควรปรับปรุง')).length, [baseFilteredData]);
  const errorCount = useMemo(() => baseFilteredData.filter(d=>d.result?.startsWith('พบข้อผิดพลาด')).length, [baseFilteredData]);

  const agentSummary = useMemo(() => {
    const map = {};
    finalFilteredData.forEach(item => {
      if (!map[item.agent]) { map[item.agent] = { name: item.agent, total: 0 }; RESULT_ORDER.forEach(r => map[item.agent][r] = 0); }
      if (map[item.agent][item.result] !== undefined) map[item.agent][item.result]++;
      map[item.agent].total++;
    });
    return Object.values(map).sort((a,b)=>b.total-a.total);
  }, [finalFilteredData]);

  const totalSummary = useMemo(() => {
    const t = { total: 0 };
    RESULT_ORDER.forEach(r => t[r] = 0);
    agentSummary.forEach(a => { t.total += a.total; RESULT_ORDER.forEach(r => t[r] += (a[r]||0)); });
    return t;
  }, [agentSummary]);

  const chartData = useMemo(() => {
    const total = finalFilteredData.length;
    return RESULT_ORDER.map(key => ({
      name: formatResultDisplay(key), full: key,
      count: finalFilteredData.filter(d=>d.result===key).length,
      percent: total > 0 ? ((finalFilteredData.filter(d=>d.result===key).length / total)*100).toFixed(1) : 0,
      color: getResultColor(key)
    }));
  }, [finalFilteredData]);

  const monthlyData = useMemo(() => availableMonths.map(month => {
    const md = data.filter(d=>d.month===month);
    const total = md.length;
    const audited = md.filter(d=>d.type&&d.type!=='ยังไม่ได้ตรวจ'&&d.type!=='N/A'&&d.type!=='').length;
    return { name: month, audited, total, percent: total > 0 ? parseFloat(((audited/total)*100).toFixed(1)) : 0 };
  }), [data, availableMonths]);

  const trendData = useMemo(() => {
    if (!activeCell.agent) return [];
    return availableMonths.map(month => {
      const md = data.filter(d=>d.agent===activeCell.agent&&d.month===month);
      const total = md.length;
      const pass = md.filter(d=>d.result?.startsWith('ดีเยี่ยม')||d.result?.startsWith('ผ่านเกณฑ์')).length;
      return { name: month, total, passRate: total > 0 ? parseFloat(((pass/total)*100).toFixed(1)) : 0, passCount: pass };
    }).filter(d=>d.total>0);
  }, [activeCell.agent, data, availableMonths]);

  const detailLogs = useMemo(() => (activeCell.agent && activeCell.resultType)
    ? finalFilteredData.filter(d=>d.agent===activeCell.agent&&d.result===activeCell.resultType)
    : finalFilteredData, [finalFilteredData, activeCell]);

  const toggle = (item, list, setList) => list.includes(item) ? setList(list.filter(i=>i!==item)) : setList([...list, item]);

  const hasActiveFilters = selectedResults.length||selectedSups.length||selectedMonths.length||selectedAgents.length||selectedTypes.length||selectedTouchpoints.length||dateRange.start||dateRange.end;

  // ──────────────────────────────────────────────
  // LOGIN SCREEN
  // ──────────────────────────────────────────────
  if (!isAuthenticated) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
      </div>
      <div className="w-full max-w-[380px] relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-2xl shadow-indigo-600/40 mb-6">
            <Activity size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">QC Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">CATI CES 2026 · Firebase Edition</p>
        </div>
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={e => {
            e.preventDefault();
            const roles = { Admin: '8888', QC: '1234', Gallup: '1234', INV: '1234' };
            if (roles[inputUser] === inputPass) { setIsAuthenticated(true); setUserRole(inputUser); }
            else setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
          }} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Username</label>
              <input type="text" value={inputUser} onChange={e=>{setInputUser(e.target.value);setLoginError('');}}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-500"
                placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Password</label>
              <input type="password" value={inputPass} onChange={e=>{setInputPass(e.target.value);setLoginError('');}}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-500"
                placeholder="••••••••" />
            </div>
            {loginError && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-900/40 border border-rose-700/50 rounded-xl">
                <AlertCircle size={14} className="text-rose-400 shrink-0" />
                <span className="text-rose-300 text-xs font-semibold">{loginError}</span>
              </div>
            )}
            <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-sm tracking-wider transition-all shadow-lg shadow-indigo-900/40 active:scale-[0.98]">
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // ──────────────────────────────────────────────
  // MAIN DASHBOARD
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      {/* Global Notification */}
      {notification && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl
          ${notification.type==='error' ? 'bg-rose-900/90 border-rose-700/50 text-rose-100' : 'bg-slate-800/90 border-slate-600/50 text-white'}`}>
          {notification.type==='error' ? <AlertCircle size={16}/> : <CheckCircle size={16} className="text-emerald-400"/>}
          <span className="text-sm font-semibold">{notification.message}</span>
          <button onClick={()=>setNotification(null)} className="ml-2 opacity-50 hover:opacity-100"><X size={13}/></button>
        </div>
      )}

      {/* Clear Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-rose-500"/></div>
            <h3 className="text-lg font-black text-slate-800 mb-2">ยืนยันการลบ?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">ข้อมูลทั้งหมดจะถูกลบ <span className="text-rose-500 font-bold">ไม่สามารถกู้คืนได้</span></p>
            <div className="flex gap-3">
              <button onClick={()=>setShowClearConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition">ยกเลิก</button>
              <button onClick={executeClearDatabase} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition shadow-lg">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {(showSettings || error) && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
              <h3 className="font-black text-slate-800 flex items-center gap-2"><Flame size={18} className="text-orange-500"/> Firebase Setup</h3>
              {db && <button onClick={()=>{setShowSettings(false);setError(null);}} className="p-2 hover:bg-slate-100 rounded-xl transition"><X size={18} className="text-slate-400"/></button>}
            </div>
            {/* Tabs */}
            <div className="flex gap-1 mx-8 mt-6 mb-4 bg-slate-100 p-1 rounded-xl flex-shrink-0">
              {[['config','⚙️ Config'],['sync','🔄 Sync Sheet'],['import','📤 Import JSON']].map(([mode,label]) => (
                <button key={mode} onClick={()=>setImportMode(mode)}
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition ${importMode===mode ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>{label}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-4">
              {importMode === 'config' && <>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-700 font-semibold">⚠️ วาง Firebase Config JSON ที่นี่</div>
                <textarea className="w-full h-36 p-4 bg-slate-800 text-green-400 font-mono text-xs rounded-xl resize-none outline-none focus:ring-2 focus:ring-indigo-500"
                  value={firebaseConfigStr} onChange={e=>setFirebaseConfigStr(e.target.value)} />
                <button onClick={handleSaveFirebaseConfig} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm">SAVE & RECONNECT</button>
                {error && <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-600 text-xs font-semibold whitespace-pre-wrap leading-relaxed">{error}</div>}
                {userRole==='Admin' && (
                  <div className="border-t border-slate-100 pt-6 space-y-3">
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1"><AlertOctagon size={12}/> Danger Zone</p>
                    <div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                      <div><p className="text-xs font-black text-rose-800">Clear All Data</p><p className="text-[10px] text-rose-400 mt-0.5">ล้างข้อมูลทั้งหมดใน Firestore</p></div>
                      <button onClick={()=>setShowClearConfirm(true)} className="px-5 py-2.5 bg-white border border-rose-200 hover:bg-rose-600 hover:text-white text-rose-600 rounded-xl text-[10px] font-black transition flex items-center gap-1.5"><Trash2 size={12}/> Clear</button>
                    </div>
                    {importStatus && <p className={`text-xs font-bold text-center ${importStatus.type==='error'?'text-rose-500':'text-emerald-600'}`}>{importStatus.msg}</p>}
                  </div>
                )}
              </>}
              {importMode === 'sync' && <>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-semibold flex items-center gap-2"><Cloud size={14}/> Sync จาก Google Sheets → Firebase</div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Apps Script Web App URL</label>
                  <input type="text" value={appsScriptUrl} onChange={e=>{setAppsScriptUrl(e.target.value);try{localStorage.setItem('apps_script_url',e.target.value);}catch(e){}}}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://script.google.com/..." />
                </div>
                {importStatus && (
                  <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${importStatus.type==='error'?'bg-rose-50 text-rose-600':importStatus.type==='success'?'bg-emerald-50 text-emerald-600':'bg-slate-100 text-slate-600'}`}>
                    {importStatus.type==='loading' && <Loader2 className="animate-spin shrink-0" size={13}/>}{importStatus.msg}
                  </div>
                )}
                <button onClick={handleSyncFromSheet} disabled={importStatus?.type==='loading'}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition shadow-lg">
                  <RefreshCw size={15} className={importStatus?.type==='loading'?'animate-spin':''}/> SYNC TO FIREBASE
                </button>
              </>}
              {importMode === 'import' && <>
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-700 font-semibold flex items-center gap-2"><Upload size={14}/> Manual JSON Import</div>
                <textarea className="w-full h-36 p-4 bg-white border border-slate-200 text-slate-700 font-mono text-[10px] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder='[{"month":"JAN", "agent": "001 : ชื่อ", "result": "ดีเยี่ยม..."}]'
                  value={importJson} onChange={e=>setImportJson(e.target.value)} />
                {importStatus && (
                  <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${importStatus.type==='error'?'bg-rose-50 text-rose-600':importStatus.type==='success'?'bg-emerald-50 text-emerald-600':'bg-slate-100 text-slate-600'}`}>
                    {importStatus.type==='loading' && <Loader2 className="animate-spin shrink-0" size={13}/>}{importStatus.msg}
                  </div>
                )}
                <button onClick={handleBulkImport} disabled={importStatus?.type==='loading'}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition">
                  <FileJson size={15}/> UPLOAD TO FIREBASE
                </button>
              </>}
            </div>
          </div>
        </div>
      )}

      {/* Filter Sidebar */}
      <div className={`fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity ${isFilterOpen?'opacity-100':'opacity-0 pointer-events-none'}`} onClick={()=>setIsFilterOpen(false)}/>
      <aside className={`fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ${isFilterOpen?'translate-x-0':'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 font-black text-slate-800"><Filter size={16} className="text-indigo-600"/>ตัวกรอง</div>
          <button onClick={()=>setIsFilterOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={16} className="text-slate-400"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-7">
          <button onClick={()=>{setDateRange({start:'',end:''});setSelectedMonths([]);setSelectedSups([]);setSelectedAgents([]);setSelectedResults([]);setSelectedTypes([]);setSelectedTouchpoints([]);setActiveCell({agent:null,resultType:null});setActiveKpiFilter(null);}}
            className="w-full py-2.5 text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition">ล้างทั้งหมด</button>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">ช่วงวันที่</label>
              {(dateRange.start||dateRange.end) && <button onClick={()=>setDateRange({start:'',end:''})} className="text-[9px] font-bold text-slate-400 hover:text-rose-500">ล้าง</button>}
            </div>
            <div className="flex gap-2">
              {[['start','เริ่มต้น'],['end','สิ้นสุด']].map(([key,label]) => (
                <div key={key} className="flex-1 space-y-1">
                  <span className="text-[9px] text-slate-400 font-bold block">{label}</span>
                  <input type="date" value={dateRange[key]} onChange={e=>setDateRange({...dateRange,[key]:e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
            </div>
          </div>
          <FilterSection title="เดือน" items={availableMonths} selectedItems={selectedMonths} onToggle={i=>toggle(i,selectedMonths,setSelectedMonths)} onSelectAll={()=>setSelectedMonths(availableMonths)} onClear={()=>setSelectedMonths([])} />
          <FilterSection title="Touchpoint" items={availableTouchpoints} selectedItems={selectedTouchpoints} onToggle={i=>toggle(i,selectedTouchpoints,setSelectedTouchpoints)} onSelectAll={()=>setSelectedTouchpoints(availableTouchpoints)} onClear={()=>setSelectedTouchpoints([])} />
          <FilterSection title="Supervisor" items={availableSups} selectedItems={selectedSups} onToggle={i=>toggle(i,selectedSups,setSelectedSups)} onSelectAll={()=>setSelectedSups(availableSups)} onClear={()=>setSelectedSups([])} />
          <FilterSection title="ประเภทงาน" items={availableTypes} selectedItems={selectedTypes} onToggle={i=>toggle(i,selectedTypes,setSelectedTypes)} onSelectAll={()=>setSelectedTypes(availableTypes)} onClear={()=>setSelectedTypes([])} />
          <FilterSection title="พนักงาน" items={availableAgents} selectedItems={selectedAgents} onToggle={i=>toggle(i,selectedAgents,setSelectedAgents)} onSelectAll={()=>setSelectedAgents(availableAgents)} onClear={()=>setSelectedAgents([])} maxH="max-h-52" />
          <FilterSection title="ผลการสัมภาษณ์" items={RESULT_ORDER} selectedItems={selectedResults} onToggle={i=>toggle(i,selectedResults,setSelectedResults)} onSelectAll={()=>setSelectedResults(RESULT_ORDER)} onClear={()=>setSelectedResults([])} maxH="max-h-52" />
        </div>
      </aside>

      <div className="max-w-screen-xl mx-auto p-4 md:p-6 space-y-5">

        {/* ── HEADER ── */}
        <header className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="hidden sm:block w-px h-8 bg-slate-200" />
            <div>
              <h1 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-2">
                QC Report V5.5
                {loading && <RefreshCw size={14} className="animate-spin text-indigo-500" />}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-slate-400 font-semibold">LIVE · {data.length} รายการ</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {['Admin','QC','Gallup'].includes(userRole) && (
              <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black border bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100 transition">
                <Download size={13}/> Export CSV
              </button>
            )}
            {['Admin','QC'].includes(userRole) && (
              <button onClick={handleSyncFromSheet} disabled={importStatus?.type==='loading'}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black border transition
                  ${importStatus?.type==='loading' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'}`}>
                <RefreshCw size={13} className={importStatus?.type==='loading'?'animate-spin':''}/> 
                {importStatus?.type==='loading' ? 'Syncing...' : 'Sync Sheet'}
              </button>
            )}
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black border bg-indigo-50 border-indigo-200 text-indigo-600">
              <Zap size={13}/> Live
            </button>
            <button onClick={()=>setIsFilterOpen(true)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black border transition
                ${hasActiveFilters ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
              <Filter size={13}/> ตัวกรอง {hasActiveFilters ? '●' : ''}
            </button>
            {userRole==='Admin' && (
              <button onClick={()=>setShowSettings(true)} className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition">
                <Settings size={13}/> ตั้งค่า
              </button>
            )}
            <button onClick={()=>setIsAuthenticated(false)} className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-xl transition">
              <User size={15}/>
            </button>
          </div>
        </header>

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { id: null, label: 'งานทั้งหมด', value: totalWorkByMonth, icon: FileText, scheme: 'slate' },
            { id: 'audited', label: 'ตรวจแล้ว', value: `${totalAudited}`, sub: totalWorkByMonth > 0 ? `${((totalAudited/totalWorkByMonth)*100).toFixed(1)}%` : '0%', icon: Database, scheme: 'indigo' },
            { id: 'pass', label: 'ผ่านเกณฑ์', value: passCount, icon: CheckCircle, scheme: 'emerald' },
            { id: 'improve', label: 'ควรปรับปรุง', value: improveCount, icon: AlertTriangle, scheme: 'amber' },
            { id: 'error', label: 'พบข้อผิดพลาด', value: errorCount, icon: XCircle, scheme: 'rose' },
          ].map(kpi => {
            const isActive = activeKpiFilter === kpi.id;
            const schemes = {
              slate: { bg: 'bg-white', border: 'border-slate-200', icon: 'text-slate-600', val: 'text-slate-800', activeBg: 'bg-slate-50 ring-2 ring-slate-400' },
              indigo: { bg: 'bg-white', border: 'border-slate-200', icon: 'text-indigo-600', val: 'text-indigo-700', activeBg: 'bg-indigo-50 ring-2 ring-indigo-400' },
              emerald: { bg: 'bg-white', border: 'border-slate-200', icon: 'text-emerald-600', val: 'text-emerald-700', activeBg: 'bg-emerald-50 ring-2 ring-emerald-400' },
              amber: { bg: 'bg-white', border: 'border-slate-200', icon: 'text-amber-500', val: 'text-amber-600', activeBg: 'bg-amber-50 ring-2 ring-amber-400' },
              rose: { bg: 'bg-white', border: 'border-slate-200', icon: 'text-rose-500', val: 'text-rose-600', activeBg: 'bg-rose-50 ring-2 ring-rose-400' },
            };
            const s = schemes[kpi.scheme];
            return (
              <button key={kpi.id||'total'} onClick={()=>{ if(kpi.id === null) setActiveKpiFilter(null); else setActiveKpiFilter(isActive ? null : kpi.id); }}
                className={`text-left p-5 rounded-2xl border transition-all active:scale-95 group relative overflow-hidden
                  ${isActive ? s.activeBg : `${s.bg} ${s.border} hover:shadow-sm`}`}>
                {isActive && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500 animate-pulse"/>}
                <div className={`w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 ${s.icon}`}>
                  <kpi.icon size={15}/>
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{kpi.label}</p>
                <div className={`text-2xl font-black mt-1.5 ${s.val}`}>
                  {kpi.value}
                  {kpi.sub && <span className="text-sm font-bold text-slate-400 ml-1.5">{kpi.sub}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── CHARTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-black text-slate-700 text-sm flex items-center gap-2 mb-4 uppercase tracking-wide">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center"><PieChart size={13} className="text-indigo-600"/></div>
              Case Composition
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-40 h-40 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="count" innerRadius={48} outerRadius={68} paddingAngle={3}>
                      {chartData.map((e,i) => <Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={{fontSize:10,borderRadius:8,border:'1px solid #e2e8f0',boxShadow:'0 4px 6px -1px rgb(0 0 0/0.05)'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {chartData.filter(c=>c.count>0).map(c => (
                  <div key={c.full} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:c.color}}/>
                      <span className="text-[10px] text-slate-500 font-semibold truncate">{c.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-700 shrink-0">{c.count} <span className="text-slate-400 font-normal">({c.percent}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-black text-slate-700 text-sm flex items-center gap-2 mb-4 uppercase tracking-wide">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center"><BarChart2 size={13} className="text-emerald-600"/></div>
              Monthly Audit Progress
            </h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{top:5,right:5,bottom:0,left:-10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#94a3b8',fontWeight:'bold'}}/>
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#94a3b8'}} unit="%"/>
                  <Tooltip contentStyle={{fontSize:10,borderRadius:10,border:'1px solid #e2e8f0'}}
                    content={({active,payload,label})=>active&&payload?.length ? (
                      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg">
                        <p className="text-[10px] text-slate-400 font-bold mb-1">{label}</p>
                        <p className="text-emerald-600 font-black text-base">{payload[0].value}%</p>
                        <p className="text-[10px] text-slate-500">{payload[0].payload.audited} / {payload[0].payload.total} เคส</p>
                      </div>
                    ) : null} />
                  <Bar dataKey="percent" radius={[5,5,0,0]} barSize={32}>
                    {monthlyData.map((e,i)=><Cell key={i} fill={e.percent>=100?'#6366f1':'#10B981'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── MATRIX TABLE ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-700 text-sm flex items-center gap-2 uppercase tracking-wide">
              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200"><Users size={13} className="text-slate-500"/></div>
              สรุปพนักงาน × ผลการตรวจ
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold">{agentSummary.length} พนักงาน</span>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs border-separate border-spacing-0 min-w-max">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white min-w-[200px]">Interviewer</th>
                  {RESULT_ORDER.map(type => (
                    <th key={type} className="px-3 py-3 text-center text-[9px] font-black border-b border-slate-100 bg-slate-50 max-w-[120px]">
                      <span className="line-clamp-2 leading-tight" style={{color:getResultColor(type)}}>{formatResultDisplay(type)}</span>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-100 min-w-[80px]">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {agentSummary.map((agent,i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-3.5 font-semibold text-slate-700 border-r border-slate-50 group-hover:text-indigo-600 transition-colors">{agent.name}</td>
                    {RESULT_ORDER.map(type => {
                      const val = agent[type];
                      const isActive = activeCell.agent===agent.name && activeCell.resultType===type;
                      return (
                        <td key={type} onClick={()=>val>0&&setActiveCell(p=>p.agent===agent.name&&p.resultType===type?{agent:null,resultType:null}:{agent:agent.name,resultType:type})}
                          className={`px-3 py-3.5 text-center transition-all border-r border-slate-50
                            ${val>0?'cursor-pointer':''} ${isActive?'bg-indigo-50':''}`}>
                          {val > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className="font-black text-sm" style={{color:getResultColor(type)}}>{val}</span>
                              <span className="text-[9px] text-slate-400">{agent.total>0?((val/agent.total)*100).toFixed(0):0}%</span>
                            </div>
                          ) : <span className="text-slate-200">·</span>}
                        </td>
                      );
                    })}
                    <td className="px-6 py-3.5 text-center bg-slate-50">
                      <span className="font-black text-slate-700">{agent.total}</span>
                      <div className="text-[9px] text-slate-400">{totalSummary.total>0?((agent.total/totalSummary.total)*100).toFixed(1):0}%</div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 border-t-2 border-slate-200 font-black">
                  <td className="px-6 py-4 text-indigo-600 font-black text-xs uppercase">GRAND TOTAL</td>
                  {RESULT_ORDER.map(type => {
                    const val = totalSummary[type];
                    return (
                      <td key={type} className="px-3 py-4 text-center border-r border-slate-200">
                        <span className="font-black text-sm" style={{color:getResultColor(type)}}>{val||0}</span>
                        <div className="text-[9px] text-slate-500">{totalSummary.total>0?((val/totalSummary.total)*100).toFixed(1):0}%</div>
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-center bg-slate-200">
                    <span className="font-black text-indigo-600 text-base">{totalSummary.total}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── TREND CHART ── */}
        {activeCell.agent && trendData.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-slate-700 text-sm flex items-center gap-2 uppercase">
                <TrendingUp size={15} className="text-indigo-500"/>
                Trend: <span className="text-indigo-600">{activeCell.agent}</span>
              </h3>
              <button onClick={()=>setActiveCell({agent:null,resultType:null})} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={14} className="text-slate-400"/></button>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{top:10,right:20,bottom:0,left:-10}}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} strokeDasharray="3 3"/>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#94a3b8',fontWeight:'bold'}}/>
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#94a3b8'}}/>
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#10B981',fontWeight:'bold'}} unit="%" domain={[0,100]}/>
                  <Tooltip contentStyle={{fontSize:10,borderRadius:10,border:'1px solid #e2e8f0'}}/>
                  <Bar yAxisId="left" dataKey="total" name="จำนวนเคส" fill="#818cf8" fillOpacity={0.7} radius={[4,4,0,0]} barSize={32}/>
                  <Line yAxisId="right" type="monotone" dataKey="passRate" name="% ผ่านเกณฑ์" stroke="#10B981" strokeWidth={2.5} dot={{r:4,fill:'#10B981',stroke:'#fff',strokeWidth:2}} activeDot={{r:6}}/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── DETAIL LIST ── */}
        <div id="detail-section" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-700 text-sm flex items-center gap-2 uppercase tracking-wide">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200"><MessageSquare size={13} className="text-slate-500"/></div>
                รายละเอียดรายเคส
                <span className="text-xs font-semibold text-slate-400">({detailLogs.length} รายการ)</span>
              </h3>
              <div className="flex gap-2 mt-2 flex-wrap">
                {activeCell.agent && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-lg uppercase">
                  {activeCell.agent} <button onClick={()=>setActiveCell({agent:null,resultType:null})}><X size={9}/></button></span>}
                {activeKpiFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-lg uppercase">
                  {activeKpiFilter} <button onClick={()=>setActiveKpiFilter(null)}><X size={9}/></button></span>}
              </div>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13}/>
              <input type="text" placeholder="ค้นหาพนักงาน / เลขชุด..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 placeholder:text-slate-400"/>
            </div>
          </div>
          <div className="overflow-auto max-h-[800px]">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100">
                  {['วันที่ / เลขชุด / Touchpoint','พนักงาน','ผลสรุป','Comment & Audio'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {detailLogs.length > 0 ? detailLogs.slice(0,150).map(item => {
                  const isExpanded = expandedCaseId === item.id;
                  const isEditing = editingCase?.id === item.id;
                  const isNew = item.type === 'ยังไม่ได้ตรวจ';
                  const hasAudio = item.audio && String(item.audio).includes('https:');
                  return (
                    <React.Fragment key={item.id}>
                      <tr onClick={()=>!isEditing&&setExpandedCaseId(isExpanded?null:item.id)}
                        className={`cursor-pointer transition-colors group ${isExpanded?'bg-indigo-50/50':'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-700">{item.date}</div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[9px] font-black text-slate-500">
                              <Hash size={8}/>{item.questionnaireNo}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-[9px] font-black text-indigo-500">
                              <MapPin size={8}/>{item.touchpoint}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-700 flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors">
                            {item.agent}
                            {isExpanded ? <ChevronDown size={12} className="text-slate-400"/> : <ChevronRight size={12} className="text-slate-400"/>}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{item.type} · {item.supervisor||item.supervisorFilter}</div>
                        </td>
                        <td className="px-4 py-4"><StatusBadge result={item.result}/></td>
                        <td className="px-6 py-4">
                          <p className="text-slate-400 truncate max-w-xs italic text-[10px]">{item.comment ? `"${item.comment}"` : '—'}</p>
                          {hasAudio
                            ? <a href={item.audio} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                                className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-lg text-[9px] font-black uppercase transition border border-indigo-100">
                                <PlayCircle size={11}/> Listen
                              </a>
                            : <span className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase border border-slate-100">
                                <FilterX size={11}/> ไม่พบเสียง
                              </span>
                          }
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={4} className="px-8 py-6">
                            <div className="flex items-center justify-between mb-5">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white border border-slate-200 rounded-xl"><Award size={16} className="text-indigo-600"/></div>
                                <div>
                                  <h4 className="font-black text-slate-700 text-xs uppercase tracking-wide">{isNew?'Start Audit':'Assessment Detail'} — {item.interviewerId} : {item.rawName}</h4>
                                  <p className="text-[9px] text-slate-400 mt-0.5">{isNew?'กรุณากรอกคะแนนและผลสรุปเพื่อบันทึก':'แก้ไขผลการตรวจ'}</p>
                                </div>
                              </div>
                              {['Admin','QC','Gallup'].includes(userRole) ? (
                                !isEditing
                                  ? <button onClick={e=>{e.stopPropagation();setEditingCase({...item});}}
                                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition
                                        ${isNew?'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                      <Edit2 size={11}/>{isNew?'เริ่มตรวจ':'แก้ไข'}
                                    </button>
                                  : <div className="flex gap-2">
                                      <button disabled={isSaving} onClick={e=>{e.stopPropagation();handleUpdateCase();}}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase transition">
                                        {isSaving?<RefreshCw className="animate-spin" size={11}/>:<Save size={11}/>} บันทึก
                                      </button>
                                      <button onClick={e=>{e.stopPropagation();setEditingCase(null);}}
                                        className="px-4 py-2 bg-white text-slate-600 rounded-xl text-[10px] font-black uppercase border border-slate-200 hover:bg-slate-50 transition">ยกเลิก</button>
                                    </div>
                              ) : <span className="px-3 py-1.5 border border-slate-200 rounded-lg text-[9px] text-slate-400 font-bold uppercase">Read Only</span>}
                            </div>

                            {isEditing && (
                              <div className="mb-5 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl" onClick={e=>e.stopPropagation()}>
                                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1"><Info size={12}/> ประเภทงาน & Supervisor</p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                  <div className="flex gap-2">
                                    {['AC','BC'].map(t => (
                                      <button key={t} onClick={()=>setEditingCase({...editingCase,type:t})}
                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase border transition
                                          ${editingCase.type===t?'bg-indigo-600 text-white border-indigo-600':'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{t}</button>
                                    ))}
                                  </div>
                                  <div className="flex-1 relative bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider mb-1">Supervisor</p>
                                    <select value={editingCase.supervisor||''} onChange={e=>setEditingCase({...editingCase,supervisor:e.target.value})}
                                      className="w-full bg-transparent text-slate-700 text-xs font-bold outline-none appearance-none">
                                      <option value="">ระบุ Supervisor...</option>
                                      {SUPERVISOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <ChevronDown size={11} className="absolute right-3 top-1/2 text-slate-400 pointer-events-none"/>
                                  </div>
                                  {editingCase.type==='ยังไม่ได้ตรวจ' && <p className="text-rose-500 text-[9px] font-black uppercase self-center animate-pulse">*** เลือก AC หรือ BC</p>}
                                </div>
                              </div>
                            )}

                            {/* Audio */}
                            <div className="mb-5 p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasAudio?'bg-indigo-50 text-indigo-600':'bg-slate-100 text-slate-400'}`}>
                                  {hasAudio?<PlayCircle size={16}/>:<FilterX size={16}/>}
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-slate-700 uppercase">ไฟล์เสียงสัมภาษณ์</p>
                                  <p className="text-[9px] text-slate-400">{hasAudio?'คลิกเพื่อฟัง':'ไม่พบไฟล์เสียง'}</p>
                                </div>
                              </div>
                              {hasAudio
                                ? <a href={item.audio} target="_blank" rel="noopener noreferrer"
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase flex items-center gap-1 transition">
                                    <ExternalLink size={11}/> Open Audio
                                  </a>
                                : <span className="px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-[9px] font-black uppercase flex items-center gap-1 border border-slate-200">
                                    <FilterX size={11}/> ไม่พบ
                                  </span>
                              }
                            </div>

                            {/* Result Selector */}
                            <div className="mb-5 p-4 bg-white border border-slate-200 rounded-xl" onClick={e=>e.stopPropagation()}>
                              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1"><Star size={11}/> ผลการสัมภาษณ์ (Column M)</p>
                              {isEditing
                                ? <div className="relative">
                                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                                      value={editingCase.result} onChange={e=>setEditingCase({...editingCase,result:e.target.value})}>
                                      {RESULT_ORDER.map(o=><option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                  </div>
                                : <p className="text-xs font-semibold text-slate-600 italic leading-relaxed">{item.result}</p>
                              }
                            </div>

                            {/* Evaluations */}
                            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2 mb-5">
                              {(isEditing?editingCase:item).evaluations.map((e,i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-xl p-2.5">
                                  <p className="text-[8px] font-black text-slate-400 uppercase truncate mb-1.5">{e.label}</p>
                                  <span className={`text-xs font-black ${e.value==='5'||e.value==='4'?'text-emerald-500':e.value==='1'||e.value==='2'?'text-rose-500':'text-slate-300'}`}>
                                    {SCORE_LABELS[e.value]||e.value}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Comment */}
                            <div onClick={e=>e.stopPropagation()}>
                              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-1"><MessageSquare size={11}/> QC Comment (Column N)</p>
                              {isEditing
                                ? <textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm italic text-slate-600 outline-none min-h-[100px] focus:ring-2 focus:ring-indigo-500 resize-none"
                                    value={editingCase.comment} onChange={e=>setEditingCase({...editingCase,comment:e.target.value})}/>
                                : <div className="p-4 bg-white rounded-xl border border-l-4 border-l-indigo-400 border-slate-200">
                                    <p className="text-sm text-slate-600 italic leading-relaxed">"{item.comment||'ไม่มีคอมเมนต์'}"</p>
                                  </div>
                              }
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }) : (
                  <tr><td colSpan={4} className="py-20 text-center text-slate-400 text-sm font-semibold italic">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}