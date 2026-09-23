// ============================================================
// app.js — Router, boot, settings, notifikasi
// File TERAKHIR yang mengikat semua modul
// ============================================================

// ============ ROUTER ============
function goTo(p){
  window.state.curPage = p;

  document.querySelectorAll('.pg').forEach(x => x.classList.add('hide'));
  const el = document.getElementById('pg-' + p);
  if(el) el.classList.remove('hide');

  document.querySelectorAll('.bn button').forEach(b =>
    b.classList.toggle('active', b.dataset.p === p)
  );

  const titles = {
    scan: 'Scan Barcode',
    dash: 'Dasbor',
    set: 'Pengaturan',
    users: 'Pengguna',
    master: 'Master Produk',
    tema: 'Pilih Tema',
    log: 'Log Login'
  };
  const tt = document.getElementById('tt');
  if(tt) tt.textContent = titles[p] || 'Expiry RTC';

  if(p !== 'scan' && typeof stopScan === 'function') stopScan();

  if(p === 'dash' && typeof renderDash === 'function') renderDash();
  if(p === 'set' && typeof renderSet === 'function') renderSet();
  if(p === 'users' && typeof loadUsers === 'function') loadUsers();
  if(p === 'master' && typeof loadMasterPage === 'function') loadMasterPage();
  if(p === 'tema' && typeof renderThemePage === 'function') renderThemePage();
  if(p === 'log' && typeof loadLoginLogs === 'function') loadLoginLogs();

  if(p === 'set'){
    const card = document.getElementById('set-migrate-card');
    const card2 = document.getElementById('set-export-master-card');
    const showCards = window.state.currentUser
      && (window.state.currentUser.role === 'admin'
       || window.state.currentUser.role === 'manager'
       || window.state.currentUser.role === 'owner');
    if(card) card.style.display = showCards ? '' : 'none';
    if(card2) card2.style.display = showCards ? '' : 'none';
  }

  window.scrollTo(0, 0);
}

// ============ SHOW LOGIN ============
function showLogin(){
  const lo = document.getElementById('login-overlay');
  if(lo) lo.classList.remove('hide');

  const lu = document.getElementById('login-user');
  const lp = document.getElementById('login-pass');
  const le = document.getElementById('login-err');
  if(lu) lu.value = '';
  if(lp) lp.value = '';
  if(le) le.textContent = '';

  setTimeout(() => { if(lu) lu.focus(); }, 100);
}

// ============ SHOW APP ============
function showApp(){
  const lo = document.getElementById('login-overlay');
  if(lo) lo.classList.add('hide');

  const admin = isAdmin();
  const owner = isOwner();
  const manager = isManager();

  const nu = document.getElementById('nav-users');
  const nm = document.getElementById('nav-master');
  const nl = document.getElementById('nav-log');

  // Pengguna: admin, manager, owner
  if(nu) nu.classList.toggle('hide', !admin);
  // Master: admin, manager, owner
  if(nm) nm.classList.toggle('hide', !admin);
  // Log: admin, manager, owner (staff tidak)
  if(nl) nl.classList.toggle('hide', !admin);

  // Buka halaman default
  if(window.state.curPage === 'users' && !admin) goTo('scan');
  else if(window.state.curPage === 'master' && !admin) goTo('scan');
  else if(window.state.curPage === 'log' && !admin) goTo('scan');
  else if(window.state.curPage === 'scan') goTo('scan');
  else goTo(window.state.curPage || 'scan');
}

