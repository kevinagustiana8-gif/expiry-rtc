// ============================================================
// auth.js — Login, single session, auto-logout
// ============================================================

// ============ KONSTANTA ============
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit
const IDLE_CHECK_INTERVAL_MS = 30 * 1000; // cek tiap 30 detik
const SESSION_LISTENER_KEY = 'expiry-session-listener';

let idleTimer = null;
let sessionListenerUnsub = null;
let lastActivity = Date.now();

// ============ SEED ADMIN AWAL ============
async function ensureAdminExists(){
  if(!window.fbReady) return;
  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'users')
    );
    if(snap.size === 0){
      await window.fb.setDoc(
        window.fb.doc(window.fb.db, 'users', 'admin'),
        {
          username: 'admin',
          password: 'admin2025',
          nama: 'Administrator',
          role: 'owner',
          createdAt: new Date().toISOString()
        }
      );
      console.log('🔧 Admin default dibuat: admin / admin2025');
    }
  }catch(e){
    console.error('Seed error:', e);
  }
}

// ============ GENERATE SESSION ID ============
function generateSessionId(){
  return 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 12);
}

// ============ LOGIN ============
async function tryLogin(username, password){
  if(!window.fbReady) return { error: 'Firebase belum siap. Tunggu sebentar.' };

  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'users')
    );

    let found = null;
    snap.forEach(d => {
      if(d.id === username) found = { id: d.id, ...d.data() };
    });

    if(!found) return { error: 'Username tidak ditemukan.' };
    if(found.password !== password) return { error: 'Password salah.' };

    // === SINGLE SESSION CHECK ===
    const existingSession = found.sessionId;
    const existingDevice = found.deviceId;
    const myDevice = getDeviceId();

    // Kalau user sudah login di device LAIN → tolak
    if(existingSession && existingDevice && existingDevice !== myDevice){
      const lastSeen = found.sessionUpdatedAt || found.lastSeen;
      const when = lastSeen ? relativeTime(lastSeen) : 'sebelumnya';
      return {
        error: `⚠️ Akun ini sedang login di perangkat lain (aktif ${when}).\n\nLogout dari perangkat itu dulu, atau tunggu 10 menit tanpa aktivitas.`
      };
    }

    // Buat sessionId baru
    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    // Set currentUser
    window.state.currentUser = {
      username: found.username || found.id || username,
      nama: found.nama || found.username || found.id || '-',
      role: found.role || 'staff',
      sessionId
    };
    window.state.sessionId = sessionId;
    saveSession();

    // Update Firestore dengan session info
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'users', username),
      {
        sessionId,
        deviceId: myDevice,
        sessionUpdatedAt: now,
        lastLogin: now,
        lastSeen: now
      },
      { merge: true }
    );

    // Catat ke login_log
    try{
      const logRef = window.fb.doc(window.fb.collection(window.fb.db, 'login_log'));
      await window.fb.setDoc(logRef, {
        username: window.state.currentUser.username,
        nama: window.state.currentUser.nama,
        role: window.state.currentUser.role,
        timestamp: now,
        ua: (navigator.userAgent || '').substring(0, 180),
        deviceId: myDevice
      });
    }catch(e){ console.warn('Login log error:', e); }

    // Mulai listener session + idle timer
    startSessionListener();
    startIdleTimer();

    return { ok: true };
  }catch(e){
    console.error(e);
    return { error: 'Gagal login: ' + e.message };
  }
}

