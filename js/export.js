// ============================================================
// export.js — Migrasi & Export master.js
// ============================================================

// ============ MIGRASI MASTER KE FIRESTORE ============
async function migrateMasterToFirestore(){
  const msg = document.getElementById('migrate-msg');
  if(msg){
    msg.style.color = 'var(--mt)';
    msg.textContent = 'Menghitung...';
  }

  const M = window.MASTER;
  if(!M || !M.length){
    if(msg){
      msg.style.color = 'var(--dg)';
      msg.textContent = 'master.js tidak ditemukan atau kosong';
    }
    return;
  }

  const total = M.length;

  try{
    const existing = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'master')
    );
    if(existing.size > 0){
      if(!confirm(`Sudah ada ${existing.size} produk di Firebase. Lanjut akan MENIMPA. Lanjut?`)){
        if(msg) msg.textContent = 'Dibatalkan.';
        return;
      }
    }
  }catch(e){}

  let done = 0, error = 0;
  if(msg) msg.textContent = `Mengupload 0 / ${total}...`;

  const BATCH = 400;
  for(let i = 0; i < total; i += BATCH){
    try{
      const batch = window.fb.writeBatch(window.fb.db);
      const slice = M.slice(i, i + BATCH);
      slice.forEach(row => {
        // Format baru: [bc, nm, patternCode, returnH, division, origin]
        const [bc, nm, pcode, retH, division, origin] = row;
        if(!bc) return;
        const ref = window.fb.doc(window.fb.db, 'master', String(bc));
        batch.set(ref, {
          bc: String(bc),
          nm: nm || '',
          patternCode: pcode || 0,
          returnH: retH || 0,
          division: division || null,   // ⭐ BARU
          origin: origin || null,        // ⭐ BARU
          deleted: false,
          updatedAt: new Date().toISOString(),
          updatedBy: window.state.currentUser ? (window.state.currentUser.username || 'system') : 'system'
        });
      });
      await batch.commit();
      done += slice.length;
      if(msg) msg.textContent = `Mengupload ${done} / ${total}...`;
    }catch(e){
      console.error('Batch error:', e);
      error += 1;
    }
  }

  if(error === 0){
    if(msg){
      msg.style.color = 'var(--ok)';
      msg.textContent = `✅ Selesai! ${done} produk berhasil diupload.`;
    }
    toast(`${done} produk berhasil dimigrasi`, 'ok');
  } else {
    if(msg){
      msg.style.color = 'var(--dg)';
      msg.textContent = `⚠️ ${done} berhasil, ${error} batch gagal.`;
    }
  }
}

// ============ EXPORT MASTER.JS DARI FIRESTORE ============
async function exportMasterJS(){
  const msg = document.getElementById('export-master-msg');
  if(msg){
    msg.style.color = 'var(--mt)';
    msg.textContent = 'Membaca data...';
  }

  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'master')
    );
    const rows = [];
    snap.forEach(d => {
      const x = d.data();
      if(x.bc && x.nm){
        rows.push(`['${x.bc}','${String(x.nm).replace(/'/g, "\\'")}',${x.patternCode || 0},${x.returnH || 0}]`);
      }
    });
    rows.sort();

    const content = `// master.js — Backup dari Firestore
// Total: ${rows.length} produk
// Dibuat: ${new Date().toISOString()}

const P = {
  0: null,
  1: [7, 5, 3, 2],
  2: [30, 14, 7, 3],
  3: [14, 7, 5, 3],
  4: [10, 7, 5, 2],
  5: [3, 2, 1],
  6: [5, 3, 2, 1],
  7: [4, 3, 2, 1],
  8: [7, null, null, null],
  9: [30, null, null, null],
  10: [14, null, null, null],
  11: [3, null, null, null],
};

const MASTER = [
${rows.join(',\n')}
];

window.P = P;
window.MASTER = MASTER;
`;

    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'master.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if(msg){
      msg.style.color = 'var(--ok)';
      msg.textContent = `✅ ${rows.length} produk diekspor ke master.js`;
    }
    toast(`Export selesai: ${rows.length} produk`, 'ok');
  }catch(e){
    if(msg){
      msg.style.color = 'var(--dg)';
      msg.textContent = 'Gagal: ' + e.message;
    }
  }
}

