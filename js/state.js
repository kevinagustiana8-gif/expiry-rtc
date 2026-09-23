// ============================================================
// state.js — State global & session
// ============================================================

// State global
window.state = {
  products: [],
  settings: { notif: true },
  divisions: [],
  divisionFilter: 'all',
  masterDivisionFilter: 'all',
  currentUser: null,      // { username, nama, role, sessionId }
  byBc: {},               // index master by barcode
  byName: {},             // index master by nama
  masterCache: [],        // cache master untuk halaman Master
  masterLoaded: false,
  logCache: [],           // cache log login
  curFilter: 'all',       // filter dashboard
  curPage: 'scan',
  // Session management
  sessionId: null,        // ID session unik untuk single-session
  lastActivity: Date.now(),
  // Sync (untuk PWA nanti)
  isOnline: navigator.onLine,
  syncQueue: []
};

// Session storage (untuk persist antar refresh)
const SESSION_KEY = 'expiry-rtc-session';
const SESSION_ID_KEY = 'expiry-rtc-session-id';

function loadSession(){
  try{
    const s = localStorage.getItem(SESSION_KEY);
    if(s) window.state.currentUser = JSON.parse(s);
    const sid = localStorage.getItem(SESSION_ID_KEY);
    if(sid) window.state.sessionId = sid;
  }catch(e){}
}

function saveSession(){
  try{
    if(window.state.currentUser){
      localStorage.setItem(SESSION_KEY, JSON.stringify(window.state.currentUser));
    }
    if(window.state.sessionId){
      localStorage.setItem(SESSION_ID_KEY, window.state.sessionId);
    }
  }catch(e){}
}

function clearSession(){
  try{
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
  }catch(e){}
  window.state.currentUser = null;
  window.state.sessionId = null;
}

// Local storage produk (fallback)
const LS_PRODUCTS = 'expiry-rtc-products-v4';

function loadProductsLocal(){
  try{
    const raw = localStorage.getItem(LS_PRODUCTS);
    if(raw) window.state.products = JSON.parse(raw) || [];
  }catch(e){}
}

function saveProductsLocal(){
  try{
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(window.state.products));
  }catch(e){}
}

// Role checks
function isOwner(){
  return window.state.currentUser && window.state.currentUser.role === 'owner';
}

function isManager(){
  return window.state.currentUser && window.state.currentUser.role === 'manager';
}

function isAdmin(){
  const r = window.state.currentUser && window.state.currentUser.role;
  return r === 'admin' || r === 'manager' || r === 'owner';
}

function isStaff(){
  return window.state.currentUser && window.state.currentUser.role === 'staff';
}

function isLoggedIn(){
  return !!window.state.currentUser;
}

// Izin kelola user berdasarkan role dan target
function canManageRole(targetRole){
  const me = window.state.currentUser;
  if(!me) return false;
  const myRole = me.role;
  // Owner bisa kelola semua kecuali owner lain (untuk cegah konflik)
  if(myRole === 'owner') return targetRole !== 'owner';
  // Manager bisa kelola admin & staff
  if(myRole === 'manager') return targetRole === 'admin' || targetRole === 'staff';
  // Admin bisa kelola staff
  if(myRole === 'admin') return targetRole === 'staff';
  return false;
}

// Bisa lihat log siapa
function canSeeLog(logEntry){
  const me = window.state.currentUser;
  if(!me) return false;
  if(me.role === 'owner') return true;
  if(me.role === 'manager'){
    // Manager hanya bisa lihat log admin & staff (bukan owner, bukan dirinya sendiri)
    return logEntry.role === 'admin' || logEntry.role === 'staff';
  }
  if(me.role === 'admin'){
    // Admin bisa lihat log staff saja
    return logEntry.role === 'staff';
  }
  return false;
}

// Expose
window.loadSession = loadSession;
window.saveSession = saveSession;
window.clearSession = clearSession;
window.loadProductsLocal = loadProductsLocal;
window.saveProductsLocal = saveProductsLocal;
window.isOwner = isOwner;
window.isManager = isManager;
window.isAdmin = isAdmin;
window.isStaff = isStaff;
window.isLoggedIn = isLoggedIn;
window.canManageRole = canManageRole;
window.canSeeLog = canSeeLog;

console.log('✅ state.js loaded');
