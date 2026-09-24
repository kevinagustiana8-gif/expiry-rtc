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
  currentUser: null,
  byBc: {},
  byName: {},
  masterCache: [],
  masterLoaded: false,
  logCache: [],
  curFilter: 'all',
  curPage: 'scan',
  sessionId: null,
  lastActivity: Date.now(),
  isOnline: navigator.onLine,
  syncQueue: []
};

// Session storage (per-tab)
const SESSION_KEY    = 'expiry-rtc-session';
const SESSION_ID_KEY = 'expiry-rtc-session-id';
const CURPAGE_KEY    = 'expiry-rtc-curpage';
const DIVFILTER_KEY  = 'expiry-rtc-divfilter';

function loadSession(){
  // ⭐ Deteksi tab yang dipulihkan browser (Ctrl+Shift+T)
  try{
    const navEntry = performance.getEntriesByType('navigation')[0];
    const navType = navEntry ? navEntry.type : 'navigate';

    // 'navigate' = buka tab baru ATAU reopen tab → kalau ada sessionStorage, itu dipulihkan
    // 'reload' = refresh biasa → session tetap
    // 'back_forward' = tombol back/forward → session tetap
    if(navType === 'navigate'){
      const existing = sessionStorage.getItem(SESSION_KEY);
      if(existing){
        console.log('⚠️ Tab dipulihkan browser — sesi dihapus otomatis');
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_ID_KEY);
      }
    }
  }catch(e){}

  try{
    const s = sessionStorage.getItem(SESSION_KEY);
    if(s) window.state.currentUser = JSON.parse(s);
    const sid = sessionStorage.getItem(SESSION_ID_KEY);
    if(sid) window.state.sessionId = sid;
  }catch(e){}
  loadCurPage();
  loadDivFilter();
}

function saveSession(){
  try{
    if(window.state.currentUser){
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(window.state.currentUser));
    }
    if(window.state.sessionId){
      sessionStorage.setItem(SESSION_ID_KEY, window.state.sessionId);
    }
  }catch(e){}
}

function clearSession(){
  try{
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
  }catch(e){}
  window.state.currentUser = null;
  window.state.sessionId = null;
}

// Halaman terakhir (per-tab)
function saveCurPage(){
  try{ sessionStorage.setItem(CURPAGE_KEY, window.state.curPage || 'scan'); }catch(e){}
}
function loadCurPage(){
  try{
    const p = sessionStorage.getItem(CURPAGE_KEY);
    if(p) window.state.curPage = p;
  }catch(e){}
}

// Filter divisi (per-device, persist)
function saveDivFilter(){
  try{ localStorage.setItem(DIVFILTER_KEY, window.state.divisionFilter || 'all'); }catch(e){}
}
function loadDivFilter(){
  try{
    const d = localStorage.getItem(DIVFILTER_KEY);
    if(d) window.state.divisionFilter = d;
  }catch(e){}
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

function canManageRole(targetRole){
  const me = window.state.currentUser;
  if(!me) return false;
  const myRole = me.role;
  if(myRole === 'owner') return targetRole !== 'owner';
  if(myRole === 'manager') return targetRole === 'staff' || targetRole === 'manager';
  if(myRole === 'admin') return targetRole === 'staff';
  return false;
}

function canSeeLog(logEntry){
  const me = window.state.currentUser;
  if(!me) return false;
  const targetRole = logEntry.role || 'staff';
  if(me.role === 'owner') return true;
  if(me.role === 'manager' || me.role === 'admin'){
    return targetRole !== 'owner';
  }
  return false;
}

// Expose
window.loadSession = loadSession;
window.saveSession = saveSession;
window.clearSession = clearSession;
window.saveCurPage = saveCurPage;
window.loadCurPage = loadCurPage;
window.saveDivFilter = saveDivFilter;
window.loadDivFilter = loadDivFilter;
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
