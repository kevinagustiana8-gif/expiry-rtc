// ============================================================
// masterhelper.js — Helper tambah ke master + limit + log
// ============================================================

// Cek limit harian staff
async function checkAddLimit(username){
  const user = window.state.currentUser;
  if(!user) return { allowed: false, error: 'Belum login' };

  // Admin+ unlimited
  if(user.role === 'admin' || user.role === 'manager' || user.role === 'owner'){
    return { allowed: true, remaining: Infinity, unlimited: true };
  }

  const today = todayISO();
  try{
    const snap = await window.fb.getDoc(window.fb.doc(window.fb.db, 'users', username));
    if(!snap.exists()) return { allowed: false, error: 'User tidak ditemukan' };
    const data = snap.data();
    let count = data.masterAddToday || 0;
    if(data.masterAddDate !== today) count = 0;

    if(count >= 2){
      return { allowed: false, remaining: 0, error: '⚠️ Batas 2 produk/hari tercapai. Reset jam 12 malam.' };
    }
    return { allowed: true, remaining: 2 - count };
  }catch(e){
    return { allowed: false, error: e.message };
  }
}

// Increment counter staff
async function incrementAddCount(username){
  const today = todayISO();
  try{
    const ref = window.fb.doc(window.fb.db, 'users', username);
    const snap = await window.fb.getDoc(ref);
    let count = 0;
    if(snap.exists()){
      const d = snap.data();
      count = d.masterAddDate === today ? (d.masterAddToday || 0) : 0;
    }
    await window.fb.setDoc(ref, {
      masterAddDate: today,
      masterAddToday: count + 1
    }, { merge: true });
  }catch(e){ console.error('incrementAddCount error:', e); }
}

// Tambah produk ke master
async function addToMaster({ bc, nm, patternCode = 0, returnH = 0, division = null, origin = null }){
  if(!window.fbReady) return { error: 'Firebase belum siap' };
  if(!bc || !nm) return { error: 'Barcode & nama wajib' };

  try{
    const ref = window.fb.doc(window.fb.db, 'master', String(bc));
    const snap = await window.fb.getDoc(ref);
    if(snap.exists() && snap.data().deleted !== true){
      return { error: 'Produk sudah ada di master' };
    }

    await window.fb.setDoc(ref, {
      bc: String(bc), nm, patternCode, returnH,
      customRtc: null,
      division: division || null,
      origin: origin || null,
      createdAt: new Date().toISOString(),
      createdBy: window.state.currentUser?.username || '-',
      deleted: false
    });
    return { ok: true };
  }catch(e){
    return { error: e.message };
  }
}

// Log penambahan master
async function logMasterAdd(entry){
  try{
    const ref = window.fb.doc(window.fb.collection(window.fb.db, 'master_log'));
    await window.fb.setDoc(ref, {
      ...entry,
      timestamp: new Date().toISOString(),
      deleted: false
    });
  }catch(e){ console.error('logMasterAdd error:', e); }
}

// Hapus produk dari master via log (manager+ only)
async function deleteMasterFromLog(logId, bc){
  const u = window.state.currentUser;
  if(!u || (u.role !== 'manager' && u.role !== 'owner')){
    return { error: 'Tidak punya izin' };
  }
  try{
    // Hapus dari master (hard delete)
    await window.fb.deleteDoc(window.fb.doc(window.fb.db, 'master', bc));

    // Soft delete log entry
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'master_log', logId),
      {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: u.username
      },
      { merge: true }
    );

    if(typeof refreshMasterFromFS === 'function') await refreshMasterFromFS();
    return { ok: true };
  }catch(e){
    return { error: e.message };
  }
}

window.checkAddLimit = checkAddLimit;
window.incrementAddCount = incrementAddCount;
window.addToMaster = addToMaster;
window.logMasterAdd = logMasterAdd;
window.deleteMasterFromLog = deleteMasterFromLog;

console.log('✅ masterhelper.js loaded');
