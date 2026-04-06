import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { getMonthWeight } from './utils';

export const useDataFetch = (db, selectedMonths, debouncedSearchTerm) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [allAvailableMonths, setAllAvailableMonths] = useState([]);
  const [supervisorsData, setSupervisorsData] = useState([]);
  const [dbSearchResults, setDbSearchResults] = useState(null);
  const [isSearchingDB, setIsSearchingDB] = useState(false);

  // ── Search Database Directly ──
  useEffect(() => {
    if (!db || !debouncedSearchTerm.trim()) {
      setDbSearchResults(null);
      return;
    }
    setIsSearchingDB(true);
    const term = debouncedSearchTerm.trim();
    
    const fetchSearch = async () => {
      try {
        const resultsMap = new Map();
        const docIdSearch = term.replace(/\//g,'_');
        const docRef = doc(db, "audit_cases", docIdSearch);
        const qNoQuery = query(collection(db, "audit_cases"), where("questionnaireNo", ">=", term), where("questionnaireNo", "<=", term + '\uf8ff'), limit(30));
        const agentQuery = query(collection(db, "audit_cases"), where("agent", ">=", term), where("agent", "<=", term + '\uf8ff'), limit(30));
        const nameQuery = query(collection(db, "audit_cases"), where("rawName", ">=", term), where("rawName", "<=", term + '\uf8ff'), limit(30));

        const [docSnap, snap1, snap2, snap3] = await Promise.all([
          getDoc(docRef), getDocs(qNoQuery), getDocs(agentQuery), getDocs(nameQuery)
        ]);

        if (docSnap.exists()) resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        snap1.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() }));
        snap2.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() }));
        snap3.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() }));
        
        setDbSearchResults(Array.from(resultsMap.values()));
      } catch (err) { console.error("Search error:", err); }
      setIsSearchingDB(false);
    };
    fetchSearch();
  }, [db, debouncedSearchTerm]);

  // ── Real-time listener for audit_cases ──
  useEffect(() => {
    if (!db) return;
    if (selectedMonths.length === 0) { setData([]); setLoading(false); return; }
    setLoading(true);
    
    let q = selectedMonths.length <= 30 
      ? query(collection(db, "audit_cases"), where("month", "in", selectedMonths), orderBy("date", "desc"))
      : query(collection(db, "audit_cases"), orderBy("date", "desc"), limit(2000));

    const unsub = onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setFetchError(prev => prev && prev.includes('Index Required') ? null : prev);
    }, err => {
      if (err.code === 'permission-denied') setFetchError("⚠️ Permission Denied! กรุณาไปที่ Firebase Console > Firestore > Rules แล้วเปลี่ยนเป็น 'allow read, write: if true;'");
      else if (err.code === 'failed-precondition' && err.message.includes('index')) setFetchError(`⚠️ Index Required! การกรองข้อมูลแบบนี้ต้องการการตั้งค่า Index ในฐานข้อมูลก่อน กรุณาส่งลิงก์นี้ให้ผู้พัฒนาเพื่อสร้าง Index ที่จำเป็น:\n\n${err.message.substring(err.message.indexOf('https://'))}`);
      else setFetchError("Connection Error: " + err.message);
      setLoading(false);
    });
    return () => unsub();
  }, [db, selectedMonths]);

  // ── Listener for all available months ──
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "metadata", "months"), (docSnap) => {
      if (docSnap.exists() && Array.isArray(docSnap.data().all)) {
        const sortedMonths = [...docSnap.data().all].sort((a, b) => getMonthWeight(a) - getMonthWeight(b));
        setAllAvailableMonths(sortedMonths);
      }
    });
    return () => unsub();
  }, [db]);

  // ── Real-time listener for supervisors ──
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "supervisors"), snap => setSupervisorsData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [db]);

  return {
    data, setData, loading, fetchError, setFetchError, allAvailableMonths, supervisorsData, dbSearchResults, setDbSearchResults, isSearchingDB
  };
};