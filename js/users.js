// ============================================================
// users.js — Manajemen pengguna & role & divisi (FINAL)
// ============================================================

async function loadUsers(){
  if(!isAdmin()) return;
  updateRoleDropdown();
  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'users'));
    const users = [];
    snap.forEach(d => users.push({ id: d.id, ...d.data() }));
    users.sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    const me = window.state.currentUser;
    const myRole = me ? me.role : 'staff';
    const visible = myRole === 'owner'
      ? users
      : users.filter(u => (u.role || 'staff') !== 'owner');

    renderUsers(visible);
  }catch(e){
    console.error('Load users error:', e);
    toast('Gagal memuat daftar pengguna', 'er');
  }
}

function renderUsers(users){
  const countEl = document.getElementById('usr-count');
  if(countEl) countEl.textContent = users.length;

  const me = window.state.currentUser;

  // === SELF INFO ===
  const selfEl = document.getElementById('usr-self');
  if(selfEl && me){
    const initial = (me.nama || me.username || '?').charAt(0).toUpperCase();
    // ⭐ Owner tidak perlu badge divisi
    const showDiv = me.role !== 'owner' && me.division;
    const divInfo = showDiv ? getDivision(me.division) : null;

    selfEl.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div class="usr-avatar">${initial}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px;margin-bottom:2px">${esc(me.nama)}</div>
          <div class="usr-meta">
            <span>@${esc(me.username || '-')}</span>
            <span class="role-badge role-${me.role}">${me.role.toUpperCase()}</span>
            ${divInfo ? `<span class="role-badge" style="background:${divInfo.bg};color:${divInfo.color}">${divInfo.icon} ${divInfo.name}</span>` : ''}
          </div>
        </div>
      </div>
      <button class="bt" style="margin-top:12px;padding:9px;color:#ef4444;border:1px solid #ef4444;background:transparent;font-family:inherit;font-weight:600;cursor:pointer;width:100%;border-radius:12px" id="usr-logout">🚪 Keluar</button>
    `;

    setTimeout(() => {
      const lo = document.getElementById('usr-logout');
      if(lo) lo.addEventListener('click', () => { if(typeof logout === 'function') logout(false); });
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

    const myRole = me ? me.role : 'staff';
    const myDiv = me?.division || 'grocery';
    const targetRole = u.role || 'staff';
    const targetDiv = u.division || 'grocery';

    // ============ IZIN UBAH ROLE ============
    let canChangeRole = false;
    if(myRole === 'owner' && !isSelf && targetRole !== 'owner') canChangeRole = true;
    if(myRole === 'manager' && !isSelf && (targetRole === 'admin' || targetRole === 'staff')) canChangeRole = true;

    // ============ IZIN UBAH DIVISI ============
    let canChangeDiv = false;
    if(myRole === 'owner' && !isSelf && targetRole !== 'owner'){
      canChangeDiv = true;
    }
    if(myRole === 'manager' && !isSelf && targetRole !== 'owner'){
      canChangeDiv = true;
    }
    if(myRole === 'admin' && !isSelf && targetRole === 'staff'){
      // ⭐ Admin: HANYA bisa pindah staff yang SEKARANG di divisinya
      if(targetDiv === myDiv) canChangeDiv = true;
    }

    // ============ IZIN RESET PASSWORD ============
    let canReset = false;
    if(myRole === 'owner' && targetRole !== 'owner') canReset = true;
    if(myRole === 'manager' && (targetRole === 'admin' || targetRole === 'staff')) canReset = true;
    if(myRole === 'admin' && targetRole === 'staff') canReset = true;
    if(isSelf) canReset = true;

    // ============ IZIN HAPUS ============
    let canDelete = false;
    if(myRole === 'owner' && !isSelf && targetRole !== 'owner') canDelete = true;
    if(myRole === 'manager' && !isSelf && (targetRole === 'admin' || targetRole === 'staff')) canDelete = true;
    if(myRole === 'admin' && !isSelf && targetRole === 'staff') canDelete = true;

    // ⭐ Owner tidak perlu badge divisi
    const uDiv = (targetRole !== 'owner' && u.division) ? getDivision(u.division) : null;

    // ⭐ Tombol 🔄 untuk admin kalau staff beda divisi: disabled dengan 🔒
    let divActionHTML = '';
    if(canChangeDiv){
      divActionHTML = `<button class="usr-btn" data-action="division" data-user="${esc(u.username)}" title="Ubah Divisi">🔄</button>`;
    } else if(myRole === 'admin' && targetRole === 'staff' && !isSelf && targetDiv !== myDiv){
      divActionHTML = `<button class="usr-btn" disabled title="Staff ini di divisi lain — tidak bisa dipindah oleh Anda" style="opacity:.35;cursor:not-allowed">🔒</button>`;
    }

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
          ${uDiv ? `<span class="role-badge" style="background:${uDiv.bg};color:${uDiv.color}">${uDiv.icon} ${uDiv.name}</span>` : ''}
          <span>${online ? '🟢 Online' : relativeTime(lastSeen)}</span>
        </div>
      </div>
      <div class="usr-actions">
        ${canChangeRole ? `<button class="usr-btn" data-action="role" data-user="${esc(u.username)}" title="Ubah Role">🎭</button>` : ''}
        ${divActionHTML}
        ${canReset ? `<button class="usr-btn" data-action="reset" data-user="${esc(u.username)}" title="Reset Password">🔑</button>` : ''}
        ${canDelete ? `<button class="usr-btn danger" data-action="del" data-user="${esc(u.username)}" title="Hapus">🗑</button>` : ''}
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-action]').forEach(b => {
    b.addEventListener('click', async () => {
      const u = b.dataset.user;
      const a = b.dataset.action;
      if(a === 'del') await deleteUserConfirm(u);
      else if(a === 'reset') await resetUserPassword(u);
      else if(a === 'role') await changeUserRole(u);
      else if(a === 'division') await changeUserDivision(u);
    });
  });
}

async function addUser(){
  const username = document.getElementById('usr-new-user').value.trim().toLowerCase();
  const password = document.getElementById('usr-new-pass').value;
  const nama = document.getElementById('usr-new-nama').value.trim();
  const role = document.getElementById('usr-new-role').value;
  const division = document.getElementById('usr-new-division').value;
  const msg = document.getElementById('usr-add-msg');

  msg.style.color = 'var(--dg)';

  if(!/^[a-z0-9_]{3,20}$/.test(username)){
    msg.textContent = 'Username 3-20 huruf kecil/angka/underscore'; return;
  }
  if(password.length < 6){ msg.textContent = 'Password minimal 6 karakter'; return; }
  if(!nama){ msg.textContent = 'Nama lengkap wajib'; return; }

  const me = window.state.currentUser;
  const myRole = me ? me.role : 'staff';
  if(myRole === 'staff'){ msg.textContent = 'Tidak punya izin'; return; }
  if(myRole === 'admin' && role !== 'staff'){ msg.textContent = 'Admin hanya bisa buat staff'; return; }
  if(myRole === 'manager' && role !== 'staff' && role !== 'admin' && role !== 'manager'){
    msg.textContent = 'Manager hanya bisa buat staff/admin/manager'; return;
  }
  if(myRole === 'owner' && role === 'owner'){ msg.textContent = 'Tidak bisa buat owner'; return; }
  if(!['staff','admin','manager'].includes(role)){ msg.textContent = 'Role tidak valid'; return; }
  if(!division){ msg.textContent = 'Divisi wajib dipilih'; return; }

  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'users'));
    let exists = false;
    snap.forEach(d => { if(d.id === username) exists = true; });
    if(exists){ msg.textContent = 'Username sudah dipakai'; return; }

    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'users', username),
      {
        username, password, nama, role, division,
        createdAt: new Date().toISOString(),
        createdBy: me ? me.username : '-'
      }
    );

    msg.style.color = 'var(--ok)';
    msg.textContent = `✅ Pengguna @${username} ditambahkan ke divisi ${division}`;
    document.getElementById('usr-new-user').value = '';
    document.getElementById('usr-new-pass').value = '';
    document.getElementById('usr-new-nama').value = '';
    document.getElementById('usr-new-role').value = 'staff';
    loadUsers();
  }catch(e){ msg.textContent = 'Gagal: ' + e.message; }
}

async function changeUserDivision(username){
  const me = window.state.currentUser;
  if(!me) return;

  // Ambil data user target
  let target = null;
  try{
    const snap = await window.fb.getDoc(window.fb.doc(window.fb.db, 'users', username));
    if(snap.exists()) target = { id: snap.id, ...snap.data() };
  }catch(e){}
  if(!target){ toast('User tidak ditemukan', 'er'); return; }

  const myRole = me.role;
  const myDiv = me.division || 'grocery';
  const targetRole = target.role || 'staff';
  const targetDiv = target.division || 'grocery';

  // ============ ATURAN IZIN ============
  // Owner: bebas pindah siapa saja (kecuali owner lain)
  // Manager: bebas pindah staff/admin/manager
  // Admin: HANYA staff yang SEDANG di divisi yang sama
  let allowed = false;
  let rejectReason = '';

  if(myRole === 'owner'){
    if(targetRole === 'owner'){
      rejectReason = 'Tidak bisa mengubah owner lain';
    } else {
      allowed = true;
    }
  }
  else if(myRole === 'manager'){
    if(targetRole === 'owner'){
      rejectReason = 'Manager tidak bisa mengubah owner';
    } else if(target.username === me.username){
      rejectReason = 'Tidak bisa mengubah diri sendiri';
    } else {
      allowed = true;
    }
  }
  else if(myRole === 'admin'){
    if(targetRole !== 'staff'){
      rejectReason = 'Admin hanya bisa memindahkan staff';
    } else if(target.username === me.username){
      rejectReason = 'Tidak bisa mengubah diri sendiri';
    } else if(targetDiv !== myDiv){
      // ⭐ ATURAN KETAT: admin hanya bisa pindah staff yang SEDANG di divisi sama
      const targetDivInfo = getDivision(targetDiv);
      const myDivInfo = getDivision(myDiv);
      rejectReason = `⚠️ Staff ini sekarang di divisi ${targetDivInfo.name}.\n\nAnda (Admin ${myDivInfo.name}) hanya bisa memindahkan staff yang saat ini di divisi Anda.\n\nMinta manager atau admin ${targetDivInfo.name} untuk memindahkannya.`;
    } else {
      allowed = true;
    }
  }
  else {
    rejectReason = 'Tidak punya izin ubah divisi';
  }

  if(!allowed){
    if(window.dlg && dlg.alert){
      await dlg.alert({ title: '🚫 Tidak Bisa Pindah', message: rejectReason, okText: 'OK' });
    } else {
      alert(rejectReason);
    }
    return;
  }

  // ============ PILIH DIVISI BARU ============
  const divIds = DEFAULT_DIVISIONS.map(d => d.id);
  const curDiv = targetDiv;

  const pick = await dlg.prompt({
    title: '🔄 Ubah Divisi',
    message: `User: ${target.nama} (@${username})\nRole: ${targetRole.toUpperCase()}\nDivisi sekarang: ${getDivision(curDiv).icon} ${getDivision(curDiv).name}\n\n${myRole === 'admin' ? '⚠️ Setelah dipindahkan, Anda TIDAK BISA menariknya kembali. Hanya manager/owner yang bisa.\n\n' : ''}Ketik ID divisi baru:\n• grocery\n• daily_dairy\n• perishable\n• health_beauty`,
    label: 'Divisi baru',
    placeholder: 'grocery',
    value: curDiv,
    type: 'text'
  });

  if(pick === null) return;
  const newDiv = String(pick).trim().toLowerCase();
  if(!divIds.includes(newDiv)){
    toast('Divisi tidak valid: ' + divIds.join(', '), 'er');
    return;
  }
  if(newDiv === curDiv){
    toast('Divisi tidak berubah', 'er');
    return;
  }

  // ============ KONFIRMASI KHUSUS ADMIN ============
  const divInfo = getDivision(newDiv);
  const curDivInfo = getDivision(curDiv);

  if(myRole === 'admin'){
    const confirmMsg = `Anda akan memindahkan:\n\n` +
      `👤 ${target.nama} (@${username})\n` +
      `📦 Dari: ${curDivInfo.icon} ${curDivInfo.name}\n` +
      `📦 Ke:   ${divInfo.icon} ${divInfo.name}\n\n` +
      `⚠️ PERINGATAN:\n` +
      `Setelah dipindahkan, Anda TIDAK BISA menariknya kembali ke divisi Anda.\n` +
      `Hanya manager atau owner yang bisa memindahkannya lagi.\n\n` +
      `Yakin ingin melanjutkan?`;

    const ok = window.dlg && dlg.confirm
      ? await dlg.confirm({
          title: '⚠️ Konfirmasi Pindah Staff',
          message: confirmMsg,
          okText: 'Ya, Pindahkan',
          cancelText: 'Batal',
          danger: true
        })
      : confirm(confirmMsg);
    if(!ok) return;
  } else {
    // Manager/Owner: konfirmasi biasa
    const ok = window.dlg && dlg.confirm
      ? await dlg.confirm({
          title: 'Konfirmasi',
          message: `Ubah divisi @${username}\n\nDari: ${curDivInfo.icon} ${curDivInfo.name}\nKe:   ${divInfo.icon} ${divInfo.name}\n\nLanjut?`
        })
      : confirm(`Ubah divisi @${username} ke ${divInfo.name}?`);
    if(!ok) return;
  }

  // ============ EKSEKUSI ============
  try{
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'users', username),
      {
        division: newDiv,
        divisionChangedAt: new Date().toISOString(),
        divisionChangedBy: me.username,
        divisionChangedByRole: myRole
      },
      { merge: true }
    );

    // ⭐ Audit log
    try{
      const logRef = window.fb.doc(window.fb.collection(window.fb.db, 'division_change_log'));
      await window.fb.setDoc(logRef, {
        username: target.username,
        nama: target.nama,
        role: targetRole,
        fromDivision: curDiv,
        toDivision: newDiv,
        changedBy: me.username,
        changedByName: me.nama,
        changedByRole: myRole,
        timestamp: new Date().toISOString()
      });
    }catch(e){ console.warn('Division log error:', e); }

    toast(`Divisi @${username} → ${divInfo.name}`, 'ok');
    loadUsers();
  }catch(e){
    toast('Gagal ubah divisi: ' + e.message, 'er');
  }
}

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

  let opts = [];
  if(myRole === 'owner') opts = ['staff', 'admin', 'manager'];
  else if(myRole === 'manager') opts = ['staff', 'admin'];
  else { toast('Tidak punya izin ubah role', 'er'); return; }

  const input = prompt(
    `Ubah role untuk:\n\n${target.nama} (@${username})\n\nRole sekarang: ${curRole.toUpperCase()}\n\n` +
    `Ketik role baru:\n${opts.map(o => '- ' + o).join('\n')}`,
    curRole
  );
  if(input === null) return;

  const newRole = input.trim().toLowerCase();
  if(!opts.includes(newRole)){ toast('Role tidak valid', 'er'); return; }
  if(newRole === curRole){ toast('Role tidak berubah', 'er'); return; }

  if(!confirm(`Ubah role @${username}\nDari: ${curRole.toUpperCase()}\nKe: ${newRole.toUpperCase()}\n\nLanjut?`)) return;

  try{
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'users', username),
      { role: newRole, roleChangedAt: new Date().toISOString(), roleChangedBy: me.username },
      { merge: true }
    );
    toast(`Role @${username} → ${newRole.toUpperCase()}`, 'ok');
    loadUsers();
  }catch(e){ toast('Gagal ubah role: ' + e.message, 'er'); }
}

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
  }catch(e){ toast('Gagal: ' + e.message, 'er'); }
}

async function deleteUserConfirm(username){
  if(!confirm(`Hapus pengguna @${username}?\n\nTidak bisa dibatalkan.`)) return;
  try{
    await window.fb.deleteDoc(window.fb.doc(window.fb.db, 'users', username));
    toast(`Pengguna @${username} dihapus`, 'ok');
    loadUsers();
  }catch(e){ toast('Gagal hapus: ' + e.message, 'er'); }
}

function updateRoleDropdown(){
  const sel = document.getElementById('usr-new-role');
  if(!sel) return;

  const me = window.state.currentUser;
  const myRole = me ? me.role : 'staff';

  let options = [];
  if(myRole === 'owner'){
    options = [
      { v:'staff', l:'Staff (hanya scan & lihat)' },
      { v:'admin', l:'Admin (kelola master)' },
      { v:'manager', l:'Manager (kelola admin & staff)' }
    ];
  } else if(myRole === 'manager'){
    options = [
      { v:'staff', l:'Staff (hanya scan & lihat)' },
      { v:'admin', l:'Admin (kelola master)' }
    ];
  } else if(myRole === 'admin'){
    options = [{ v:'staff', l:'Staff (hanya scan & lihat)' }];
  }

  sel.innerHTML = options.map(o => `<option value="${o.v}">${o.l}</option>`).join('');
}

function bindUsersEvents(){
  const addBtn = document.getElementById('usr-add-btn');
  if(addBtn) addBtn.addEventListener('click', addUser);
}

window.loadUsers = loadUsers;
window.renderUsers = renderUsers;
window.addUser = addUser;
window.changeUserRole = changeUserRole;
window.changeUserDivision = changeUserDivision;
window.resetUserPassword = resetUserPassword;
window.deleteUserConfirm = deleteUserConfirm;
window.bindUsersEvents = bindUsersEvents;

console.log('✅ users.js loaded (final)');
