// ============================================================
// users.js — Manajemen pengguna & role
// ============================================================

// ============ LOAD USERS ============
async function loadUsers(){
  if(!isAdmin()) return;
  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'users')
    );
    const users = [];
    snap.forEach(d => users.push({ id: d.id, ...d.data() }));
    users.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
    renderUsers(users);
  }catch(e){
    console.error('Load users error:', e);
    toast('Gagal memuat daftar pengguna', 'er');
  }
}

// ============ RENDER USERS ============
function renderUsers(users){
  const countEl = document.getElementById('usr-count');
  if(countEl) countEl.textContent = users.length;

  const me = window.state.currentUser;

  // === SELF INFO ===
  const selfEl = document.getElementById('usr-self');
  if(selfEl && me){
    const initial = (me.nama || me.username || '?').charAt(0).toUpperCase();
    const selfBg = document.body.classList.contains('theme-malam')
      ? 'rgba(99,102,241,.15)'
      : document.body.classList.contains('theme-siang')
        ? 'rgba(2,132,199,.1)'
        : '#eff6ff';

    selfEl.style.background = selfBg;
    selfEl.style.borderColor = 'var(--bd)';
    selfEl.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div class="usr-avatar">${initial}</div>
        <div style="flex:1">
          <div class="usr-name">${esc(me.nama)}</div>
          <div class="usr-meta">
            <span>@${esc(me.username || '-')}</span>
            <span class="role-badge role-${me.role}">${me.role.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <button class="bt bs" style="margin-top:12px;padding:9px;color:var(--dg);border-color:var(--dg)" id="usr-logout">🚪 Keluar</button>
    `;
    setTimeout(() => {
      const lo = document.getElementById('usr-logout');
      if(lo) lo.addEventListener('click', () => { if(typeof logout === 'function') logout(); });
    }, 0);
  }

  // === LIST ===
  const el = document.getElementById('usr-list');
  if(!el) return;

  if(!users.length){
    el.innerHTML = '<div class="em" style="padding:30px 10px">Belum ada pengguna.</div>';
    return;
  }

  el.innerHTML = users.map(u => {
    const initial = (u.nama || u.username || '?').charAt(0).toUpperCase();
    const isSelf = me && u.username === (me.username || me.id);
    const lastSeen = u.lastSeen || u.lastLogin;
    const online = isOnline(lastSeen);

    // Role hierarchy check
    const myRole = me ? me.role : 'staff';
    const targetRole = u.role || 'staff';

    // Bisa ubah role?
    let canChangeRole = false;
    if(myRole === 'owner' && !isSelf && targetRole !== 'owner') canChangeRole = true;
    if(myRole === 'manager' && !isSelf && (targetRole === 'admin' || targetRole === 'staff')) canChangeRole = true;

    // Bisa reset password?
    let canReset = false;
    if(myRole === 'owner' && targetRole !== 'owner') canReset = true;
    if(myRole === 'manager' && (targetRole === 'admin' || targetRole === 'staff')) canReset = true;
    if(myRole === 'admin' && targetRole === 'staff') canReset = true;
    if(isSelf) canReset = true; // bisa ganti password sendiri

    // Bisa hapus?
    let canDelete = false;
    if(myRole === 'owner' && !isSelf && targetRole !== 'owner') canDelete = true;
    if(myRole === 'manager' && !isSelf && (targetRole === 'admin' || targetRole === 'staff')) canDelete = true;
    if(myRole === 'admin' && !isSelf && targetRole === 'staff') canDelete = true;

    return `<div class="usr-item">
      <div class="usr-avatar" style="position:relative">
        ${initial}
        <span class="online-dot ${online ? 'on' : ''}" style="position:absolute;bottom:2px;right:2px;border:2px solid var(--sur)"></span>
      </div>
      <div class="usr-info">
        <div class="usr-name">${esc(u.nama || '-')}${isSelf ? ' <span style="color:var(--mt);font-weight:400">(Anda)</span>' : ''}</div>
        <div class="usr-meta">
          <span>@${esc(u.username || '-')}</span>
          <span class="role-badge role-${targetRole}">${targetRole.toUpperCase()}</span>
          <span>${online ? '🟢 Online' : relativeTime(lastSeen)}</span>
        </div>
      </div>
      <div class="usr-actions">
        ${canChangeRole ? `<button class="usr-btn" data-action="role" data-user="${esc(u.username)}" title="Ubah Role">🎭</button>` : ''}
        ${canReset ? `<button class="usr-btn" data-action="reset" data-user="${esc(u.username)}" title="Reset Password">🔑</button>` : ''}
        ${canDelete ? `<button class="usr-btn danger" data-action="del" data-user="${esc(u.username)}" title="Hapus">🗑</button>` : ''}
      </div>
    </div>`;
  }).join('');

  // Bind actions
  el.querySelectorAll('[data-action]').forEach(b => {
    b.addEventListener('click', async () => {
      const u = b.dataset.user;
      const a = b.dataset.action;
      if(a === 'del') await deleteUserConfirm(u);
      else if(a === 'reset') await resetUserPassword(u);
      else if(a === 'role') await changeUserRole(u);
    });
  });
}

// ============ TAMBAH USER ============
async function addUser(){
  const username = document.getElementById('usr-new-user').value.trim().toLowerCase();
  const password = document.getElementById('usr-new-pass').value;
  const nama = document.getElementById('usr-new-nama').value.trim();
  const role = document.getElementById('usr-new-role').value;
  const msg = document.getElementById('usr-add-msg');

  msg.style.color = 'var(--dg)';

  if(!/^[a-z0-9_]{3,20}$/.test(username)){
    msg.textContent = 'Username harus 3-20 huruf kecil/angka/underscore';
    return;
  }
  if(password.length < 6){
    msg.textContent = 'Password minimal 6 karakter';
    return;
  }
  if(!nama){
    msg.textContent = 'Nama lengkap wajib diisi';
    return;
  }

  const me = window.state.currentUser;
  const myRole = me ? me.role : 'staff';

  // Izin buat user berdasarkan role
  if(role === 'owner'){
    msg.textContent = 'Tidak bisa membuat akun owner dari sini';
    return;
  }
  if(role === 'manager' && myRole !== 'owner'){
    msg.textContent = 'Hanya owner yang bisa membuat manager';
    return;
  }
  if(role === 'admin' && myRole !== 'owner' && myRole !== 'manager'){
    msg.textContent = 'Hanya owner/manager yang bisa membuat admin';
    return;
  }
  if(role === 'staff' && myRole !== 'owner' && myRole !== 'manager' && myRole !== 'admin'){
    msg.textContent = 'Tidak punya izin';
    return;
  }

  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'users'));
    let exists = false;
    snap.forEach(d => { if(d.id === username) exists = true; });
    if(exists){ msg.textContent = 'Username sudah dipakai'; return; }

    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'users', username),
      {
        username, password, nama, role,
        createdAt: new Date().toISOString(),
        createdBy: me ? me.username : '-'
      }
    );

    msg.style.color = 'var(--ok)';
    msg.textContent = `✅ Pengguna @${username} ditambahkan`;
    document.getElementById('usr-new-user').value = '';
    document.getElementById('usr-new-pass').value = '';
    document.getElementById('usr-new-nama').value = '';
    document.getElementById('usr-new-role').value = 'staff';
    loadUsers();
  }catch(e){
    msg.textContent = 'Gagal: ' + e.message;
  }
}

// ============ UBAH ROLE ============
async function changeUserRole(username){
  const me = window.state.currentUser;
  if(!me) return;

  let target = null;
  try{
    const snap = await window.fb.getDoc(window.fb.doc(window.fb.db, 'users', username));
    if(snap.exists()) target = { id: snap.id, ...snap.data() };
  }catch(e){}

  if(!target){ toast('User tidak ditemukan', 'er'); return; }

  const curRole = target.role || 'staff';
  const myRole = me.role;

  // Role yang bisa dituju
  let opts = [];
  if(myRole === 'owner'){
    opts = ['staff', 'admin', 'manager'];
  } else if(myRole === 'manager'){
    opts = ['staff', 'admin'];
  } else {
    toast('Tidak punya izin ubah role', 'er');
    return;
  }

  const input = prompt(
    `Ubah role untuk:\n\n${target.nama} (@${username})\n\nRole sekarang: ${curRole.toUpperCase()}\n\n` +
    `Ketik role baru:\n${opts.map(o => '- ' + o).join('\n')}`,
    curRole
  );
  if(input === null) return;

  const newRole = input.trim().toLowerCase();
  if(!opts.includes(newRole)){
    toast('Role tidak valid', 'er');
    return;
  }
  if(newRole === curRole){
    toast('Role tidak berubah', 'er');
    return;
  }

  if(!confirm(`Ubah role @${username}\nDari: ${curRole.toUpperCase()}\nKe: ${newRole.toUpperCase()}\n\nLanjut?`)) return;

  try{
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'users', username),
      {
        role: newRole,
        roleChangedAt: new Date().toISOString(),
        roleChangedBy: me.username
      },
      { merge: true }
    );
    toast(`Role @${username} → ${newRole.toUpperCase()}`, 'ok');
    loadUsers();
  }catch(e){
    toast('Gagal ubah role: ' + e.message, 'er');
  }
}

// ============ RESET PASSWORD USER ============
async function resetUserPassword(username){
  const np = prompt(`Password baru untuk @${username}:`);
  if(!np) return;
  if(np.length < 6){ toast('Minimal 6 karakter', 'er'); return; }

  try{
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'users', username),
      {
        password: np,
        passwordResetAt: new Date().toISOString(),
        passwordResetBy: window.state.currentUser ? window.state.currentUser.username : '-'
      },
      { merge: true }
    );
    toast(`Password @${username} direset`, 'ok');
  }catch(e){
    toast('Gagal: ' + e.message, 'er');
  }
}

// ============ HAPUS USER ============
async function deleteUserConfirm(username){
  if(!confirm(`Hapus pengguna @${username}?\n\nTindakan ini tidak bisa dibatalkan.`)) return;

  try{
    await window.fb.deleteDoc(window.fb.doc(window.fb.db, 'users', username));
    toast(`Pengguna @${username} dihapus`, 'ok');
    loadUsers();
  }catch(e){
    toast('Gagal hapus: ' + e.message, 'er');
  }
}

// ============ BIND ============
function bindUsersEvents(){
  const addBtn = document.getElementById('usr-add-btn');
  if(addBtn) addBtn.addEventListener('click', addUser);
}

// Expose
window.loadUsers = loadUsers;
window.renderUsers = renderUsers;
window.addUser = addUser;
window.changeUserRole = changeUserRole;
window.resetUserPassword = resetUserPassword;
window.deleteUserConfirm = deleteUserConfirm;
window.bindUsersEvents = bindUsersEvents;

console.log('✅ users.js loaded');
