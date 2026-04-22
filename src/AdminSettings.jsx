import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Users, Database, Shield, ArrowLeft, Plus, FolderKanban, Activity, Cloud, RefreshCw, Upload, FileJson, AlertOctagon, Trash2, Loader2, CheckCircle, Lock, Flame, RotateCcw } from 'lucide-react';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { useFirebase } from './useFirebase';
import { Logo } from './UiComponents';
import { RESULT_ORDER, DEFAULT_SUPERVISORS } from './constants';

const AdminSettings = () => {
  const navigate = useNavigate();
  const { db, userRole, isAuthenticated, firebaseConfigStr, setFirebaseConfigStr } = useFirebase();
  
  // State สำหรับการตั้งค่า
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(() => {
    try { return localStorage.getItem('active_project_id') || ''; } catch(e) { return ''; }
  });
  const [projectName, setProjectName] = useState('');
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // State สำหรับ Database (Import/Sync)
  const [importStatus, setImportStatus] = useState(null);
  const [importJson, setImportJson] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // State สำหรับ Users (Supervisors)
  const [supervisorsData, setSupervisorsData] = useState([]);
  const [newSupervisor, setNewSupervisor] = useState('');

  // State สำหรับ User-Project Access
  const [usersList, setUsersList] = useState([]);
  const [userProjectAccess, setUserProjectAccess] = useState({});
  const [accessSaving, setAccessSaving] = useState({});

  // Navigation: 'project' | 'access' | 'firebase'
  const [activeView, setActiveView] = useState('project');

  // State สำหรับ Firebase Config Editor
  const [localFirebaseConfig, setLocalFirebaseConfig] = useState(() => {
    try { return JSON.parse(firebaseConfigStr || '{}'); } catch { return {}; }
  });
  const [configSaveStatus, setConfigSaveStatus] = useState(null);

  // โหลดการตั้งค่าจาก Firestore เมื่อเปิดหน้า
  useEffect(() => {
    if (!db) return;
    const fetchAdminData = async () => {
      try {
        // ดึงข้อมูลโปรเจกต์ทั้งหมด
        const snap = await getDocs(collection(db, 'projects'));
        let projs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // ถ้ายังไม่มีโปรเจกต์เลย ให้สร้างค่าเริ่มต้น
        if (projs.length === 0) {
          const docRef = await addDoc(collection(db, 'projects'), {
            name: 'CATI CES 2026',
            appsScriptUrl: '',
            supervisors: [],
            createdAt: serverTimestamp()
          });
          projs = [{ id: docRef.id, name: 'CATI CES 2026', appsScriptUrl: '', supervisors: [] }];
        }
        
        setProjects(projs);

        let currentActive = activeProjectId || (projs.length > 0 ? projs[0].id : '');
        if (!currentActive || !projs.find(p => p.id === currentActive)) {
          currentActive = projs[0].id;
          try { localStorage.setItem('active_project_id', currentActive); } catch(e) {}
        }
        setActiveProjectId(currentActive);

        const activeProj = projs.find(p => p.id === currentActive);
        setProjectName(activeProj?.name || '');
        setAppsScriptUrl(activeProj?.appsScriptUrl || '');
        setSupervisorsData(activeProj?.supervisors || []);

        // ดึง users ทั้งหมดจาก user_roles
        const usersSnap = await getDocs(collection(db, 'user_roles'));
        const users = usersSnap.docs.map(d => ({ email: d.id, ...d.data() }));
        setUsersList(users);

        // ดึง user_project_access ทั้งหมด
        const accessSnap = await getDocs(collection(db, 'user_project_access'));
        const accessMap = {};
        accessSnap.docs.forEach(d => { accessMap[d.id] = d.data().projects || []; });
        setUserProjectAccess(accessMap);
      } catch (err) {
        console.error("Error fetching admin data:", err);
      }
    };
    fetchAdminData();
  }, [db]);
  
  const switchProject = (id) => {
    try { localStorage.setItem('active_project_id', id); } catch(e) {}
    setActiveProjectId(id);
    setActiveView('project');
    const activeProj = projects.find(p => p.id === id);
    if (activeProj) {
      setProjectName(activeProj.name || '');
      setAppsScriptUrl(activeProj.appsScriptUrl || '');
      setSupervisorsData(activeProj.supervisors || []);
    }
  };
  
  const handleCreateProject = async () => {
    const name = prompt("ตั้งชื่อโปรเจกต์ใหม่:");
    if (!name) return;
    try {
      const newProj = { name, appsScriptUrl: '', supervisors: [], createdAt: serverTimestamp() };
      const docRef = await addDoc(collection(db, 'projects'), newProj);
      setProjects(prev => [...prev, { id: docRef.id, ...newProj }]);
      try { localStorage.setItem('active_project_id', docRef.id); } catch(e) {}
      setActiveProjectId(docRef.id);
      setProjectName(name);
      setAppsScriptUrl('');
      setSupervisorsData([]);
    } catch(e) {
      alert("Error: " + e.message);
    }
  };

  // --- ฟังก์ชันบันทึกการตั้งค่า (Settings) ---
  const handleSaveSettings = async () => {
    if (!db || !activeProjectId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'projects', activeProjectId), {
        name: projectName, appsScriptUrl, updatedAt: serverTimestamp()
      }, { merge: true });
      setProjects(projects.map(p => p.id === activeProjectId ? { ...p, name: projectName, appsScriptUrl } : p));
      setImportStatus({ type: 'success', msg: 'บันทึกการตั้งค่าลง Database สำเร็จ ✅' });
      setTimeout(() => setImportStatus(null), 3000);
    } catch (e) {
      setImportStatus({ type: 'error', msg: 'เกิดข้อผิดพลาด: ' + e.message });
    }
    setIsSaving(false);
  };

  // --- ฟังก์ชันจัดการ Supervisor ---
  const handleAddSupervisor = async () => {
    if (!newSupervisor.trim() || !db || !activeProjectId) return;
    try {
      const newSups = [...supervisorsData, newSupervisor.trim()];
      await setDoc(doc(db, "projects", activeProjectId), { supervisors: newSups }, { merge: true });
      setSupervisorsData(newSups);
      setNewSupervisor('');
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleDeleteSupervisor = async (name) => {
    if (!db || !activeProjectId || !window.confirm(`ยืนยันการลบรายชื่อ Supervisor: ${name} หรือไม่?`)) return;
    try {
      const newSups = supervisorsData.filter(s => s !== name);
      await setDoc(doc(db, "projects", activeProjectId), { supervisors: newSups }, { merge: true });
      setSupervisorsData(newSups);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // --- ฟังก์ชันกู้คืนข้อมูลเก่า (Migration) ---
  const handleMigrateOldData = async () => {
    if (!db || !activeProjectId) return;
    if (!window.confirm('ยืนยันการดึงข้อมูลเก่า (ที่ยังไม่มี Project ID) เข้ามาในโปรเจกต์นี้หรือไม่?\n\nข้อมูลการตรวจ (QC) ทั้งหมดของคุณจะกลับมาแสดงผลตามปกติ')) return;

    setImportStatus({ type: 'loading', msg: '⏳ กำลังอัปเกรดและดึงข้อมูลเก่า...' });
    try {
      let count = 0;
      const migrateCollection = async (colName) => {
        const snap = await getDocs(collection(db, colName));
        const chunks = [];
        let current = [];
        snap.forEach(d => {
          const data = d.data();
          // ถ้ายังไม่มี projectId ให้เตรียมย้ายไปไอดีใหม่
          if (!data.projectId && !d.id.startsWith(activeProjectId + '_')) {
            current.push({ oldRef: d.ref, newId: `${activeProjectId}_${d.id}`, data });
            if (current.length === 200) { chunks.push(current); current = []; }
          }
        });
        if (current.length > 0) chunks.push(current);

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(item => {
            const newRef = doc(db, colName, item.newId);
            batch.set(newRef, { ...item.data, projectId: activeProjectId });
            batch.delete(item.oldRef);
            count++;
          });
          await batch.commit();
        }
      };

      await migrateCollection("audit_cases");
      await migrateCollection("interview_responses");

      setImportStatus({ type: 'success', msg: `✅ ดึงข้อมูลเก่าสำเร็จ (${count} รายการ) กำลังรีเฟรช...` });
      setTimeout(() => window.location.reload(), 2500);
    } catch (e) {
      setImportStatus({ type: 'error', msg: "Migration Failed: " + e.message });
    }
  };

  // --- ฟังก์ชันล้าง Database ---
  const executeClearDatabase = async () => {
    setShowClearConfirm(false);
    if (!db || !activeProjectId) return;
    setImportStatus({ type: 'loading', msg: '⏳ Deleting all records...' });
    try {
      const q = query(collection(db, "audit_cases"), where("projectId", "==", activeProjectId));
      const snap = await getDocs(q);
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

  // --- ฟังก์ชัน Sync/Import ข้อมูล (ย้ายมาจาก App.jsx) ---
  const processAndUploadData = async (rawData) => {
    if (!db || !activeProjectId) { alert("ไม่พบการเชื่อมต่อ Database หรือไม่ได้เลือกโปรเจกต์"); return; }
    try {
      if (!Array.isArray(rawData)) throw new Error("ข้อมูลต้องเป็น Array [...]");
      setImportStatus({ type: 'loading', msg: `Analyzing ${rawData.length} records...` });
      const uniqueMonthsInUpload = new Set();
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
            norm = {
              month: item[2]||'N/A', date: item[3] ? String(item[3]).split('T')[0] : new Date().toISOString().split('T')[0],
              questionnaireNo: item[4] ? String(item[4]) : '-', touchpoint: item[5]||'N/A',
              agent: `${item[9]||'-'} : ${item[10]||'-'}`, interviewerId: item[9]||'-', rawName: item[10]||'-',
              supervisor: item[7]||'', supervisorFilter: item[7]||'N/A', type: item[6]||'ยังไม่ได้ตรวจ',
              audio: item[11] ? String(item[11]).trim() : '', result: matchResult(item[12]), comment: item[13]||'',
              evaluations: evals, timestamp: serverTimestamp(), projectId: activeProjectId
            };
          } else {
            const rawQNo = (getVal(item,['questionnaireNo','QuestionnaireNo'])||'').trim().replace(/\//g,'_');
            const baseDocId = (rawQNo && rawQNo !== '-' && rawQNo.toUpperCase() !== 'N/A') ? rawQNo : doc(collection(db,"audit_cases")).id;
            docId = `${activeProjectId}_${baseDocId}`;
            const evals = Array.isArray(item.evaluations) ? item.evaluations : Array(13).fill(0).map((_,i) => ({ label:`Criteria ${i+1}`, value: String(item[`P${i+1}`]||item[`Criteria ${i+1}`]||'-') }));
            norm = {
              month: item.month||item.Month||'N/A', date: item.date||item.Date||new Date().toISOString().split('T')[0],
              questionnaireNo: item.questionnaireNo||item.QuestionnaireNo||'-', touchpoint: item.touchpoint||item.Touchpoint||'N/A',
              agent: item.agent||item.Agent||'Unknown', interviewerId: (item.agent||'').split(':')[0]?.trim()||'-', rawName: (item.agent||'').split(':')[1]?.trim()||'-',
              type: item.type||item.Type||'ยังไม่ได้ตรวจ', supervisor: item.supervisor||'', supervisorFilter: item.supervisorFilter||item.supervisor||'N/A',
              result: matchResult(item.result||item.Result), comment: item.comment||item.Comment||'', audio: getVal(item,['Link ไฟล์เสียง','ไฟล์เสียง','audio','Audio']),
              evaluations: evals, timestamp: serverTimestamp(), projectId: activeProjectId
            };
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
        setImportStatus({ type: 'success', msg: `✅ Sync Complete! ${total} records.` });
        setTimeout(() => setImportStatus(null), 5000);
      }
      if (uniqueMonthsInUpload.size > 0) {
        const monthsRef = doc(db, "metadata", "months");
        const docSnap = await getDoc(monthsRef);
        const existingMonths = docSnap.exists() ? docSnap.data().all || [] : [];
        const newMonths = new Set([...existingMonths, ...Array.from(uniqueMonthsInUpload)]);
        await setDoc(monthsRef, { all: Array.from(newMonths) }, { merge: true });
      }
    } catch (e) {
      setImportStatus({ type: 'error', msg: "Upload Failed: " + e.message });
      setTimeout(() => setImportStatus(null), 8000);
    }
  };

  const handleBulkImport = async () => {
    if (!importJson) { alert("กรุณาวาง JSON Data"); return; }
    setImportStatus({ type: 'loading', msg: 'Validating JSON...' });
    setTimeout(async () => {
      try { await processAndUploadData(JSON.parse(importJson)); setImportJson(''); }
      catch (e) { setImportStatus({ type: 'error', msg: "Invalid JSON" }); }
    }, 400);
  };

  const handleSyncFromSheet = async (fullSync = false) => {
    if (!appsScriptUrl) { setImportStatus({ type: 'error', msg: "กรุณาระบุ Web App URL ในแท็บตั้งค่าระบบกลาง" }); return; }
    setImportStatus({ type: 'loading', msg: 'Fetching from Google Sheets...' });
    try {
      const res = await fetch(appsScriptUrl);
      if (!res.ok) throw new Error("Fetch failed");
      const json = await res.json();
      let rows = Array.isArray(json) ? json : (json.data || []);
      if (!rows.length) throw new Error("No data found in Sheet");
      const header = rows[0];
      let dataRows = rows.slice(1).filter(row => {
        const values = Array.isArray(row) ? row : Object.values(row);
        return values.some(val => val !== null && val !== undefined && String(val).trim() !== '');
      });
      if (!fullSync && dataRows.length > 500) dataRows = dataRows.slice(-500);
      await processAndUploadData([header, ...dataRows]);
    } catch (e) {
      setImportStatus({ type: 'error', msg: "Sync Error: " + e.message });
      setTimeout(() => setImportStatus(null), 5000);
    }
  };

  // --- ฟังก์ชันจัดการ User-Project Access ---
  const handleToggleProjectAccess = async (email, projectId, currentlyAllowed) => {
    if (!db) return;
    setAccessSaving(prev => ({ ...prev, [`${email}_${projectId}`]: true }));
    try {
      const current = userProjectAccess[email] || null;
      let updated;
      if (current === null) {
        // null = เห็นทุกโปรเจค → เปลี่ยนเป็นเฉพาะที่เลือก (ยกเว้นอันที่เพิ่ง untick)
        const allIds = projects.map(p => p.id);
        updated = currentlyAllowed ? allIds.filter(id => id !== projectId) : [...allIds, projectId];
      } else {
        updated = currentlyAllowed ? current.filter(id => id !== projectId) : [...current, projectId];
      }
      await setDoc(doc(db, 'user_project_access', email), { projects: updated, updatedAt: serverTimestamp() });
      setUserProjectAccess(prev => ({ ...prev, [email]: updated }));
    } catch (e) {
      alert("Error: " + e.message);
    }
    setAccessSaving(prev => ({ ...prev, [`${email}_${projectId}`]: false }));
  };

  const handleGrantAllProjects = async (email) => {
    if (!db) return;
    setAccessSaving(prev => ({ ...prev, [`${email}_all`]: true }));
    try {
      await setDoc(doc(db, 'user_project_access', email), { projects: [], updatedAt: serverTimestamp() });
      setUserProjectAccess(prev => ({ ...prev, [email]: [] }));
    } catch (e) {
      alert("Error: " + e.message);
    }
    setAccessSaving(prev => ({ ...prev, [`${email}_all`]: false }));
  };

  const isProjectAllowed = (email, projectId) => {
    const access = userProjectAccess[email];
    if (access === null || access === undefined) return true;
    if (access.length === 0) return true;
    return access.includes(projectId);
  };

  // --- ฟังก์ชัน Firebase Config ---
  const FIREBASE_CONFIG_KEYS = [
    { key: 'apiKey',            label: 'API Key',             placeholder: 'AIzaSy...' },
    { key: 'authDomain',        label: 'Auth Domain',         placeholder: 'your-project.firebaseapp.com' },
    { key: 'projectId',         label: 'Project ID',          placeholder: 'your-project-id' },
    { key: 'storageBucket',     label: 'Storage Bucket',      placeholder: 'your-project.firebasestorage.app' },
    { key: 'messagingSenderId', label: 'Messaging Sender ID', placeholder: '123456789' },
    { key: 'appId',             label: 'App ID',              placeholder: '1:123...:web:abc...' },
  ];

  const handleSaveFirebaseConfig = () => {
    try {
      const configStr = JSON.stringify(localFirebaseConfig, null, 2);
      localStorage.setItem('firebase_config_str', configStr);
      setFirebaseConfigStr(configStr);
      setConfigSaveStatus('success');
      setTimeout(() => { setConfigSaveStatus(null); window.location.reload(); }, 1200);
    } catch (e) {
      setConfigSaveStatus('error');
    }
  };

  const handleResetFirebaseConfig = () => {
    if (!window.confirm('รีเซ็ตกลับเป็นค่าจาก .env ไฟล์?')) return;
    localStorage.removeItem('firebase_config_str');
    window.location.reload();
  };

  const activeSupervisorsList = [...new Set([...(DEFAULT_SUPERVISORS || []), ...(supervisorsData || [])])];

  // ระบบป้องกัน: ถ้าไม่ใช่ Admin จะถูกดีดกลับหน้าหลัก
  if (!isAuthenticated || userRole !== 'Admin') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Shield size={56} className="text-rose-500 mb-4" />
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Access Denied</h2>
        <p className="text-slate-400 mb-6 font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (สำหรับผู้ดูแลระบบเท่านั้น)</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black transition shadow-lg shadow-indigo-900/20">
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
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

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl transition">
            <ArrowLeft size={18} />
          </button>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-3">
            <Logo />
            <span className="bg-rose-100 text-rose-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-rose-200">
              Admin Center
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-700">ผู้ดูแลระบบ</p>
            <p className="text-[10px] font-bold text-emerald-500">สถานะ: ออนไลน์</p>
          </div>
          <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-500">
            <Shield size={18} />
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar */}
        <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">

          {/* โปรเจกต์ */}
          <div className="p-4 flex items-center justify-between border-b border-slate-100 shrink-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">โปรเจกต์</span>
            <button onClick={handleCreateProject} className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition" title="เพิ่มโปรเจกต์ใหม่">
              <Plus size={13} />
            </button>
          </div>
          <div className="p-2 space-y-0.5 flex-1 overflow-y-auto">
            {projects.map(p => {
              const isActive = activeView === 'project' && p.id === activeProjectId;
              return (
                <button key={p.id} onClick={() => switchProject(p.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left
                    ${isActive ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}>
                  <FolderKanban size={14} className={`${isActive ? 'text-indigo-500' : 'text-slate-300'} shrink-0`} />
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* ระบบ */}
          <div className="border-t border-slate-100 p-2 space-y-0.5 shrink-0">
            <p className="px-3 pt-2 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">ระบบ</p>
            <button
              onClick={() => setActiveView('access')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left
                ${activeView === 'access' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}>
              <Lock size={14} className={activeView === 'access' ? 'text-rose-500' : 'text-slate-300'} />
              <span>สิทธิ์การเข้าถึง</span>
              <span className={`ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-md ${activeView === 'access' ? 'bg-rose-100 text-rose-500' : 'bg-slate-100 text-slate-400'}`}>
                {usersList.length} users
              </span>
            </button>
            <button
              onClick={() => setActiveView('firebase')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left
                ${activeView === 'firebase' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}>
              <Flame size={14} className={activeView === 'firebase' ? 'text-orange-500' : 'text-slate-300'} />
              <span>Firebase Config</span>
            </button>
          </div>

          {/* Status */}
          <div className="p-3 m-3 mt-2 bg-slate-50 border border-slate-100 rounded-2xl shrink-0">
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              <Activity size={12} className="text-emerald-500"/>
              <span className="text-[9px] font-black uppercase tracking-wider">System Status</span>
            </div>
            <p className="text-[9px] text-slate-400 font-semibold leading-snug">ระบบทำงานปกติ เชื่อมต่อ Firebase แล้ว</p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* ── VIEW: Firebase Config ── */}
            {activeView === 'firebase' && (
              <>
                <div className="pb-2">
                  <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <Flame size={22} className="text-orange-500"/> Firebase Config
                  </h1>
                  <p className="text-xs font-semibold text-slate-400 mt-1.5">แก้ไข Firebase project ที่ใช้งาน — บันทึกแล้วระบบจะ reload อัตโนมัติ</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {FIREBASE_CONFIG_KEYS.map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</label>
                        <input
                          type="text"
                          value={localFirebaseConfig[key] || ''}
                          onChange={e => setLocalFirebaseConfig(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-orange-400 transition-all"
                        />
                      </div>
                    ))}
                  </div>

                  {/* สถานะ */}
                  {configSaveStatus && (
                    <div className={`p-3 rounded-xl text-sm font-bold flex items-center gap-2
                      ${configSaveStatus === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                      {configSaveStatus === 'error' ? <AlertOctagon size={15}/> : <CheckCircle size={15}/>}
                      {configSaveStatus === 'error' ? 'Config ไม่ถูกต้อง' : 'บันทึกแล้ว กำลัง reload...'}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={handleResetFirebaseConfig}
                      className="flex items-center gap-2 px-4 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-black transition">
                      <RotateCcw size={13}/> รีเซ็ตเป็นค่า .env
                    </button>
                    <button
                      onClick={handleSaveFirebaseConfig}
                      disabled={configSaveStatus === 'success'}
                      className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl font-black text-sm transition shadow-lg shadow-orange-200">
                      {configSaveStatus === 'success' ? <Loader2 size={15} className="animate-spin"/> : <Flame size={15}/>}
                      บันทึกและ Reload
                    </button>
                  </div>
                </div>

                {/* Current active config */}
                <div className="bg-slate-800 rounded-2xl p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Config ที่กำลังใช้งาน (localStorage)</p>
                  <pre className="text-[11px] text-emerald-400 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                    {firebaseConfigStr}
                  </pre>
                </div>
              </>
            )}

            {/* ── VIEW: สิทธิ์การเข้าถึง ── */}
            {activeView === 'access' && (
              <>
                <div className="pb-2">
                  <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <Lock size={22} className="text-rose-500"/> สิทธิ์การเข้าถึงโปรเจกต์
                  </h1>
                  <p className="text-xs font-semibold text-slate-400 mt-1.5">กำหนดว่า User แต่ละคนสามารถเห็นโปรเจกต์ไหนได้บ้าง — Admin เห็นทุกโปรเจกต์เสมอ</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  {usersList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <Users size={40} className="mb-3 text-slate-200" />
                      <p className="font-black text-slate-500">ยังไม่พบ User ใน Firestore</p>
                      <p className="text-xs font-semibold mt-1">ตรวจสอบ collection: user_roles</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-5 py-3.5 font-black text-slate-500 uppercase tracking-wider">User</th>
                            <th className="text-left px-4 py-3.5 font-black text-slate-500 uppercase tracking-wider w-20">Role</th>
                            {projects.map(p => (
                              <th key={p.id} className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-wider text-center">
                                <span className="block max-w-[110px] truncate mx-auto" title={p.name}>{p.name}</span>
                              </th>
                            ))}
                            <th className="px-4 py-3.5 font-black text-slate-500 uppercase tracking-wider text-center w-28">ทั้งหมด</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {usersList.map((user) => {
                            const isAdmin = String(user.role || '').toLowerCase() === 'admin';
                            const hasFullAccess = !userProjectAccess[user.email] || userProjectAccess[user.email]?.length === 0;
                            return (
                              <tr key={user.email} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-5 py-3.5">
                                  <p className="font-bold text-slate-700 truncate max-w-[200px]" title={user.email}>{user.email}</p>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide
                                    ${isAdmin ? 'bg-rose-100 text-rose-600' :
                                      user.role === 'QC' ? 'bg-indigo-100 text-indigo-600' :
                                      user.role === 'Gallup' || user.role === 'Gullup' ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-500'}`}>
                                    {user.role}
                                  </span>
                                </td>
                                {projects.map(p => {
                                  const allowed = isAdmin || isProjectAllowed(user.email, p.id);
                                  const savingKey = `${user.email}_${p.id}`;
                                  return (
                                    <td key={p.id} className="px-4 py-3.5 text-center">
                                      {isAdmin ? (
                                        <span className="text-slate-200 font-bold">—</span>
                                      ) : accessSaving[savingKey] ? (
                                        <Loader2 size={14} className="animate-spin text-indigo-400 mx-auto" />
                                      ) : (
                                        <button
                                          onClick={() => handleToggleProjectAccess(user.email, p.id, allowed)}
                                          className={`w-5 h-5 rounded-md border-2 mx-auto flex items-center justify-center transition-all
                                            ${allowed
                                              ? 'bg-indigo-500 border-indigo-500 hover:bg-indigo-600 hover:border-indigo-600'
                                              : 'bg-white border-slate-200 hover:border-indigo-300'}`}
                                        >
                                          {allowed && <CheckCircle size={11} className="text-white" />}
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3.5 text-center">
                                  {isAdmin ? (
                                    <span className="text-[10px] font-black text-rose-400 uppercase">Admin</span>
                                  ) : accessSaving[`${user.email}_all`] ? (
                                    <Loader2 size={14} className="animate-spin text-emerald-400 mx-auto" />
                                  ) : (
                                    <button
                                      onClick={() => handleGrantAllProjects(user.email)}
                                      disabled={hasFullAccess}
                                      title="ให้สิทธิ์เข้าถึงทุกโปรเจกต์ (รวมโปรเจกต์ในอนาคต)"
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition
                                        ${hasFullAccess
                                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                                          : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 border border-transparent hover:border-emerald-200'}`}
                                    >
                                      {hasFullAccess ? 'ทั้งหมด ✓' : 'ให้ทั้งหมด'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 font-semibold px-1">
                  "ทั้งหมด ✓" = User เห็นทุกโปรเจกต์รวมถึงโปรเจกต์ที่สร้างในอนาคต — untick เพื่อจำกัดสิทธิ์แต่ละโปรเจกต์
                </p>
              </>
            )}

            {/* ── VIEW: ตั้งค่าโปรเจกต์ ── */}
            {activeView === 'project' && (
              <>
                <div className="flex items-start justify-between pb-2">
                  <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                      {projectName || 'ไม่มีโปรเจกต์'}
                      {activeProjectId && (
                        <span className="px-2 py-1 bg-white text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-slate-200 shadow-sm">
                          {activeProjectId.slice(0, 8)}…
                        </span>
                      )}
                    </h1>
                    <p className="text-xs font-semibold text-slate-400 mt-1.5">ตั้งค่าระบบ ผู้ใช้งาน และฐานข้อมูลสำหรับโปรเจกต์นี้</p>
                  </div>
                </div>

                {/* สถานะ Save/Import */}
                {importStatus && (
                  <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm
                    ${importStatus.type==='error' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                      importStatus.type==='success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                      'bg-indigo-50 text-indigo-600 border border-indigo-200'}`}>
                    {importStatus.type==='loading' ? <Loader2 className="animate-spin shrink-0" size={16}/> :
                     importStatus.type==='error' ? <AlertOctagon size={16}/> : <CheckCircle size={16}/>}
                    {importStatus.msg}
                  </div>
                )}

                {activeProjectId ? (
                  <>
                    {/* General Settings */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
                      <h2 className="font-black text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Settings size={16} className="text-indigo-500"/> ข้อมูลทั่วไป & เชื่อมต่อระบบ
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ชื่อโปรเจกต์</label>
                          <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Apps Script Web App URL</label>
                          <input type="text" value={appsScriptUrl} onChange={e => setAppsScriptUrl(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="https://script.google.com/macros/s/..." />
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button onClick={handleSaveSettings} disabled={isSaving} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm transition shadow-lg flex items-center gap-2">
                          {isSaving ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle size={16}/>} บันทึกการตั้งค่า
                        </button>
                      </div>
                    </div>

                    {/* Supervisors */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
                      <h2 className="font-black text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Users size={16} className="text-purple-500"/> จัดการรายชื่อ Supervisor (ทีมตรวจ)
                      </h2>
                      <div className="flex gap-3">
                        <input type="text" value={newSupervisor} onChange={e=>setNewSupervisor(e.target.value)} placeholder="พิมพ์ชื่อ Supervisor ใหม่..." className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-500" />
                        <button onClick={handleAddSupervisor} disabled={!newSupervisor.trim()} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-black transition shadow-lg">เพิ่มรายชื่อ</button>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รายชื่อปัจจุบัน</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {activeSupervisorsList.map(sup => {
                            const isDefault = DEFAULT_SUPERVISORS.includes(sup);
                            return (
                              <div key={sup} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                <span className="text-sm font-bold text-slate-700 truncate">{sup}</span>
                                {!isDefault && (supervisorsData || []).includes(sup) && (
                                  <button onClick={() => handleDeleteSupervisor(sup)} className="p-2 hover:bg-rose-100 text-rose-500 rounded-lg transition shrink-0" title="ลบ"><Trash2 size={13}/></button>
                                )}
                                {isDefault && <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-200 px-2 py-1 rounded-md shrink-0">Default</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Database Management */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
                      <h2 className="font-black text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Database size={16} className="text-emerald-500"/> จัดการฐานข้อมูล
                      </h2>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col">
                          <h3 className="font-black text-emerald-800 flex items-center gap-2 mb-2"><RefreshCw size={15} className="text-emerald-500"/> ดึงข้อมูลจาก Google Sheets</h3>
                          <p className="text-[11px] text-emerald-600 font-semibold leading-relaxed mb-4 flex-1">ดึงข้อมูลอัตโนมัติผ่าน Apps Script URL หากไม่เคยตั้งค่า ให้ไปตั้งที่ส่วน <b>ข้อมูลทั่วไป</b> ด้านบนก่อน</p>
                          <div className="flex flex-col gap-2 shrink-0">
                            <button onClick={() => handleSyncFromSheet(false)} disabled={importStatus?.type==='loading'} className="w-full py-2.5 bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-xl font-black text-xs transition shadow-sm">ดึงข้อมูล 500 แถวล่าสุด</button>
                            <button onClick={() => handleSyncFromSheet(true)} disabled={importStatus?.type==='loading'} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition shadow-md">ดึงข้อมูลทั้งหมด (Full Sync)</button>
                          </div>
                        </div>
                        <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col">
                          <h3 className="font-black text-indigo-800 flex items-center gap-2 mb-2"><Upload size={15} className="text-indigo-500"/> อัปโหลดข้อมูล Manual (JSON)</h3>
                          <textarea className="w-full h-20 mb-3 p-3 bg-white border border-indigo-200 text-slate-700 font-mono text-[10px] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none flex-1" placeholder='[{"month":"JAN", "agent": "001 : ชื่อ", "result": "ดีเยี่ยม..."}]' value={importJson} onChange={e=>setImportJson(e.target.value)} />
                          <button onClick={handleBulkImport} disabled={importStatus?.type==='loading'} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition shadow-md shrink-0"><FileJson size={13} className="inline mr-1"/> นำเข้าข้อมูล JSON</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col">
                          <h3 className="font-black text-amber-800 flex items-center gap-2 text-sm mb-2"><Database size={15} className="text-amber-500"/> ดึงข้อมูลเก่ากลับมา</h3>
                          <p className="text-[11px] text-amber-700 font-semibold leading-relaxed mb-4 flex-1">ใช้สำหรับดึงข้อมูลการตรวจแบบเก่า (ที่ไม่มี Project ID) เข้ามายังโปรเจกต์นี้</p>
                          <button onClick={handleMigrateOldData} disabled={importStatus?.type==='loading'} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs transition shadow-md flex items-center justify-center gap-2 shrink-0"><RefreshCw size={13} className={importStatus?.type==='loading'?'animate-spin':''}/> ย้ายข้อมูลเข้าโปรเจกต์นี้</button>
                        </div>
                        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col">
                          <h3 className="font-black text-rose-800 flex items-center gap-2 text-sm mb-2"><AlertOctagon size={15} className="text-rose-500"/> พื้นที่อันตราย</h3>
                          <p className="text-[11px] text-rose-700 font-semibold leading-relaxed mb-4 flex-1">การล้างข้อมูลจะลบเอกสารทั้งหมดใน Collection "audit_cases" ของโปรเจกต์นี้อย่างถาวร</p>
                          <button onClick={() => setShowClearConfirm(true)} className="w-full py-2.5 bg-white border border-rose-300 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl font-black text-xs transition flex items-center justify-center gap-2 shrink-0"><Trash2 size={13}/> Clear All Database</button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-400">
                    <FolderKanban size={44} className="mb-4 text-slate-200" />
                    <p className="text-lg font-black text-slate-500">ยังไม่ได้เลือกโปรเจกต์</p>
                    <p className="text-sm font-semibold mt-1 text-slate-400">กรุณาเลือกหรือสร้างโปรเจกต์ใหม่จากเมนูด้านซ้าย</p>
                  </div>
                )}
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};
export default AdminSettings;