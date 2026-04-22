import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, ComposedChart, Line
} from 'recharts';
import { 
  Users, CheckCircle, AlertTriangle, XCircle, Search, FileText, BarChart2, MessageSquare, TrendingUp, Database, RefreshCw, FilterX, PlayCircle, Settings, AlertCircle, Info, ChevronRight, ExternalLink, User, ChevronDown, CheckSquare, Square, X, Activity, Filter, Award, Save, Edit2, Hash, Star, Zap, MapPin, Flame, Loader2, Download, FolderOpen, FileSpreadsheet, DownloadCloud, ChevronLeft, Calendar, Shield
} from 'lucide-react';
import { collection, doc, updateDoc, addDoc, serverTimestamp, writeBatch, getDocs, getDoc, setDoc, deleteDoc, query, where } from "firebase/firestore";
import { ref, listAll, getDownloadURL, getBlob } from "firebase/storage";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { DEFAULT_FIREBASE_CONFIG, DEFAULT_SCRIPT_URL, RESULT_ORDER, SCORE_LABELS, CRITERIA_DESCRIPTIONS, DEFAULT_SUPERVISORS } from './constants';
import { formatResultDisplay, getResultColor, getDriveId, normalizeDate, getMonthWeight } from './utils';
import { Logo, StatusBadge, FilterSection } from './UiComponents';
import { MonthSelectorModal } from './MonthSelectorModal';
import { HotsheetModal } from './HotsheetModal';
import { useFirebase } from './useFirebase';
import { useDataFetch } from './useDataFetch';

const ANIMATION_STYLES = `
  @keyframes gradient-x { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .animate-gradient-x { background-size: 200% 200%; animation: gradient-x 4s ease infinite; }
  @keyframes shimmer { 0% { transform: translateX(-150%) skewX(-15deg); } 100% { transform: translateX(150%) skewX(-15deg); } }
  .shimmer { position: relative; overflow: hidden; }
  .shimmer::after { content: ''; position: absolute; top: 0; left: 0; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 2.5s infinite; }
  @keyframes float { 0% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-20px) scale(1.05); } 100% { transform: translateY(0px) scale(1); } }
  .animate-float { animation: float 6s ease-in-out infinite; }
  @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
  .animate-pulse-soft { animation: pulse-soft 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
`;

// ──────────────────────────────────────────────
// MAIN APP
// ──────────────────────────────────────────────