// ============ EXPORT DATA SAYA (JSON) ============
function exportMyData(){
  const data = {
    products: window.state.products,
    settings: window.state.settings,
    exportedAt: new Date().toISOString(),
    exportedBy: window.state.currentUser ? window.state.currentUser.username : '-'
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expiry-rtc-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Data diekspor', 'ok');
}

// ============ IMPORT DATA SAYA ============
async function importMyData(file){
  try{
    const txt = await file.text();
    const d = JSON.parse(txt);

    if(d.products && Array.isArray(d.products)){
      window.state.products = d.products;
      saveProductsLocal();
    }
    if(d.settings){
      window.state.settings = { ...window.state.settings, ...d.settings };
    }

    toast('Data diimpor', 'ok');

    // Sync ke Firestore (batch)
    if(d.products && d.products.length && window.fbReady){
      if(confirm(`Upload ${d.products.length} produk ke Firebase?`)){
        const BATCH = 400;
        let done = 0;
        for(let i = 0; i < d.products.length; i += BATCH){
          try{
            const batch = window.fb.writeBatch(window.fb.db);
            const slice = d.products.slice(i, i + BATCH);
            slice.forEach(p => {
              const { bc, ...rest } = p;
              if(!bc) return;
              batch.set(window.fb.doc(window.fb.db, 'products', bc), rest);
            });
            await batch.commit();
            done += slice.length;
          }catch(e){ console.error(e); }
        }
        toast(`${done} produk diupload ke Firebase`, 'ok');
      }
    }

    if(typeof renderSet === 'function') renderSet();
    if(typeof renderDash === 'function') renderDash();
  }catch(e){
    toast('File tidak valid', 'er');
  }
}

// ============ RESET DATA SAYA ============
async function resetMyData(){
  if(!confirm('Hapus semua produk yang Anda simpan?\n\nData di Firebase juga akan dihapus.')) return;

  const bcList = window.state.products.map(p => p.bc);

  window.state.products = [];
  saveProductsLocal();

  // Hapus dari Firestore
  if(window.fbReady && bcList.length){
    const BATCH = 400;
    for(let i = 0; i < bcList.length; i += BATCH){
      try{
        const batch = window.fb.writeBatch(window.fb.db);
        const slice = bcList.slice(i, i + BATCH);
        slice.forEach(bc => {
          batch.delete(window.fb.doc(window.fb.db, 'products', bc));
        });
        await batch.commit();
      }catch(e){ console.error(e); }
    }
  }

  toast('Data direset', 'ok');
  if(typeof renderSet === 'function') renderSet();
  if(typeof renderDash === 'function') renderDash();
}

// ============ BIND ============
function bindExportEvents(){
  const btnMigrate = document.getElementById('btn-migrate');
  const btnExportMaster = document.getElementById('btn-export-master');
  const btnExp = document.getElementById('bExp');
  const btnImp = document.getElementById('bImp');
  const fileImp = document.getElementById('fileImp');
  const btnRst = document.getElementById('bRst');

  if(btnMigrate){
    btnMigrate.addEventListener('click', async () => {
      if(!confirm('Mulai migrasi master.js ke Firebase? Proses 1-3 menit.')) return;
      btnMigrate.disabled = true;
      btnMigrate.textContent = '⏳ Sedang upload...';
      await migrateMasterToFirestore();
      btnMigrate.disabled = false;
      btnMigrate.textContent = '⬆ Migrasi Master Sekarang';
    });
  }

  if(btnExportMaster) btnExportMaster.addEventListener('click', exportMasterJS);
  if(btnExp) btnExp.addEventListener('click', exportMyData);
  if(btnImp) btnImp.addEventListener('click', () => fileImp && fileImp.click());
  if(fileImp){
    fileImp.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if(f) importMyData(f);
    });
  }
  if(btnRst) btnRst.addEventListener('click', resetMyData);
}

// Expose
window.migrateMasterToFirestore = migrateMasterToFirestore;
window.exportMasterJS = exportMasterJS;
window.exportMyData = exportMyData;
window.importMyData = importMyData;
window.resetMyData = resetMyData;
window.bindExportEvents = bindExportEvents;

console.log('✅ export.js loaded');
