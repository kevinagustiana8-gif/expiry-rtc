// ============================================================
// config.js — Firebase setup (Firestore + Auth)
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc, onSnapshot,
  getDocs, collection, writeBatch, addDoc, query, where, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail, updatePassword
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyC3GsCoVSiTKmTzPcSR8oIXe3fV58AhVX0",
  authDomain: "expiry-rtc.firebaseapp.com",
  projectId: "expiry-rtc",
  storageBucket: "expiry-rtc.firebasestorage.app",
  messagingSenderId: "1035122670429",
  appId: "1:1035122670429:web:5ebe2ae53bd04c0dc006b4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.fb = {
  db, auth,
  doc, setDoc, getDoc, deleteDoc, onSnapshot,
  getDocs, collection, writeBatch, addDoc,
  query, where, orderBy, limit, serverTimestamp,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail, updatePassword
};

window.fbReady = true;

window.waitForFB = function(maxMs = 10000){
  return new Promise((resolve, reject) => {
    if(window.fbReady){ resolve(window.fb); return; }
    const start = Date.now();
    const check = setInterval(() => {
      if(window.fbReady){ clearInterval(check); resolve(window.fb); }
      else if(Date.now() - start > maxMs){ clearInterval(check); reject(new Error('Firebase timeout')); }
    }, 100);
  });
};

console.log('✅ Firebase siap (Firestore + Auth)');