// ============ RENDER SETTINGS ============
function renderSet(){
  const statsEl = document.getElementById('stats');
  if(statsEl){
    statsEl.innerHTML = `Master: <b>${Object.keys(window.state.byBc).length}</b> produk · Produk saya: <b>${window.state.products.length}</b>`;
  }

  const mc = document.getElementById('mcount');
  if(mc) mc.textContent = Object.keys(window.state.byBc).length;

  const u = window.state.currentUser;
  const infoEl = document.getElementById('set-user-info');
  if(infoEl && u){
    infoEl.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
        <div class="usr-avatar">${(u.nama || '?').charAt(0).toUpperCase()}</div>
        <div style="flex:1">
          <div class="usr-name">${esc(u.nama)}</div>
          <div class="usr-meta">
            <span>@${esc(u.username || '-')}</span>
            <span class="role-badge role-${u.role}">${u.role.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <button class="bt bs" id="set-chpw" style="margin-bottom:8px">🔑 Ganti Password</button>
      <button class="bt" style="background:var(--dg);color:#fff" id="set-logout">🚪 Keluar dari Akun</button>
    `;
    setTimeout(() => {
      const b = document.getElementById('set-logout');
      if(b) b.addEventListener('click', () => {
        if(typeof logout === 'function') logout(false);
      });
      const cp = document.getElementById('set-chpw');
      if(cp) cp.addEventListener('click', () => {
        if(typeof openChangePasswordModal === 'function') openChangePasswordModal();
      });
    }, 0);
  }
}

// ============ NOTIFIKASI ============
function buildNotificationText(){
  const today = todayISO();
  const list = window.state.products.map(decorate);

  const hariIni = [], hariH = [], urgent = [];

  list.forEach(p => p.items.forEach(i => {
    if(i.date === today){
      hariIni.push({ p, i });
      if(i.type === 'takeout' || (i.type === 'rtc' && i.emp)) hariH.push({ p, i });
    }
  }));

  list.forEach(p => p.items.forEach(i => {
    const d = daysDiff(today, i.date);
    if(d > 0 && d <= 3) urgent.push({ p, i, d });
  }));

  let body = `📅 Tanggal: ${fmtDI(today)}\n\n`;
  body += `━━━ A. EVENT HARI INI (${hariIni.length}) ━━━\n`;
  if(hariIni.length){
    hariIni.forEach((x, k) => {
      let label = '';
      if(x.i.type === 'rtc') label = `Diskon ${x.i.pct}%${x.i.emp ? ' (KARYAWAN)' : ''}`;
      else if(x.i.type === 'takeout') label = 'TAKE OUT (tarik dari rak)';
      else if(x.i.type === 'ret') label = 'RETURN ke supplier';
      else if(x.i.type === 'extra') label = `Diskon ${x.i.pct}% (manual)`;
      body += `${k + 1}. ${x.p.nm}\n   Barcode: ${x.p.barcode || barcodeFromId(x.p.bc)}\n   Aksi: ${label}\n   Exp: ${x.p.expiry}\n   Qty: ${x.p.quantity || 1}\n`;
    });
  } else {
    body += '(Tidak ada)\n';
  }

  body += `\n━━━ B. PERHATIAN HARI H (${hariH.length}) ━━━\n`;
  if(hariH.length){
    hariH.forEach((x, k) => {
      const label = x.i.type === 'takeout' ? 'TAKE OUT' : 'Diskon 80% KARYAWAN';
      body += `${k + 1}. ${x.p.nm}\n   Barcode: ${x.p.barcode || barcodeFromId(x.p.bc)}\n   Aksi: ${label}\n`;
    });
  } else {
    body += '(Tidak ada)\n';
  }

  body += `\n━━━ C. URGENT 3 HARI KE DEPAN (${urgent.length}) ━━━\n`;
  if(urgent.length){
    urgent.sort((a, b) => a.d - b.d);
    urgent.forEach((x, k) => {
      let label = '';
      if(x.i.type === 'rtc') label = `Diskon ${x.i.pct}%${x.i.emp ? ' (kar)' : ''}`;
      else if(x.i.type === 'takeout') label = 'TAKE OUT';
      else if(x.i.type === 'ret') label = 'RETURN';
      else if(x.i.type === 'extra') label = `Diskon ${x.i.pct}% manual`;
      body += `${k + 1}. [${x.d} hari lagi] ${x.p.nm}\n   Aksi: ${label} · Tgl: ${x.i.date}\n`;
    });
  } else {
    body += '(Tidak ada)\n';
  }

  return body;
}

function showNotificationModal(){
  if(!window.state.settings.notif){
    toast('Notifikasi dinonaktifkan', 'er');
    return;
  }
  const body = buildNotificationText();
  const title = document.getElementById('mtitle');
  const bodyEl = document.getElementById('mbody');
  if(title) title.textContent = '🔔 Notifikasi Harian';
  if(bodyEl) bodyEl.textContent = body;

  const modal = document.getElementById('modal');
  if(modal) modal.classList.remove('hide');
}

function closeNotificationModal(){
  const modal = document.getElementById('modal');
  if(modal) modal.classList.add('hide');
}

// ============ BIND GLOBAL EVENTS ============
function bindGlobalEvents(){
  // Bottom nav
  document.querySelectorAll('.bn button').forEach(b => {
    b.addEventListener('click', () => goTo(b.dataset.p));
  });

  // Topbar setting button
  const btnTopSet = document.getElementById('btn-top-setting');
  if(btnTopSet) btnTopSet.addEventListener('click', () => goTo('set'));

  // Topbar notif button
  const bn = document.getElementById('bn');
  if(bn) bn.addEventListener('click', showNotificationModal);

  // Modal notif
  const mclose = document.getElementById('mclose');
  const mok = document.getElementById('mok');
  const modal = document.getElementById('modal');
  const mcopy = document.getElementById('mcopy');

  if(mclose) mclose.addEventListener('click', closeNotificationModal);
  if(mok) mok.addEventListener('click', closeNotificationModal);
  if(modal){
    modal.addEventListener('click', (e) => {
      if(e.target === modal) closeNotificationModal();
    });
  }
  if(mcopy){
    mcopy.addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(document.getElementById('mbody').textContent);
        toast('Disalin', 'ok');
      }catch(e){
        toast('Gagal menyalin', 'er');
      }
    });
  }

  // Buka pengaturan dari halaman tema
  const btnOpenSet = document.getElementById('btn-open-settings');
  if(btnOpenSet) btnOpenSet.addEventListener('click', () => goTo('set'));
}

// ============ UPDATE ONLINE BADGE ============
function updateOnlineBadge(){
  const badge = document.getElementById('online-badge');
  if(!badge) return;
  if(navigator.onLine){
    badge.classList.add('hide');
  } else {
    badge.classList.remove('hide');
    badge.textContent = '⚠️ Offline';
    badge.style.background = 'var(--dg)';
  }
}

// ============ BOOT ============
async function boot(){
  console.log('🚀 Boot dimulai');

  // 1. Load tema dulu (biar tidak flash)
  loadTheme();

  // 2. Muat master dari file (fallback)
  if(typeof loadMasterFromFile === 'function') loadMasterFromFile();

  // 3. Muat produk dari localStorage (offline cache)
  loadProductsLocal();

  // 4. JANGAN tampilkan halaman apapun dulu
  //    Login overlay sudah tampil default dari HTML.
  //    Halaman scan akan dibuka setelah cek login.

  // 5. Tunggu Firebase siap
  try{
    await window.waitForFB(10000);
  }catch(e){
    toast('⚠️ Firebase tidak bisa dimuat. Beberapa fitur tidak jalan.', 'er');
    console.error('Boot error:', e);
    // Tetap tampilkan login (biar user tahu aplikasi hidup)
    showLogin();
    bindAllEvents();
    return;
  }

  // 6. Firebase siap → cek admin default
  await ensureAdminExists();

  // 7. Load session
  loadSession();

  // 8. Kalau sudah login → tampilkan app
  if(isLoggedIn()){
    showApp();
    await refreshMasterFromFS();
    await loadProductsFromFS();
    startRealtimeSync();
    startLastSeenUpdate();
    startSessionListener();
    startIdleTimer();
    startLogsRealtime();

    if(window.state.curPage === 'dash') renderDash();
    if(window.state.curPage === 'set') renderSet();

    toast(`Selamat datang kembali, ${window.state.currentUser.nama}!`, 'ok');
  } else {
    showLogin();
  }

  // 9. Bind semua event
  bindAllEvents();

  // 10. Online/offline listener
  window.addEventListener('online', () => {
    updateOnlineBadge();
    toast('🟢 Online', 'ok');
  });
  window.addEventListener('offline', () => {
    updateOnlineBadge();
    toast('⚠️ Offline — data akan disimpan lokal', 'er');
  });
  updateOnlineBadge();

  console.log('✅ Boot selesai');
}

// ============ BIND ALL ============
function bindAllEvents(){
  // Global
  bindGlobalEvents();

  // Auth
  if(typeof bindAuthEvents === 'function') bindAuthEvents();

  // Scan
  if(typeof bindScanEvents === 'function') bindScanEvents();

  // Dashboard
  if(typeof bindDashboardChips === 'function') bindDashboardChips();
  if(typeof bindProdModal === 'function') bindProdModal();

  // Users
  if(typeof bindUsersEvents === 'function') bindUsersEvents();

  // Logs
  if(typeof bindLogsEvents === 'function') bindLogsEvents();

  // Master
  if(typeof bindMasterEvents === 'function') bindMasterEvents();

  // Export
  if(typeof bindExportEvents === 'function') bindExportEvents();
}

// ============ EXPOSE ============
window.goTo = goTo;
window.showLogin = showLogin;
window.showApp = showApp;
window.renderSet = renderSet;
window.showNotificationModal = showNotificationModal;
window.closeNotificationModal = closeNotificationModal;
window.boot = boot;

// ============ AUTO START ============
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

console.log('✅ app.js loaded');