export default function App() {
  const navigate = useNavigate();
  const [inputUser, setInputUser] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [showSettings, setShowSettings] = useState(false);

  const [notifications, setNotifications] = useState([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedSups, setSelectedSups] = useState([]);
  const [selectedResults, setSelectedResults] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedTouchpoints, setSelectedTouchpoints] = useState([]);
  const [activeKpiFilter, setActiveKpiFilter] = useState(null);

  // Hotsheet Download State <-- Added Hotsheet States
  const [showHotsheetModal, setShowHotsheetModal] = useState(false);
  const [hotsheetPath, setHotsheetPath] = useState('Hotsheet');
  const [hotsheetFolders, setHotsheetFolders] = useState([]);
  const [hotsheetFiles, setHotsheetFiles] = useState([]);
  const [hotsheetLoading, setHotsheetLoading] = useState(false);
  const [selectedHotsheetMonth, setSelectedHotsheetMonth] = useState('');

  // UI
  const [activeCell, setActiveCell] = useState({ agent: null, resultType: null });
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  const [editingCase, setEditingCase] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(50);

  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [selectedStartupMonths, setSelectedStartupMonths] = useState([]);
  const [isStartupInitialized, setIsStartupInitialized] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [activeProject, setActiveProject] = useState(null);

  // Project Selection
  const [projects, setProjects] = useState([]);
  const [needsProjectSelection, setNeedsProjectSelection] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [hasCheckedProjects, setHasCheckedProjects] = useState(false);

  // ── HOOKS ── (ต้องประกาศก่อน useEffect เสมอ)
  const { db, storage, auth, firebaseError, setFirebaseError, isAuthenticated, userRole, firebaseConfigStr, setFirebaseConfigStr } = useFirebase();
  const { data, loading, fetchError, setFetchError, allAvailableMonths, supervisorsData, dbSearchResults, setDbSearchResults, isSearchingDB } = useDataFetch(db, selectedMonths, debouncedSearchTerm);
  const currentError = firebaseError || fetchError;
  const clearError = () => { setFirebaseError(null); setFetchError(null); };

  useEffect(() => {
    if(db && activeProjectId) {
      getDoc(doc(db, 'projects', activeProjectId)).then(snap => {
        if(snap.exists()) setActiveProject({ id: snap.id, ...snap.data() });
      }).catch(console.error);
    }
  }, [db, activeProjectId]);

  // Project selection logic
  useEffect(() => {
    if (isAuthenticated && db) {
      setIsLoadingProjects(true);
      getDocs(collection(db, 'projects')).then(snap => {
        let projs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
        
        // ดักสิทธิ์: กรองให้เหลือโปรเจกต์เดียวหากเป็น Role Gallup หรือใช้อีเมล qc@gullup.com
        const currentRole = String(userRole || '').toLowerCase().trim();
        const currentEmail = String(auth?.currentUser?.email || '').toLowerCase().trim();
        if (currentRole === 'gallup' || currentRole === 'gullup' || currentEmail === 'qc@gullup.com' || currentEmail === 'qc@gallup.com') {
          projs = projs.filter(p => p.id === 'JE9AjnmD1UQZkFefE65X');
        }

        setProjects(projs);
        
        // ยกเลิกการจดจำโปรเจกต์อัตโนมัติ เพื่อบังคับให้โชว์หน้า "เลือกโปรเจกต์" ก่อนเสมอ
        if (projs.length > 0) {
          if (projs.length === 1) {
            handleSelectProject(projs[0].id);
          } else {
            setNeedsProjectSelection(true);
          }
        }
        setIsLoadingProjects(false);
        setHasCheckedProjects(true);
      }).catch(err => {
        console.error("Error fetching projects:", err);
        setIsLoadingProjects(false);
        setHasCheckedProjects(true);
      });
    } else if (!isAuthenticated) {
      setIsLoadingProjects(false);
      setHasCheckedProjects(false);
    }
  }, [isAuthenticated, db, userRole, auth]);

  // Reset displayLimit when filters change
  useEffect(() => {
    setDisplayLimit(50);
  }, [searchTerm, dateRange, selectedMonths, selectedSups, selectedResults, selectedAgents, selectedTypes, selectedTouchpoints, activeKpiFilter, activeCell]);

  // ── Search Database Directly ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 600);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ── Hotsheet Logic ── <-- Added Hotsheet Fetch & Filter
  useEffect(() => {
    if (!showHotsheetModal || !storage) return;

    const fetchHotsheetStorage = async () => {
      setHotsheetLoading(true);
      try {
        const listRef = ref(storage, hotsheetPath);
        const res = await listAll(listRef);
        setHotsheetFolders(res.prefixes.map(p => p.name));

        const filesData = await Promise.all(res.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          return { name: itemRef.name, url: url, fullPath: itemRef.fullPath };
        }));
        setHotsheetFiles(filesData);
        setSelectedHotsheetMonth(''); // Reset filter on path change
      } catch (err) {
        console.error("Storage Error:", err);
        showNotif('error', "ไม่สามารถโหลดไฟล์ได้ (อาจจะไม่มีโฟลเดอร์หรือติดสิทธิ์)");
      }
      setHotsheetLoading(false);
    };

    fetchHotsheetStorage();
  }, [showHotsheetModal, hotsheetPath, storage]);

  const hotsheetAvailableMonths = useMemo(() => {
    const months = new Set();
    hotsheetFiles.forEach(f => {
      const match = f.name.match(/_(\d{2})(\d{2})(\d{4})\./); // format _MMDDYYYY.
      if (match) months.add(`${match[1]}/${match[3]}`); // Save as MM/YYYY
    });
    return [...months].sort();
  }, [hotsheetFiles]);

  const filteredHotsheetFiles = useMemo(() => {
    if (!selectedHotsheetMonth) return hotsheetFiles;
    return hotsheetFiles.filter(f => {
      const match = f.name.match(/_(\d{2})(\d{2})(\d{4})\./);
      if (match) {
        return `${match[1]}/${match[3]}` === selectedHotsheetMonth;
      }
      return false;
    });
  }, [hotsheetFiles, selectedHotsheetMonth]);

  const downloadHotsheetFile = async (fullPath, url, fileName) => {
    try {
      showNotif('success', `กำลังเตรียมไฟล์ดาวน์โหลด...`);
      const fileRef = ref(storage, fullPath);
      const blob = await getBlob(fileRef); // ใช้ getBlob ของ Firebase แทน fetch
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName; // <--- บังคับชื่อไฟล์ที่ถูกต้อง
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      a.remove();
    } catch (err) {
      console.warn("GetBlob failed (CORS issue), fallback to direct link", err);
      // แผนสำรอง กรณีติด CORS จะโหลดแบบปกติแทน (ซึ่งจะทำให้ชื่อยาว)
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const handleSelectProject = (projectId) => {
    try {
      localStorage.setItem('active_project_id', projectId);
    } catch (e) {}

    setActiveProjectId(projectId);
    setNeedsProjectSelection(false);
    
    // บังคับเปิดหน้าเลือกเดือน และล้างข้อมูลตัวกรองของโปรเจกต์เดิมทิ้งทั้งหมด
    setShowMonthSelector(true);
    setSelectedMonths([]);
    setSelectedStartupMonths([]);
    setDateRange({ start: '', end: '' });
    setSelectedSups([]);
    setSelectedResults([]);
    setSelectedAgents([]);
    setSelectedTypes([]);
    setSelectedTouchpoints([]);
    setActiveKpiFilter(null);
    setActiveCell({ agent: null, resultType: null });
    setSearchTerm('');
  };

  // ── Notify helper ──
  const showNotif = (type, message) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
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
      
      if (dbSearchResults !== null) {
        setDbSearchResults(prev => prev.map(p => p.id === editingCase.id ? {
          ...p,
          type: editingCase.type,
          supervisor: editingCase.supervisor || '',
          supervisorFilter: editingCase.supervisor || 'N/A',
          result: editingCase.result,
          comment: editingCase.comment || '',
          evaluations: editingCase.evaluations,
        } : p));
      }
      
      setEditingCase(null);
      showNotif('success', "บันทึกข้อมูลเรียบร้อยแล้ว ✓");
    } catch (err) {
      showNotif('error', "Error: " + err.message);
    }
    setIsSaving(false);
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

  // ── Quick Sync (500 rows) ──
  const handleQuickSync = async () => {
    if (!activeProject?.appsScriptUrl) {
      showNotif('error', "ไม่พบ Web App URL สำหรับดึงข้อมูล (กรุณาตั้งค่าที่ระบบกลาง)");
      return;
    }
    setIsSyncing(true);
    showNotif('info', 'กำลังดึงข้อมูลจาก Google Sheets...');
    try {
      const res = await fetch(activeProject.appsScriptUrl);
      if (!res.ok) throw new Error("Fetch failed");
      const json = await res.json();
      let rows = Array.isArray(json) ? json : (json.data || []);
      if (!rows.length) throw new Error("No data found in Sheet");
      const header = rows[0];
      let dataRows = rows.slice(1).filter(row => {
        const values = Array.isArray(row) ? row : Object.values(row);
        return values.some(val => val !== null && val !== undefined && String(val).trim() !== '');
      });
      // เลือกเฉพาะ 500 แถวล่าสุด
      if (dataRows.length > 500) dataRows = dataRows.slice(-500);
      
      const rawData = [header, ...dataRows];
      const uniqueMonthsInUpload = new Set();
      let dataToProcess = rawData;
      if (rawData.length > 0) {
        const first = rawData[0];
        const str = (Array.isArray(first) ? first : Object.values(first)).join(' ').toLowerCase();
        if (str.includes('month') || str.includes('เดือน')) dataToProcess = rawData.slice(1);
      }
      const uniqueMap = new Map();
      dataToProcess.forEach(item => {
        if (Array.isArray(item)) {
          const qNo = item[4] ? String(item[4]).trim() : '';
          const agentId = item[9] ? String(item[9]).trim() : '';
          const agentName = item[10] ? String(item[10]).trim() : '';
          if (!qNo && !agentId && !agentName) return;
        }
        let qNo = Array.isArray(item) ? (item[4] ? String(item[4]).trim() : '') : (item.questionnaireNo || item.QuestionnaireNo || '');
        if (['QuestionnaireNo','เลขชุด','Questionnaire No.'].includes(qNo)) return;
        let cleanQNo = String(qNo).trim();
        let isBlankId = !cleanQNo || cleanQNo === '-' || cleanQNo.toUpperCase() === 'N/A';
        const key = isBlankId ? `NO_ID_${Math.random()}` : cleanQNo.replace(/\//g,'_');
        uniqueMap.set(key, item);
      });
      const uniqueData = Array.from(uniqueMap.values());
      const chunks = [];
      for (let i = 0; i < uniqueData.length; i += 400) chunks.push(uniqueData.slice(i, i + 400));
      let total = 0;
      for (const chunk of chunks) {
        const preparedItems = chunk.map(item => {
          let norm = {}; let docId = '';
          const getVal = (obj, keys) => { for (const k of keys) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return String(obj[k]); } return ''; };
          const matchResult = (raw) => { const r = String(raw || 'N/A').trim(); return (RESULT_ORDER || []).find(opt => r.startsWith(opt.split(':')[0].trim())) || r; };
          if (Array.isArray(item)) {
            const rawQNo = item[4] ? String(item[4]).trim().replace(/\//g,'_') : '';
            const baseDocId = (rawQNo && rawQNo !== '-' && rawQNo.toUpperCase() !== 'N/A') ? rawQNo : doc(collection(db,"audit_cases")).id;
            docId = `${activeProjectId}_${baseDocId}`;
            const evals = Array(13).fill(0).map((_,i) => ({ label:`Criteria ${i+1}`, value: String(item[15+i]||'-') }));
            norm = { month: item[2]||'N/A', date: item[3] ? String(item[3]).split('T')[0] : new Date().toISOString().split('T')[0], questionnaireNo: item[4] ? String(item[4]) : '-', touchpoint: item[5]||'N/A', agent: `${item[9]||'-'} : ${item[10]||'-'}`, interviewerId: item[9]||'-', rawName: item[10]||'-', supervisor: item[7]||'', supervisorFilter: item[7]||'N/A', type: item[6]||'ยังไม่ได้ตรวจ', audio: item[11] ? String(item[11]).trim() : '', result: matchResult(item[12]), comment: item[13]||'', evaluations: evals, timestamp: serverTimestamp(), projectId: activeProjectId };
          } else {
            const rawQNo = (getVal(item,['questionnaireNo','QuestionnaireNo'])||'').trim().replace(/\//g,'_');
            const baseDocId = (rawQNo && rawQNo !== '-' && rawQNo.toUpperCase() !== 'N/A') ? rawQNo : doc(collection(db,"audit_cases")).id;
            docId = `${activeProjectId}_${baseDocId}`;
            const evals = Array.isArray(item.evaluations) ? item.evaluations : Array(13).fill(0).map((_,i) => ({ label:`Criteria ${i+1}`, value: String(item[`P${i+1}`]||item[`Criteria ${i+1}`]||'-') }));
            norm = { month: item.month||item.Month||'N/A', date: item.date||item.Date||new Date().toISOString().split('T')[0], questionnaireNo: item.questionnaireNo||item.QuestionnaireNo||'-', touchpoint: item.touchpoint||item.Touchpoint||'N/A', agent: item.agent||item.Agent||'Unknown', interviewerId: (item.agent||'').split(':')[0]?.trim()||'-', rawName: (item.agent||'').split(':')[1]?.trim()||'-', type: item.type||item.Type||'ยังไม่ได้ตรวจ', supervisor: item.supervisor||'', supervisorFilter: item.supervisorFilter||item.supervisor||'N/A', result: matchResult(item.result||item.Result), comment: item.comment||item.Comment||'', audio: getVal(item,['Link ไฟล์เสียง','ไฟล์เสียง','audio','Audio']), evaluations: evals, timestamp: serverTimestamp(), projectId: activeProjectId };
          }
          if (norm.month && norm.month !== 'N/A') uniqueMonthsInUpload.add(norm.month);
          return { docId, norm };
        });
        const docRefs = preparedItems.map(p => doc(db, "audit_cases", p.docId));
        const docSnaps = await Promise.all(docRefs.map(r => getDoc(r)));
        const batch = writeBatch(db);
        preparedItems.forEach((p, index) => {
          const docSnap = docSnaps[index];
          if (docSnap.exists()) {
            const ex = docSnap.data();
            if (ex.type && ex.type !== 'ยังไม่ได้ตรวจ' && (!p.norm.type || p.norm.type === 'ยังไม่ได้ตรวจ')) delete p.norm.type;
            const exResValid = ex.result && !ex.result.startsWith('N/A') && ex.result !== '-';
            const inResEmpty = !p.norm.result || p.norm.result.startsWith('N/A') || p.norm.result === '-';
            if (exResValid && inResEmpty) { delete p.norm.result; delete p.norm.evaluations; }
            if (ex.comment?.trim() && !p.norm.comment?.trim()) delete p.norm.comment;
            if (ex.supervisor && !p.norm.supervisor) { delete p.norm.supervisor; delete p.norm.supervisorFilter; }
          }
          batch.set(docRefs[index], p.norm, { merge: true });
        });
        await batch.commit();
        total += chunk.length;
      }
      if (uniqueMonthsInUpload.size > 0) {
        const monthsRef = doc(db, "metadata", "months");
        const docSnap = await getDoc(monthsRef);
        const existingMonths = docSnap.exists() ? docSnap.data().all || [] : [];
        const newMonths = new Set([...existingMonths, ...Array.from(uniqueMonthsInUpload)]);
        await setDoc(monthsRef, { all: Array.from(newMonths) }, { merge: true });
      }
      showNotif('success', `✅ ดึงข้อมูลสำเร็จ (${total} รายการ) กำลังโหลดหน้าจอใหม่...`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      showNotif('error', "Sync Error: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // ──────────────────────────────────────────────
  // COMPUTED DATA
  // ──────────────────────────────────────────────

  const activeSupervisors = useMemo(() => {
    const dbNames = activeProject?.supervisors || [];
    return [...new Set([...(DEFAULT_SUPERVISORS || []), ...dbNames])];
  }, [activeProject]);

  const projectData = useMemo(() => (Array.isArray(data) ? data : []).filter(d => d.projectId === activeProjectId), [data, activeProjectId]);
  const projectDbSearchResults = useMemo(() => Array.isArray(dbSearchResults) ? dbSearchResults.filter(d => d.projectId === activeProjectId) : null, [dbSearchResults, activeProjectId]);

  const availableSups = useMemo(() => [...new Set(projectData.map(d=>d.supervisorFilter).filter(Boolean).filter(s=>s!=='N/A'))].sort(), [projectData]);
  const availableTypes = useMemo(() => [...new Set(projectData.map(d=>d.type).filter(t=>t&&t!=='N/A'))].sort(), [projectData]);
  const availableTouchpoints = useMemo(() => [...new Set(projectData.map(d=>d.touchpoint).filter(t=>t&&t!=='N/A'))].sort(), [projectData]);

  const availableAgents = useMemo(() => {
    let f = projectData;
    if (dateRange.start) f = f.filter(d => normalizeDate(d.date) >= dateRange.start);
    if (dateRange.end) f = f.filter(d => normalizeDate(d.date) <= dateRange.end);
    if (selectedSups.length) f = f.filter(d => selectedSups.includes(d.supervisorFilter));
    if (selectedMonths.length) f = f.filter(d => selectedMonths.includes(d.month));
    if (selectedTypes.length) f = f.filter(d => selectedTypes.includes(d.type));
    if (selectedTouchpoints.length) f = f.filter(d => selectedTouchpoints.includes(d.touchpoint));
    return [...new Set(f.map(d=>d.agent).filter(a=>a&&a!=='Unknown'))].sort();
  }, [projectData, selectedSups, selectedMonths, selectedTypes, selectedTouchpoints, dateRange]);

  const baseFilteredData = useMemo(() => {
    const source = projectDbSearchResults !== null ? projectDbSearchResults : projectData;
    return (source || []).filter(item => {
      const invAgent = !item.agent || item.agent === '- : -' || item.agent === 'Unknown';
      const invQNo = !item.questionnaireNo || item.questionnaireNo === '-' || item.questionnaireNo === 'N/A';
      if (invAgent && invQNo) return false;
      
      const s = searchTerm.toLowerCase();
      if (s && !String(item.agent||'').toLowerCase().includes(s) && !String(item.questionnaireNo||'').toLowerCase().includes(s) && !String(item.rawName||'').toLowerCase().includes(s)) return false;

      const isGlobalSearch = projectDbSearchResults !== null;

      if (!isGlobalSearch) {
        const nd = normalizeDate(item.date);
        if (dateRange.start && nd < dateRange.start) return false;
        if (dateRange.end && nd > dateRange.end) return false;
        if (selectedMonths.length && !selectedMonths.includes(item.month)) return false;
      }

      if (selectedResults.length && !selectedResults.includes(item.result)) return false;
      if (selectedSups.length && !selectedSups.includes(item.supervisorFilter)) return false;
      if (selectedAgents.length && !selectedAgents.includes(item.agent)) return false;
      if (selectedTypes.length && !selectedTypes.includes(item.type)) return false;
      if (selectedTouchpoints.length && !selectedTouchpoints.includes(item.touchpoint)) return false;
      
      return true;
    });
  }, [projectDbSearchResults, projectData, searchTerm, selectedResults, selectedSups, selectedAgents, selectedMonths, selectedTypes, selectedTouchpoints, dateRange]);

  const finalFilteredData = useMemo(() => {
    if (!activeKpiFilter) return baseFilteredData;
    return baseFilteredData.filter(item => {
      if (activeKpiFilter === 'audited') return item.type !== 'ยังไม่ได้ตรวจ' && item.type !== 'N/A' && item.type !== '';
      if (activeKpiFilter === 'pass') return item.result?.startsWith('ดีเยี่ยม') || item.result?.startsWith('ผ่านเกณฑ์');
      if (activeKpiFilter === 'improve') return item.result?.startsWith('ควรปรับปรุง');
      if (activeKpiFilter === 'error') return item.result?.startsWith('พบข้อผิดพลาด');
      return true;
    });
  }, [baseFilteredData, activeKpiFilter]);

  const totalWorkByMonth = useMemo(() => selectedMonths.length === 0 ? projectData.length : projectData.filter(d=>selectedMonths.includes(d.month)).length, [projectData, selectedMonths]);
  const totalAudited = useMemo(() => baseFilteredData.filter(d=>d.type&&d.type!=='ยังไม่ได้ตรวจ'&&d.type!=='N/A'&&d.type!=='').length, [baseFilteredData]);
  const passCount = useMemo(() => baseFilteredData.filter(d=>d.result?.startsWith('ดีเยี่ยม')||d.result?.startsWith('ผ่านเกณฑ์')).length, [baseFilteredData]);
  const improveCount = useMemo(() => baseFilteredData.filter(d=>d.result?.startsWith('ควรปรับปรุง')).length, [baseFilteredData]);
  const errorCount = useMemo(() => baseFilteredData.filter(d=>d.result?.startsWith('พบข้อผิดพลาด')).length, [baseFilteredData]);

  const agentSummary = useMemo(() => {
    const map = {};
    finalFilteredData.forEach(item => {
      if (!map[item.agent]) { map[item.agent] = { name: item.agent, total: 0 }; (RESULT_ORDER || []).forEach(r => map[item.agent][r] = 0); }
      if (map[item.agent][item.result] !== undefined) map[item.agent][item.result]++;
      map[item.agent].total++;
    });
    return Object.values(map).sort((a,b)=>b.total-a.total);
  }, [finalFilteredData]);

  const totalSummary = useMemo(() => {
    const t = { total: 0 };
    (RESULT_ORDER || []).forEach(r => t[r] = 0);
    agentSummary.forEach(a => { t.total += a.total; (RESULT_ORDER || []).forEach(r => t[r] += (a[r]||0)); });
    return t;
  }, [agentSummary]);

  const chartData = useMemo(() => {
    const total = finalFilteredData.length;
    return (RESULT_ORDER || []).map(key => ({
      name: formatResultDisplay(key), full: key,
      count: finalFilteredData.filter(d=>d.result===key).length,
      percent: total > 0 ? ((finalFilteredData.filter(d=>d.result===key).length / total)*100).toFixed(1) : 0,
      color: getResultColor(key)
    }));
  }, [finalFilteredData]);

  const monthlyData = useMemo(() => {
    const monthsToProcess = (allAvailableMonths || []).length > 0 
      ? allAvailableMonths 
      : [...new Set(projectData.map(d => d.month))].filter(m=>m&&m!=='N/A').sort((a,b) => getMonthWeight(a) - getMonthWeight(b));
    return monthsToProcess.map(month => {
      const md = projectData.filter(d=>d.month===month);
      const total = md.length;
      const audited = md.filter(d=>d.type&&d.type!=='ยังไม่ได้ตรวจ'&&d.type!=='N/A'&&d.type!=='').length;
      return { name: month, audited, total, percent: total > 0 ? parseFloat(((audited/total)*100).toFixed(1)) : 0 };
    });
  }, [projectData, allAvailableMonths]);

  const trendData = useMemo(() => {
    if (!activeCell.agent) return [];
    const monthsToProcess = (allAvailableMonths || []).length > 0 
      ? allAvailableMonths 
      : [...new Set(projectData.map(d => d.month))].filter(m=>m&&m!=='N/A').sort((a,b) => getMonthWeight(a) - getMonthWeight(b));
    return monthsToProcess.map(month => {
      const md = projectData.filter(d=>d.agent===activeCell.agent&&d.month===month);
      const total = md.length;
      const pass = md.filter(d=>d.result?.startsWith('ดีเยี่ยม')||d.result?.startsWith('ผ่านเกณฑ์')).length;
      return { name: month, total, passRate: total > 0 ? parseFloat(((pass/total)*100).toFixed(1)) : 0, passCount: pass };
    }).filter(d=>d.total>0)
  }, [activeCell.agent, projectData, allAvailableMonths]);

  const detailLogs = useMemo(() => (activeCell.agent && activeCell.resultType)
    ? finalFilteredData.filter(d=>d.agent===activeCell.agent&&d.result===activeCell.resultType)
    : finalFilteredData, [finalFilteredData, activeCell]);

  const toggle = (item, list, setList) => list.includes(item) ? setList(list.filter(i=>i!==item)) : setList([...list, item]);

  const hasActiveFilters = selectedResults.length||selectedSups.length||selectedMonths.length||selectedAgents.length||selectedTypes.length||selectedTouchpoints.length||dateRange.start||dateRange.end;

  // ──────────────────────────────────────────────
  // LOGIN SCREEN
  // ──────────────────────────────────────────────
  if (!isAuthenticated) return (
    <div className="min-h-screen flex overflow-hidden">
      <style>{ANIMATION_STYLES}</style>
      {/* Setup Modal สำหรับหน้า Login */}
      {(showSettings || currentError) && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-black text-[#2C3E50] flex items-center gap-2"><Flame size={18} className="text-[#E67E22]"/> Firebase Setup</h3>
              <button onClick={()=>{setShowSettings(false);clearError();}} className="p-2 hover:bg-slate-100 rounded-xl transition"><X size={18} className="text-[#85929E]"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 font-semibold">
                กรุณาตั้งค่า Firebase Config ก่อนเข้าสู่ระบบ
              </div>
              <textarea className="w-full h-36 p-4 bg-slate-50 text-emerald-600 font-mono text-xs rounded-xl resize-none outline-none focus:ring-2 focus:ring-[#842327] border border-slate-200"
                value={firebaseConfigStr} onChange={e=>setFirebaseConfigStr(e.target.value)} placeholder="วาง JSON Config..." />
              <button onClick={handleSaveFirebaseConfig} className="w-full py-3 bg-[#842327] hover:bg-[#D32F2F] text-white rounded-xl font-black text-sm transition shadow-lg">SAVE & RECONNECT</button>
              {currentError && <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold whitespace-pre-wrap">{String(currentError?.message || currentError)}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── Left Branded Panel ── */}
      <div className="hidden lg:flex w-5/12 xl:w-[480px] bg-gradient-to-br from-[#2C0A0C] via-[#6B1A1E] to-[#B52428] flex-col justify-between p-12 relative overflow-hidden shrink-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] bg-black/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] border border-white/[0.03] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/[0.04] rounded-full pointer-events-none" />

        {/* Logo top */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg shadow-black/20">
              <Activity size={22} className="text-white" />
            </div>
            <div>
              <div className="text-white font-black text-base tracking-widest uppercase leading-none">INTAGE</div>
              <div className="text-white/40 text-[10px] font-semibold tracking-widest uppercase mt-0.5">Quality Control</div>
            </div>
          </div>
        </div>

        {/* Center hero text */}
        <div className="relative z-10 space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 border border-white/15 rounded-full mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-[#28A745] shadow-[0_0_6px_rgba(40,167,69,0.8)] animate-pulse" />
              <span className="text-white/70 text-[10px] font-black uppercase tracking-widest">Live System</span>
            </div>
            <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">QC<br/>Dashboard</h1>
          </div>
        </div>
      </div>

      {/* ── Right Login Panel ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#FAFAFA] relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(132,35,39,0.07),rgba(255,255,255,0))] pointer-events-none" />
        <button onClick={() => setShowSettings(true)} className="absolute top-6 right-6 p-2.5 bg-white border border-slate-200 rounded-xl text-[#85929E] hover:text-[#2C3E50] hover:shadow-md transition-all z-50 shadow-sm">
          <Settings size={18} />
        </button>
        <div className="w-full max-w-[380px] relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#842327] shadow-xl shadow-[#842327]/30 mb-6">
              <Activity size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-[#2C3E50] tracking-tight">QC Dashboard</h1>
          </div>
          {/* Desktop heading */}
          <div className="mb-8">
            <p className="text-[10px] font-black text-[#842327] uppercase tracking-widest mb-1">QC Dashboard</p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.07)]">
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!auth || currentError) {
                setLoginError('ไม่สามารถเชื่อมต่อ Firebase ได้ กรุณาตั้งค่า Config');
                setShowSettings(true);
                return;
              }
              setLoginError('');
              try {
                await signInWithEmailAndPassword(auth, inputUser, inputPass);
              } catch (error) {
                if (error.code === 'auth/invalid-email') setLoginError('รูปแบบอีเมลไม่ถูกต้อง');
                else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') setLoginError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
                else setLoginError('เกิดข้อผิดพลาด: ' + error.message);
              }
            }} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-[#85929E] uppercase tracking-widest mb-2">Email</label>
                <input type="text" value={inputUser} onChange={e=>{setInputUser(e.target.value);setLoginError('');}}
                  className="w-full px-4 py-3.5 bg-[#F8F9FA] border border-slate-200 rounded-xl text-[#2C3E50] text-sm font-semibold outline-none focus:border-[#842327] focus:ring-2 focus:ring-[#842327]/20 transition-all placeholder:text-[#85929E]"
                  placeholder="Enter email" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#85929E] uppercase tracking-widest mb-2">Password</label>
                <input type="password" value={inputPass} onChange={e=>{setInputPass(e.target.value);setLoginError('');}}
                  className="w-full px-4 py-3.5 bg-[#F8F9FA] border border-slate-200 rounded-xl text-[#2C3E50] text-sm font-semibold outline-none focus:border-[#842327] focus:ring-2 focus:ring-[#842327]/20 transition-all placeholder:text-[#85929E]"
                  placeholder="••••••••" />
              </div>
              {loginError && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#DC3545]/10 border border-[#DC3545]/20 rounded-xl">
                  <AlertCircle size={14} className="text-[#DC3545] shrink-0" />
                  <span className="text-[#DC3545] text-xs font-semibold">{loginError}</span>
                </div>
              )}
              <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-[#842327] via-[#D32F2F] to-[#842327] animate-gradient-x shimmer text-white rounded-xl font-black text-sm tracking-wider transition-all shadow-lg shadow-[#842327]/25 hover:shadow-[#842327]/40 hover:-translate-y-0.5 active:scale-[0.98]">
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoadingProjects || (isAuthenticated && !hasCheckedProjects)) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <style>{ANIMATION_STYLES}</style>
        <Loader2 className="animate-spin text-[#842327]" size={32} />
      </div>
    );
  }

  if (needsProjectSelection) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 relative overflow-hidden">
        <style>{ANIMATION_STYLES}</style>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(132,35,39,0.08),rgba(255,255,255,0))] pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#842327]/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#842327] shadow-xl shadow-[#842327]/30 mb-5">
              <Activity size={24} className="text-white" />
            </div>
            <p className="text-[10px] font-black text-[#842327] uppercase tracking-widest mb-1">QC Dashboard</p>
            <h1 className="text-2xl font-black text-[#2C3E50] tracking-tight">เลือกโปรเจกต์</h1>
            <p className="text-[#85929E] text-sm mt-1.5">กรุณาเลือกโปรเจกต์ที่ต้องการเข้าใช้งาน</p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.07)] space-y-2 max-h-[60vh] overflow-y-auto">
            {projects.map((proj) => (
              <button
                key={proj.id}
                type="button"
                onClick={() => handleSelectProject(proj.id)}
                className="w-full text-left flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100/80 hover:border-[#842327]/30 hover:bg-[#F8F9FA] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] border border-slate-200 flex items-center justify-center group-hover:bg-[#842327]/10 group-hover:border-[#842327]/20 transition-all">
                  <FolderOpen size={17} className="text-[#85929E] group-hover:text-[#842327] transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#2C3E50] group-hover:text-[#842327] transition-colors truncate">{proj.name}</p>
                  <p className="text-[10px] text-[#85929E] font-semibold mt-0.5 truncate">{proj.id}</p>
                </div>
                <ChevronRight size={15} className="text-slate-300 group-hover:text-[#842327] transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // MAIN DASHBOARD
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2C3E50] font-sans flex">
      <style>{ANIMATION_STYLES}</style>
      {/* Global Notification */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
        {notifications.map(notif => (
          <div key={notif.id} className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all animate-in slide-in-from-bottom-2 fade-in duration-300
            ${notif.type==='error' ? 'bg-[#DC3545]/95 border-[#DC3545]/50 text-white' : 'bg-[#2C3E50]/95 border-[#2C3E50]/50 text-white'}`}>
            {notif.type==='error' ? <AlertCircle size={16}/> : <CheckCircle size={16} className="text-[#28A745]"/>}
            <span className="text-sm font-semibold">{notif.message}</span>
            <button onClick={()=>setNotifications(p=>p.filter(n=>n.id!==notif.id))} className="ml-2 opacity-50 hover:opacity-100"><X size={13}/></button>
          </div>
        ))}
      </div>

      {/* Startup Month Selector Modal */}
      {showMonthSelector && (
        <MonthSelectorModal
          allAvailableMonths={allAvailableMonths || []}
          selectedStartupMonths={selectedStartupMonths}
          setSelectedStartupMonths={setSelectedStartupMonths}
          setSelectedMonths={setSelectedMonths}
          setShowMonthSelector={setShowMonthSelector}
          loading={loading}
        />
      )}

      {/* ── HOTSHEET MODAL ── */}
      {showHotsheetModal && (
        <HotsheetModal
          hotsheetPath={hotsheetPath}
          setHotsheetPath={setHotsheetPath}
          hotsheetAvailableMonths={hotsheetAvailableMonths}
          selectedHotsheetMonth={selectedHotsheetMonth}
          setSelectedHotsheetMonth={setSelectedHotsheetMonth}
          hotsheetLoading={hotsheetLoading}
          hotsheetFolders={hotsheetFolders}
          filteredHotsheetFiles={filteredHotsheetFiles}
          downloadHotsheetFile={downloadHotsheetFile}
          setShowHotsheetModal={setShowHotsheetModal}
        />
      )}

      {/* Filter Sidebar */}
      <div className={`fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity ${isFilterOpen?'opacity-100':'opacity-0 pointer-events-none'}`} onClick={()=>setIsFilterOpen(false)}/>
      <aside className={`fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ${isFilterOpen?'translate-x-0':'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 font-black text-[#2C3E50]"><Filter size={16} className="text-[#842327]"/>ตัวกรอง</div>
          <button onClick={()=>setIsFilterOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X size={16} className="text-[#85929E]"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-7">
          <button onClick={()=>{setDateRange({start:'',end:''});setSelectedMonths([]);setSelectedSups([]);setSelectedAgents([]);setSelectedResults([]);setSelectedTypes([]);setSelectedTouchpoints([]);setActiveCell({agent:null,resultType:null});setActiveKpiFilter(null);}}
            className="w-full py-2.5 text-xs font-black text-[#842327] bg-[#842327]/10 hover:bg-[#842327]/20 rounded-xl border border-[#842327]/20 transition">ล้างทั้งหมด</button>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black uppercase tracking-widest text-[#85929E]">ช่วงวันที่</label>
              {(dateRange.start||dateRange.end) && <button onClick={()=>setDateRange({start:'',end:''})} className="text-[9px] font-bold text-[#85929E] hover:text-[#DC3545]">ล้าง</button>}
            </div>
            <div className="flex gap-2">
              {[['start','Start'],['end','End']].map(([key,label]) => (
                <div key={key} className="flex-1 space-y-1">
                  <span className="text-[9px] text-[#85929E] font-bold block">{label}</span>
                  <input type="date" value={dateRange[key]} onChange={e=>setDateRange({...dateRange,[key]:e.target.value})}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-[#842327]" />
                </div>
              ))}
            </div>
          </div>
          <FilterSection title="เดือน" items={allAvailableMonths} selectedItems={selectedMonths} onToggle={i=>toggle(i,selectedMonths,setSelectedMonths)} onSelectAll={()=>setSelectedMonths(allAvailableMonths)} onClear={()=>setSelectedMonths([])} />
          <FilterSection title="Touchpoint" items={availableTouchpoints} selectedItems={selectedTouchpoints} onToggle={i=>toggle(i,selectedTouchpoints,setSelectedTouchpoints)} onSelectAll={()=>setSelectedTouchpoints(availableTouchpoints)} onClear={()=>setSelectedTouchpoints([])} />
          <FilterSection title="Supervisor" items={availableSups} selectedItems={selectedSups} onToggle={i=>toggle(i,selectedSups,setSelectedSups)} onSelectAll={()=>setSelectedSups(availableSups)} onClear={()=>setSelectedSups([])} />
          <FilterSection title="ประเภทงาน" items={availableTypes} selectedItems={selectedTypes} onToggle={i=>toggle(i,selectedTypes,setSelectedTypes)} onSelectAll={()=>setSelectedTypes(availableTypes)} onClear={()=>setSelectedTypes([])} />
          <FilterSection title="พนักงาน" items={availableAgents} selectedItems={selectedAgents} onToggle={i=>toggle(i,selectedAgents,setSelectedAgents)} onSelectAll={()=>setSelectedAgents(availableAgents)} onClear={()=>setSelectedAgents([])} maxH="max-h-52" />
          <FilterSection title="ผลการสัมภาษณ์" items={RESULT_ORDER} selectedItems={selectedResults} onToggle={i=>toggle(i,selectedResults,setSelectedResults)} onSelectAll={()=>setSelectedResults(RESULT_ORDER)} onClear={()=>setSelectedResults([])} maxH="max-h-52" />
        </div>
      </aside>

      {/* Main Sidebar */}
      <aside className="hidden md:flex w-64 bg-gradient-to-b from-[#1E0608] via-[#4A1215] to-[#6B1A1E] border-r border-[#2C0A0C] flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="p-5 border-b border-white/[0.07] bg-black/10">
          <Logo dark={true} />
        </div>
        <div className="p-4 flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-2 mb-2 px-2 mt-3">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">เมนูหลัก</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black bg-white/[0.12] text-white shadow-lg shadow-black/30 w-full text-left border border-white/[0.15] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-white/[0.06] to-transparent pointer-events-none" />
            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/30 transition-colors">
              <Zap size={13}/>
            </div>
            <span className="relative z-10">Live QC</span>
            <div className="ml-auto w-2 h-2 rounded-full bg-[#28A745] animate-pulse shadow-[0_0_6px_rgba(40,167,69,0.7)]" />
          </button>
          
          <a href="https://cati-ces.web.app/login" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black text-white/60 hover:bg-white/[0.08] hover:text-white transition-all w-full text-left border border-transparent group">
            <div className="w-6 h-6 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
              <ExternalLink size={13}/>
            </div>
            FW Progress
          </a>

          {userRole !== 'INV' && (
            <button onClick={() => { setShowHotsheetModal(true); setHotsheetPath('Hotsheet'); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black text-white/60 hover:bg-white/[0.08] hover:text-white transition-all w-full text-left border border-transparent group">
              <div className="w-6 h-6 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
                <FolderOpen size={13}/>
              </div>
              Hotsheet
            </button>
          )}

          {userRole === 'Admin' && (
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black text-white/60 hover:bg-white/[0.08] hover:text-white transition-all w-full text-left border border-transparent group">
              <div className="w-6 h-6 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
                <BarChart2 size={13}/>
              </div>
              Dashboard
            </button>
          )}
          {['admin','qc'].includes(String(userRole).toLowerCase()) && (
            <button onClick={handleQuickSync} disabled={isSyncing} className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black text-white/60 hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-40 w-full text-left border border-transparent group">
              <div className="w-6 h-6 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
                <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""}/>
              </div>
              {isSyncing ? 'กำลังดึงข้อมูล...' : 'Sync (500)'}
            </button>
          )}
          {['admin','qc','gallup','gullup'].includes(String(userRole).toLowerCase()) && (
            <button onClick={handleExportCSV} className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black text-white/60 hover:bg-white/[0.08] hover:text-white transition-all w-full text-left border border-transparent group">
              <div className="w-6 h-6 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
                <Download size={13}/>
              </div>
              Export CSV
            </button>
          )}

          <div className="mt-auto">
            {userRole==='Admin' && (
              <>
                <button onClick={() => navigate('/report')} className="flex items-center gap-3 px-4 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 hover:text-white rounded-xl text-xs font-black transition-all w-full text-left mb-2 border border-indigo-400/20 group">
                  <div className="w-6 h-6 rounded-lg bg-indigo-400/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-400/30 transition-colors">
                    <BarChart2 size={13}/>
                  </div>
                  Report
                </button>
                <button onClick={() => navigate('/admin')} className="flex items-center gap-3 px-4 py-3 bg-black/25 hover:bg-black/40 text-white/80 hover:text-white rounded-xl text-xs font-black transition-all shadow-lg w-full text-left mb-2 border border-white/[0.06] group">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                    <Shield size={13}/>
                  </div>
                  จัดการระบบกลาง
                </button>
              </>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-white/[0.07] bg-black/20">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              <User size={14} className="text-white/60" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">Logged in as</div>
              <div className="text-xs font-bold text-white/80 truncate" title={auth?.currentUser?.email || userRole || 'Unknown'}>{auth?.currentUser?.email || userRole || 'Unknown'}</div>
            </div>
          </div>
          <button onClick={() => {
            if(auth) signOut(auth);
            try{ localStorage.removeItem('active_project_id'); } catch(e){}
            setActiveProjectId('');
          }} className="flex items-center justify-center gap-2 w-full p-2.5 bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] hover:border-white/15 text-white/60 hover:text-white rounded-xl transition-all font-bold text-xs" title="Logout">
            <User size={13}/> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
        <div className="max-w-screen-2xl w-full mx-auto p-4 md:p-6 space-y-5">

        {/* ── HEADER ── */}
        <header className="bg-white/85 backdrop-blur-2xl rounded-3xl border border-slate-200/60 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] px-6 py-4 flex items-center justify-between gap-4 sticky top-4 z-30 transition-all">
          <div className="flex items-center gap-4">
            <div className="md:hidden">
               <Logo dark={false}/>
            </div>
            <div className="hidden md:block">
              <h1 className="font-black text-[#2C3E50] text-xl tracking-tight flex items-center gap-2">
                QC Report {activeProject?.name ? `: ${activeProject.name}` : ''}
                <button onClick={() => setNeedsProjectSelection(true)} className="ml-2 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition border border-slate-200">
                  เปลี่ยน
                </button>
                {loading && <RefreshCw size={14} className="animate-spin text-[#842327]" />}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#28A745] animate-pulse" />
                <span className="text-[10px] text-[#85929E] font-semibold">LIVE · {projectData.length} รายการ</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setIsFilterOpen(true)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black border transition
                ${hasActiveFilters ? 'bg-[#842327] border-[#842327] text-white shadow-md' : 'bg-[#F8F9FA] border-slate-200 text-[#85929E] hover:bg-slate-100'}`}>
              <Filter size={14}/> ตัวกรอง {hasActiveFilters ? '●' : ''}
            </button>
          </div>
        </header>

        <div className="md:hidden mb-4">
           <h1 className="font-black text-[#2C3E50] text-lg tracking-tight flex items-center gap-2">
             QC Report {activeProject?.name ? `: ${activeProject.name}` : ''}
             <button onClick={() => setNeedsProjectSelection(true)} className="ml-2 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition border border-slate-200">
               เปลี่ยน
             </button>
             {loading && <RefreshCw size={14} className="animate-spin text-[#842327]" />}
           </h1>
           <div className="flex items-center gap-1.5 mt-0.5">
             <div className="w-1.5 h-1.5 rounded-full bg-[#28A745] animate-pulse" />
             <span className="text-[10px] text-[#85929E] font-semibold">LIVE · {projectData.length} รายการ</span>
           </div>
        </div>

        {loading && projectData.length === 0 ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-slate-200/70 rounded-2xl h-[104px]"></div>)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
              <div className="bg-slate-200/70 rounded-2xl h-64"></div>
              <div className="bg-slate-200/70 rounded-2xl h-64"></div>
            </div>
            <div className="bg-slate-200/70 rounded-2xl h-96 animate-pulse"></div>
          </>
        ) : (
          <>
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
            slate: { bg: 'bg-gradient-to-br from-white to-slate-50', border: 'border-slate-200/80', icon: 'text-slate-500 bg-slate-100', val: 'text-slate-700', activeBg: 'bg-slate-50 ring-2 ring-slate-400 shadow-md', accent: 'bg-slate-400' },
            indigo: { bg: 'bg-gradient-to-br from-white to-indigo-50/40', border: 'border-indigo-100/80', icon: 'text-indigo-600 bg-indigo-100', val: 'text-indigo-900', activeBg: 'bg-indigo-50 ring-2 ring-indigo-400 shadow-md', accent: 'bg-indigo-500' },
            emerald: { bg: 'bg-gradient-to-br from-white to-emerald-50/50', border: 'border-emerald-100/80', icon: 'text-emerald-600 bg-emerald-100', val: 'text-emerald-700', activeBg: 'bg-emerald-50 ring-2 ring-emerald-400 shadow-md', accent: 'bg-emerald-500' },
            amber: { bg: 'bg-gradient-to-br from-white to-amber-50/50', border: 'border-amber-100/80', icon: 'text-amber-600 bg-amber-100', val: 'text-amber-700', activeBg: 'bg-amber-50 ring-2 ring-amber-400 shadow-md', accent: 'bg-amber-500' },
            rose: { bg: 'bg-gradient-to-br from-white to-rose-50/50', border: 'border-rose-100/80', icon: 'text-rose-600 bg-rose-100', val: 'text-rose-700', activeBg: 'bg-rose-50 ring-2 ring-rose-400 shadow-md', accent: 'bg-rose-500' },
            };
            const s = schemes[kpi.scheme];
            return (
              <button key={kpi.id||'total'} onClick={()=>{ if(kpi.id === null) setActiveKpiFilter(null); else setActiveKpiFilter(isActive ? null : kpi.id); }}
              className={`text-left p-5 rounded-2xl border transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] active:scale-95 group relative overflow-hidden
                ${isActive ? s.activeBg : `${s.bg} ${s.border} shadow-sm`}`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${s.accent} transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'}`}/>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${s.icon}`}>
                <kpi.icon size={15}/>
                </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{kpi.label}</p>
              <div className={`text-2xl font-black mt-1.5 tracking-tight ${s.val}`}>
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
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300">
            <h3 className="font-black text-[#2C3E50] text-sm flex items-center gap-2 mb-4 uppercase tracking-wide">
              <div className="w-7 h-7 rounded-lg bg-[#F8F9FA] border border-slate-200 flex items-center justify-center"><PieChart size={13} className="text-[#85929E]"/></div>
              Case Composition
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-40 h-40 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="count" innerRadius={48} outerRadius={68} paddingAngle={3} onClick={(data) => toggle(data.payload.full || data.full, selectedResults, setSelectedResults)}>
                      {chartData.map((e,i) => <Cell key={i} fill={e.color} className="cursor-pointer hover:opacity-80 outline-none transition-all"/>)}
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
                      <span className="text-[10px] text-[#85929E] font-semibold truncate">{c.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-[#2C3E50] shrink-0">{c.count} <span className="text-[#85929E] font-normal">({c.percent}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Bar */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300">
            <h3 className="font-black text-[#2C3E50] text-sm flex items-center gap-2 mb-4 uppercase tracking-wide">
              <div className="w-7 h-7 rounded-lg bg-[#28A745]/10 flex items-center justify-center"><BarChart2 size={13} className="text-[#28A745]"/></div>
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
                        <p className="text-[10px] text-[#85929E] font-bold mb-1">{label}</p>
                        <p className="text-[#28A745] font-black text-base">{payload[0].value}%</p>
                        <p className="text-[10px] text-[#85929E]">{payload[0].payload.audited} / {payload[0].payload.total} เคส</p>
                      </div>
                    ) : null} />
                  <Bar dataKey="percent" radius={[5,5,0,0]} barSize={32} onClick={(data) => toggle(data.name, selectedMonths, setSelectedMonths)}>
                    {monthlyData.map((e,i)=><Cell key={i} fill={e.percent>=100?'#842327':'#28A745'} className="cursor-pointer hover:opacity-80 outline-none transition-all"/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── MATRIX TABLE ── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-[#2C3E50] text-sm flex items-center gap-2 uppercase tracking-wide">
              <div className="w-7 h-7 rounded-lg bg-[#F8F9FA] flex items-center justify-center border border-slate-200"><Users size={13} className="text-[#85929E]"/></div>
              สรุปพนักงาน × ผลการตรวจ
            </h3>
            <span className="text-[10px] text-[#85929E] font-semibold">{agentSummary.length} พนักงาน</span>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs border-separate border-spacing-0 min-w-max">
              <thead className="sticky top-0 z-20 bg-white shadow-sm">
                <tr>
                  <th className="sticky left-0 z-30 px-6 py-3 text-left text-[10px] font-black text-[#85929E] uppercase tracking-widest border-b border-r border-slate-200 bg-[#F8F9FA] min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Interviewer</th>
                  {(RESULT_ORDER || []).map(type => (
                    <th key={type} className="px-3 py-3 text-center text-[10px] font-black border-b border-slate-200 bg-white max-w-[120px]">
                      <span className="line-clamp-2 leading-tight" style={{color:getResultColor(type)}}>{formatResultDisplay(type)}</span>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-center text-[10px] font-black text-[#85929E] uppercase tracking-widest border-b border-slate-200 bg-[#F8F9FA] min-w-[80px]">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agentSummary.map((agent,i) => (
                  <tr key={i} className="hover:bg-[#F8F9FA] transition-colors group">
                    <td className="sticky left-0 z-10 px-6 py-3.5 font-bold text-[13px] text-[#2C3E50] border-r border-slate-200 bg-white group-hover:bg-[#F8F9FA] transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{agent.name}</td>
                    {(RESULT_ORDER || []).map(type => {
                      const val = agent[type];
                      const isActive = activeCell.agent===agent.name && activeCell.resultType===type;
                      return (
                        <td key={type} onClick={()=>val>0&&setActiveCell(p=>p.agent===agent.name&&p.resultType===type?{agent:null,resultType:null}:{agent:agent.name,resultType:type})}
                          className={`px-3 py-3.5 text-center transition-all border-r border-slate-100
                            ${val>0?'cursor-pointer':''} ${isActive?'bg-[#842327]/10':''}`}>
                          {val > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className="font-black text-sm" style={{color:getResultColor(type)}}>{val}</span>
                              <span className="text-[10px] text-[#85929E]">{agent.total>0?((val/agent.total)*100).toFixed(0):0}%</span>
                            </div>
                          ) : <span className="text-slate-200">·</span>}
                        </td>
                      );
                    })}
                    <td className="px-6 py-3.5 text-center bg-[#F8F9FA]">
                      <span className="font-black text-[#2C3E50]">{agent.total}</span>
                      <div className="text-[10px] text-[#85929E]">{totalSummary.total>0?((agent.total/totalSummary.total)*100).toFixed(1):0}%</div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 border-t-2 border-slate-200 font-black">
                  <td className="sticky left-0 z-10 px-6 py-4 text-[#842327] font-black text-[13px] uppercase border-r border-slate-200 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">GRAND TOTAL</td>
                  {(RESULT_ORDER || []).map(type => {
                    const val = totalSummary[type];
                    return (
                      <td key={type} className="px-3 py-4 text-center border-r border-slate-200">
                        <span className="font-black text-sm" style={{color:getResultColor(type)}}>{val||0}</span>
                        <div className="text-[10px] text-[#85929E]">{totalSummary.total>0?((val/totalSummary.total)*100).toFixed(1):0}%</div>
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-center bg-slate-200">
                    <span className="font-black text-[#842327] text-base">{totalSummary.total}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── TREND CHART ── */}
        {activeCell.agent && trendData.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-slate-700 text-sm flex items-center gap-2 uppercase">
                <TrendingUp size={15} className="text-[#842327]"/>
                Trend: <span className="text-[#842327]">{activeCell.agent}</span>
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
        <div id="detail-section" className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
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
                className="w-full pl-9 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 placeholder:text-slate-400"/>
              {isSearchingDB ? (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
              ) : dbSearchResults !== null ? (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-600 bg-indigo-100 px-2 py-1 rounded-lg">พบ {dbSearchResults.length}</div>
              ) : null}
            </div>
          </div>
          <div className="overflow-auto max-h-[800px]">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100">
                  {['วันที่ / เลขชุด / Touchpoint','พนักงาน','ผลสรุป','Comment','Audio'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {detailLogs.length > 0 ? detailLogs.slice(0,displayLimit).map(item => {
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[10px] font-black text-slate-500">
                              <Hash size={9}/>{item.questionnaireNo}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-[10px] font-black text-indigo-500">
                              <MapPin size={9}/>{item.touchpoint}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-[13px] text-slate-700 flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors">
                            {item.agent}
                            {isExpanded ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400"/>}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">{item.type} · {item.supervisor||item.supervisorFilter}</div>
                        </td>
                        <td className="px-4 py-4"><StatusBadge result={item.result}/></td>
                        <td className="px-6 py-4 max-w-[200px]">
                          <p className="text-slate-500 truncate italic text-xs" title={item.comment}>{item.comment ? `"${item.comment}"` : '—'}</p>
                        </td>
                        <td className="px-4 py-4 min-w-[340px]">
                          {hasAudio
                            ? (() => {
                                const dId = getDriveId(item.audio);
                                return (
                                  <div className="flex items-center gap-2 p-1.5 bg-slate-50/80 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all w-[320px] shadow-sm" onClick={e=>e.stopPropagation()}>
                                    <div className="flex-1 rounded-lg overflow-hidden h-[36px] flex items-center bg-white shadow-inner border border-slate-100">
                                      {dId ? (
                                        <iframe src={`https://drive.google.com/file/d/${dId}/preview`} style={{ width: '100%', height: '42px', border: 'none', transform: 'translateY(-2px)', filter: 'invert(0.95) hue-rotate(180deg)' }} allow="autoplay"></iframe>
                                      ) : (
                                        <audio controls src={item.audio} preload="none" className="h-[36px] w-full outline-none" style={{ colorScheme: 'light' }} />
                                      )}
                                    </div>
                                    <a href={item.audio} target="_blank" rel="noopener noreferrer" className="w-[36px] h-[36px] flex items-center justify-center bg-white hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 text-slate-400 rounded-lg transition-all shadow-sm border border-slate-200 shrink-0" title="เปิดลิงก์เสียง">
                                      <ExternalLink size={14}/>
                                    </a>
                                  </div>
                                );
                              })()
                            : <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-400 rounded-md text-[9px] font-black uppercase border border-slate-100">
                                <FilterX size={10}/> ไม่พบเสียง
                              </span>
                          }
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={5} className="px-8 py-6">
                            <div className="flex items-center justify-between mb-5">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white border border-slate-200 rounded-xl"><Award size={16} className="text-indigo-600"/></div>
                                <div>
                                  <h4 className="font-black text-slate-700 text-xs uppercase tracking-wide">{isNew?'Start Audit':'Assessment Detail'} — {item.interviewerId} : {item.rawName}</h4>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{isNew?'กรุณากรอกคะแนนและผลสรุปเพื่อบันทึก':'แก้ไขผลการตรวจ'}</p>
                                </div>
                              </div>
                              {['admin','qc','gallup','gullup'].includes(String(userRole).toLowerCase()) ? (
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
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1"><Info size={12}/> ประเภทงาน & Supervisor</p>
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
                                      {activeSupervisors.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <ChevronDown size={11} className="absolute right-3 top-1/2 text-slate-400 pointer-events-none"/>
                                  </div>
                                  {editingCase.type==='ยังไม่ได้ตรวจ' && <p className="text-rose-500 text-[10px] font-black uppercase self-center animate-pulse">*** เลือก AC หรือ BC</p>}
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
                                  <p className="text-[10px] text-slate-400">{hasAudio?'คลิกเพื่อฟัง':'ไม่พบไฟล์เสียง'}</p>
                                </div>
                              </div>
                              {hasAudio
                                ? (() => {
                                    const dId = getDriveId(item.audio);
                                    return (
                                      <div className="flex-1 max-w-lg w-full ml-4 flex items-center gap-2 p-1.5 bg-slate-50/80 border border-slate-200 rounded-xl shadow-sm">
                                        <div className="flex-1 rounded-lg overflow-hidden h-[40px] flex items-center bg-white shadow-inner border border-slate-100">
                                          {dId ? (
                                            <iframe src={`https://drive.google.com/file/d/${dId}/preview`} style={{ width: '100%', height: '46px', border: 'none', transform: 'translateY(-2px)', filter: 'invert(0.95) hue-rotate(180deg)' }} allow="autoplay"></iframe>
                                          ) : (
                                            <audio controls src={item.audio} preload="none" className="h-[40px] w-full outline-none" style={{ colorScheme: 'light' }} />
                                          )}
                                        </div>
                                        <a href={item.audio} target="_blank" rel="noopener noreferrer"
                                          className="px-4 h-[40px] bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm shrink-0" title="เปิดไฟล์เสียงในหน้าใหม่">
                                          <ExternalLink size={14}/> เปิดหน้าต่างใหม่
                                        </a>
                                      </div>
                                    );
                                  })()
                                : <span className="px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 border border-slate-200">
                                    <FilterX size={11}/> ไม่พบ
                                  </span>
                              }
                            </div>

                            {/* Result Selector */}
                            <div className="mb-5 p-4 bg-white border border-slate-200 rounded-xl" onClick={e=>e.stopPropagation()}>
                              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1"><Star size={11}/> ผลการสัมภาษณ์ (Column M)</p>
                              {isEditing
                                ? <div className="relative">
                                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                                      value={editingCase.result} onChange={e=>setEditingCase({...editingCase,result:e.target.value})}>
                                {(RESULT_ORDER || []).map(o=><option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                  </div>
                                : <p className="text-xs font-semibold text-slate-600 italic leading-relaxed">{item.result}</p>
                              }
                            </div>

                            {/* Evaluations */}
                            {isEditing ? (
                              <div className="mb-5 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl" onClick={e=>e.stopPropagation()}>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1"><CheckSquare size={12}/> ประเมินผล (Criteria 1-13)</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {(editingCase.evaluations || []).map((e,i) => (
                                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between" title={(CRITERIA_DESCRIPTIONS || [])[i] || e.label}>
                                      <p className="text-[10px] font-bold text-slate-600 mb-2 line-clamp-2 leading-tight" title={(CRITERIA_DESCRIPTIONS || [])[i] || e.label}>
                                        {(CRITERIA_DESCRIPTIONS || [])[i] || e.label}
                                      </p>
                                      <div className="relative mt-auto">
                                        <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                                          value={e.value || '-'} onChange={(event)=>{
                                            const newEvals = [...editingCase.evaluations];
                                            newEvals[i].value = event.target.value;
                                            setEditingCase({...editingCase, evaluations: newEvals});
                                          }}>
                                          {Object.keys(SCORE_LABELS || {}).map(k => <option key={k} value={k}>{(SCORE_LABELS || {})[k]}</option>)}
                                        </select>
                                        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2 mb-5">
                                {(item.evaluations || []).map((e,i) => (
                                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-2.5" title={(CRITERIA_DESCRIPTIONS || [])[i] || e.label}>
                                    <p className="text-[9px] font-black text-slate-400 uppercase truncate mb-1.5">{e.label}</p>
                                    <span className={`text-xs font-black ${e.value==='5'||e.value==='4'?'text-emerald-500':e.value==='1'||e.value==='2'?'text-rose-500':'text-slate-300'}`}>
                                      {(SCORE_LABELS || {})[e.value]||e.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Comment */}
                            <div onClick={e=>e.stopPropagation()}>
                              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-1"><MessageSquare size={11}/> QC Comment (Column N)</p>
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
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 text-sm font-semibold italic">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td></tr>
                )}
              </tbody>
            </table>
            {detailLogs.length > displayLimit && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                <button onClick={() => setDisplayLimit(p => p + 50)}
                  className="px-6 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-500 text-xs font-black rounded-xl transition shadow-sm">
                  โหลดข้อมูลเพิ่มเติม ({detailLogs.length - displayLimit} รายการ)
                </button>
              </div>
            )}
          </div>
        </div>
          </>
        )}

      </div>
    </div>
    </div>
  );
}
