// ============================================================
// state.js — State global, session, akses divisi
// ============================================================

window.state = {
  products: [],
  settings: { notif: true },
  divisions: [],
  divisionFilter: 'all',
  masterDivisionFilter: 'all',
  currentUser: null,
  activeDivision: null,
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
  syncQueue: [],
  uploadSessions: [],
  uploadDetailId: null,
  uploadDetailProducts: [],
  uploadSelected: new Set(),
  masterLogCache: [],
  loadedDivisions: {}
};

const SESSION_KEY    = 'expiry-rtc-session';
const SESSION_ID_KEY = 'expiry-rtc-session-id';
const CURPAGE_KEY    = 'expiry-rtc-curpage';
const ACTIVE_DIV_KEY = 'expiry-rtc-active-div';

function loadSession(){
  try{
    const navEntry = performance.getEntriesByType('navigation')[0];
    const navType = navEntry ? navEntry.type : 'navigate';
    if(navType === 'navigate'){
      const existing = sessionStorage.getItem(SESSION_KEY);
      if(existing){
        console.log('⚠️ Tab dipulihkan — sesi dihapus');
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
  loadActiveDivision();
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
  window.state.activeDivision = null;
}

function saveCurPage(){
  try{ sessionStorage.setItem(CURPAGE_KEY, window.state.curPage || 'scan'); }catch(e){}
}
function loadCurPage(){
  try{
    const p = sessionStorage.getItem(CURPAGE_KEY);
    if(p) window.state.curPage = p;
  }catch(e){}
}

function saveDivFilter(){
  try{ localStorage.setItem('expiry-rtc-divfilter', window.state.divisionFilter || 'all'); }catch(e){}
}
function loadDivFilter(){
  try{
    const d = localStorage.getItem('expiry-rtc-divfilter');
    if(d) window.state.divisionFilter = d;
  }catch(e){}
}

function saveActiveDivision(){
  try{
    if(window.state.activeDivision) localStorage.setItem(ACTIVE_DIV_KEY, window.state.activeDivision);
  }catch(e){}
}
function loadActiveDivision(){
  try{
    const d = localStorage.getItem(ACTIVE_DIV_KEY);
    if(d) window.state.activeDivision = d;
  }catch(e){}
}

const LS_PRODUCTS = 'expiry-rtc-products-v4';
function loadProductsLocal(){
  try{
    const raw = localStorage.getItem(LS_PRODUCTS);
    if(raw) window.state.products = JSON.parse(raw) || [];
  }catch(e){}
}
function saveProductsLocal(){
  try{ localStorage.setItem(LS_PRODUCTS, JSON.stringify(window.state.products)); }catch(e){}
}

function isOwner(){ return window.state.currentUser?.role === 'owner'; }
function isManager(){ return window.state.currentUser?.role === 'manager'; }
function isAdmin(){
  const r = window.state.currentUser?.role;
  return r === 'admin' || r === 'manager' || r === 'owner';
}
function isStaff(){ return window.state.currentUser?.role === 'staff'; }
function isLoggedIn(){ return !!window.state.currentUser; }

function canSwitchDivision(){
  const u = window.state.currentUser;
  if(!u) return false;
  return u.role === 'manager' || u.role === 'owner';
}

function getMyDivision(){
  const u = window.state.currentUser;
  if(!u) return null;
  if(canSwitchDivision()){
    if(window.state.activeDivision) return window.state.activeDivision;
    return u.role === 'owner' ? 'all' : (u.division || 'grocery');
  }
  return u.division || 'grocery';
}

function getAccessibleProducts(){
  const all = window.state.products || [];
  const u = window.state.currentUser;
  if(!u) return [];
  if(canSwitchDivision()){
    const active = window.state.activeDivision || 'all';
    if(active === 'all') return all;
    return all.filter(p => migrateDivision(p.division || detectDivision(p.nm)) === active);
  }
  const div = u.division || 'grocery';
  return all.filter(p => migrateDivision(p.division || detectDivision(p.nm)) === div);
}

function canAccessDivision(divId){
  const u = window.state.currentUser;
  if(!u) return false;
  if(canSwitchDivision()) return true;
  return (u.division || 'grocery') === divId;
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
  if(me.role === 'manager' || me.role === 'admin') return targetRole !== 'owner';
  return false;
}

window.loadSession = loadSession;
window.saveSession = saveSession;
window.clearSession = clearSession;
window.saveCurPage = saveCurPage;
window.loadCurPage = loadCurPage;
window.saveDivFilter = saveDivFilter;
window.loadDivFilter = loadDivFilter;
window.saveActiveDivision = saveActiveDivision;
window.loadActiveDivision = loadActiveDivision;
window.loadProductsLocal = loadProductsLocal;
window.saveProductsLocal = saveProductsLocal;
window.isOwner = isOwner;
window.isManager = isManager;
window.isAdmin = isAdmin;
window.isStaff = isStaff;
window.isLoggedIn = isLoggedIn;
window.canSwitchDivision = canSwitchDivision;
window.getMyDivision = getMyDivision;
window.getAccessibleProducts = getAccessibleProducts;
window.canAccessDivision = canAccessDivision;
window.canManageRole = canManageRole;
window.canSeeLog = canSeeLog;

console.log('✅ state.js loaded');
