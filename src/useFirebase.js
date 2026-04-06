import { useState, useEffect } from 'react';
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { DEFAULT_FIREBASE_CONFIG } from './constants';

export const useFirebase = () => {
  const [db, setDb] = useState(null);
  const [storage, setStorage] = useState(null);
  const [auth, setAuth] = useState(null);
  const [firebaseError, setFirebaseError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  const [firebaseConfigStr, setFirebaseConfigStr] = useState(
    (() => { try { return localStorage.getItem('firebase_config_str') || JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2); } catch(e) { return JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2); } })()
  );

  useEffect(() => {
    if (!firebaseConfigStr) return;
    try {
      const config = JSON.parse(firebaseConfigStr);
      const appName = "QC_DASH_V5";
      const existing = getApps().find(a => a.name === appName);
      const app = existing || initializeApp(config, appName);
      setDb(getFirestore(app));
      setStorage(getStorage(app));
      setAuth(getAuth(app));
      setFirebaseError(null);
    } catch (e) {
      setFirebaseError("Firebase Config ไม่ถูกต้อง: " + e.message);
    }
  }, [firebaseConfigStr]);

  useEffect(() => {
    if (!auth || !db) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const roleDoc = await getDoc(doc(db, "user_roles", user.email));
          if (roleDoc.exists()) setUserRole(roleDoc.data().role);
          else setUserRole(user.email.toLowerCase().includes('admin') ? 'Admin' : (user.email.toLowerCase().includes('qc') ? 'QC' : 'INV'));
          setIsAuthenticated(true);
        } catch (error) { console.error("Auth role error:", error); }
      } else { setIsAuthenticated(false); setUserRole(null); }
    });
    return () => unsubscribe();
  }, [auth, db]);

  return { db, storage, auth, firebaseError, setFirebaseError, isAuthenticated, userRole, firebaseConfigStr, setFirebaseConfigStr };
};