// ============ LOGOUT ============
async function logout(force){
  if(!force){
    if(!confirm('Keluar dari aplikasi?')) return;
  }

  stopIdleTimer();
  stopSessionListener();

  const uname = window.state.currentUser ? (window.state.currentUser.username || window.state.currentUser.id) : null;

  // Bersihkan sessionId di Firestore
  if(uname && window.fbReady){
    try{
      await window.fb.setDoc(
        window.fb.doc(window.fb.db, 'users', uname),
        {
          sessionId: '',
          sessionUpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }catch(e){}
  }

  clearSession();
  location.reload();
}

// ============ SESSION LISTENER (SINGLE SESSION) ============
function startSessionListener(){
  stopSessionListener();

  const uname = window.state.currentUser ? (window.state.currentUser.username || window.state.currentUser.id) : null;
  if(!uname) return;

  try{
    sessionListenerUnsub = window.fb.onSnapshot(
      window.fb.doc(window.fb.db, 'users', uname),
      (docSnap) => {
        if(!docSnap.exists()) return;
        const data = docSnap.data();

        // Kalau sessionId di server beda dengan local → berarti login di device lain
        if(data.sessionId && data.sessionId !== window.state.sessionId){
          stopIdleTimer();
          stopSessionListener();
          alert('⚠️ Sesi Anda berakhir.\n\nAkun ini login di perangkat lain. Silakan login ulang.');
          clearSession();
          location.reload();
        }
      },
      (err) => console.warn('Session listener error:', err)
    );
  }catch(e){
    console.warn('Session listener setup error:', e);
  }
}

function stopSessionListener(){
  if(sessionListenerUnsub){
    try{ sessionListenerUnsub(); }catch(e){}
    sessionListenerUnsub = null;
  }
}

// ============ UPDATE LAST SEEN (setiap 60 detik) ============
let lastSeenInterval = null;

function startLastSeenUpdate(){
  stopLastSeenUpdate();
  lastSeenInterval = setInterval(async () => {
    const u = window.state.currentUser;
    if(!u || !window.fbReady) return;
    const uname = u.username || u.id;
    if(!uname) return;
    try{
      await window.fb.setDoc(
        window.fb.doc(window.fb.db, 'users', uname),
        { lastSeen: new Date().toISOString() },
        { merge: true }
      );
    }catch(e){}
  }, 60000);
}

function stopLastSeenUpdate(){
  if(lastSeenInterval){
    clearInterval(lastSeenInterval);
    lastSeenInterval = null;
  }
}

// ============ IDLE TIMER (AUTO LOGOUT) ============
function startIdleTimer(){
  stopIdleTimer();
  lastActivity = Date.now();

  const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'focus'];
  const activityHandler = () => {
    lastActivity = Date.now();
  };
  activityEvents.forEach(ev => {
    document.addEventListener(ev, activityHandler, { passive: true });
  });

  window._activityHandler = activityHandler;

  idleTimer = setInterval(() => {
    const idle = Date.now() - lastActivity;
    if(idle >= IDLE_TIMEOUT_MS){
      console.log('⏰ Auto-logout karena idle 10 menit');
      stopIdleTimer();
      stopSessionListener();
      alert('⏰ Anda logout otomatis karena tidak ada aktivitas selama 10 menit.');
      clearSession();
      location.reload();
    }
  }, IDLE_CHECK_INTERVAL_MS);
}

function stopIdleTimer(){
  if(idleTimer){
    clearInterval(idleTimer);
    idleTimer = null;
  }
  if(window._activityHandler){
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'focus'];
    events.forEach(ev => {
      document.removeEventListener(ev, window._activityHandler);
    });
    window._activityHandler = null;
  }
}

// ============ GANTI PASSWORD SENDIRI ============
async function changeOwnPassword(oldPass, newPass){
  if(!window.state.currentUser) return { error: 'Belum login' };
  const uname = window.state.currentUser.username || window.state.currentUser.id;
  if(!uname) return { error: 'Username tidak valid' };
  if(newPass.length < 6) return { error: 'Password baru minimal 6 karakter' };
  if(oldPass === newPass) return { error: 'Password baru sama dengan lama' };

  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'users')
    );
    let me = null;
    snap.forEach(d => { if(d.id === uname) me = d.data(); });
    if(!me) return { error: 'Akun tidak ditemukan' };
    if(me.password !== oldPass) return { error: 'Password lama salah' };

    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'users', uname),
      {
        password: newPass,
        passwordChangedAt: new Date().toISOString()
      },
      { merge: true }
    );
    return { ok: true };
  }catch(e){
    return { error: 'Gagal: ' + e.message };
  }
}

// ============ BUKA/TUTUP MODAL GANTI PASSWORD ============
function openChangePasswordModal(){
  document.getElementById('pw-old').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-new2').value = '';
  document.getElementById('pw-msg').textContent = '';
  document.getElementById('pw-modal').classList.remove('hide');
  setTimeout(() => document.getElementById('pw-old').focus(), 100);
}

function closeChangePasswordModal(){
  document.getElementById('pw-modal').classList.add('hide');
}

async function submitChangePassword(){
  const oldP = document.getElementById('pw-old').value;
  const newP = document.getElementById('pw-new').value;
  const newP2 = document.getElementById('pw-new2').value;
  const msg = document.getElementById('pw-msg');

  msg.style.color = 'var(--dg)';

  if(!oldP){ msg.textContent = 'Isi password lama'; return; }
  if(newP !== newP2){ msg.textContent = 'Konfirmasi tidak cocok'; return; }

  const r = await changeOwnPassword(oldP, newP);
  if(r.error){ msg.textContent = r.error; return; }

  msg.style.color = 'var(--ok)';
  msg.textContent = '✅ Password berhasil diganti';
  toast('Password diganti', 'ok');
  setTimeout(closeChangePasswordModal, 1200);
}

// ============ BIND EVENTS ============
function bindAuthEvents(){
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const loginUser = document.getElementById('login-user');
  const loginPass = document.getElementById('login-pass');
  const loginErr = document.getElementById('login-err');

  // Logout di topbar (kalau ada)
  const btnLogout = document.getElementById('btn-logout');
  if(btnLogout) btnLogout.addEventListener('click', () => logout(false));

  // Login form
  if(loginForm){
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = loginUser.value.trim().toLowerCase();
      const p = loginPass.value;

      loginErr.textContent = '';
      loginBtn.disabled = true;
      loginBtn.textContent = 'Memuat...';

      const r = await tryLogin(u, p);

      loginBtn.disabled = false;
      loginBtn.textContent = 'Masuk';

      if(r.error){
        loginErr.textContent = r.error;
        return;
      }

      if(typeof showApp === 'function') showApp();
      await refreshMasterFromFS();
      toast(`Selamat datang, ${window.state.currentUser.nama}!`, 'ok');
      if(typeof goTo === 'function') goTo('scan');
    });
  }

  // Ganti password modal
  const pwClose = document.getElementById('pw-close');
  const pwCancel = document.getElementById('pw-cancel');
  const pwSave = document.getElementById('pw-save');
  const pwModal = document.getElementById('pw-modal');

  if(pwClose) pwClose.addEventListener('click', closeChangePasswordModal);
  if(pwCancel) pwCancel.addEventListener('click', closeChangePasswordModal);
  if(pwSave) pwSave.addEventListener('click', submitChangePassword);
  if(pwModal){
    pwModal.addEventListener('click', (e) => {
      if(e.target === pwModal) closeChangePasswordModal();
    });
  }
}

// Expose
window.tryLogin = tryLogin;
window.logout = logout;
window.ensureAdminExists = ensureAdminExists;
window.startIdleTimer = startIdleTimer;
window.stopIdleTimer = stopIdleTimer;
window.startSessionListener = startSessionListener;
window.stopSessionListener = stopSessionListener;
window.startLastSeenUpdate = startLastSeenUpdate;
window.changeOwnPassword = changeOwnPassword;
window.openChangePasswordModal = openChangePasswordModal;
window.closeChangePasswordModal = closeChangePasswordModal;
window.submitChangePassword = submitChangePassword;
window.bindAuthEvents = bindAuthEvents;

console.log('✅ auth.js loaded');
