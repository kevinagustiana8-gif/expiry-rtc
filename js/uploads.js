// ============================================================
// uploads.js — Sesi upload master produk
// ============================================================

function generateUploadId(){
  return 'upl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
}

async function startUploadSession(rows, opts){
  opts = opts || {};
  const me = window.state.currentUser;

  const existing = new Set();
  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'master'));
    snap.forEach(d => {
      const data = d.data();
      if(data.deleted !== true) existing.add(String(d.id));
    });
  }catch(e){
    return { error: 'Gagal baca master: ' + e.message };
  }

  const seenInBatch = new Set();
  const accepted = [];
  const skippedDup = [];

  rows.forEach(r => {
    const bc = String(r.bc || '').trim();
    if(!bc || !r.nm) return;
    if(existing.has(bc)){ skippedDup.push(bc); return; }
    if(seenInBatch.has(bc)){ skippedDup.push(bc); return; }
    seenInBatch.add(bc);
    accepted.push({ ...r, bc });
  });

  if(!accepted.length){
    return { error: `Semua ${rows.length} produk sudah ada. Tidak ada yang diupload.` };
  }

  let sessionIndex = 1;
  try{
    const ss = await window.fb.getDocs(window.fb.collection(window.fb.db, 'master_uploads'));
    sessionIndex = ss.size + 1;
  }catch(e){}

  const uploadId = generateUploadId();
  const now = new Date().toISOString();
  const barcodes = accepted.map(r => r.bc);

  try{
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'master_uploads', uploadId),
      {
        uploadId, index: sessionIndex,
        filename: opts.filename || 'unknown',
        uploadedAt: now,
        uploadedBy: me ? (me.username || '-') : 'system',
        uploadedByName: me ? (me.nama || '-') : 'System',
        count: accepted.length,
        skipped: skippedDup.length,
        barcodes,
        status: 'active'
      }
    );
  }catch(e){
    return { error: 'Gagal buat sesi: ' + e.message };
  }

  const BATCH = 400;
  let done = 0, failed = 0;
  for(let i = 0; i < accepted.length; i += BATCH){
    try{
      const batch = window.fb.writeBatch(window.fb.db);
      const slice = accepted.slice(i, i + BATCH);
      slice.forEach(r => {
        const ref = window.fb.doc(window.fb.db, 'master', r.bc);
        batch.set(ref, {
          bc: r.bc, nm: r.nm,
          patternCode: r.patternCode || 0,
          returnH: r.returnH || 0,
          customRtc: r.customRtc || null,
          division: r.division || null,
          origin: r.origin || null,
          uploadId, uploadedAt: now,
          uploadedBy: me ? (me.username || '-') : 'system',
          deleted: false
        });
      });
      await batch.commit();
      done += slice.length;
    }catch(e){
      console.error('Batch error:', e);
      failed += 1;
    }
  }

  return {
    ok: true, uploadId, index: sessionIndex,
    done, failed, total: accepted.length, skippedDup: skippedDup.length
  };
}

async function loadUploadSessions(){
  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'master_uploads'));
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a, b) => (b.index || 0) - (a.index || 0));
    window.state.uploadSessions = arr;
    return arr;
  }catch(e){
    console.error('Load sessions error:', e);
    return [];
  }
}

async function renderUploadsPage(){
  if(!isAdmin()) return;
  const el = document.getElementById('upl-list');
  if(!el) return;
  el.innerHTML = '<div class="mt" style="padding:20px;text-align:center">Memuat…</div>';

  await loadUploadSessions();
  const list = window.state.uploadSessions;

  if(!list.length){
    el.innerHTML = `<div class="cd"><div class="em" style="padding:30px 10px">
      <div class="ic">📦</div><div>Belum ada sesi upload.</div>
      <div class="mt" style="margin-top:8px">Upload file master.js di atas untuk memulai.</div>
    </div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="cd">
      <h2>📦 Riwayat Upload (${list.length})</h2>
      <div class="mt">Upload ke-2 & seterusnya otomatis melewati produk yang sudah ada.</div>
    </div>
    ${list.map(s => {
      const isDel = s.status === 'deleted';
      return `<div class="li ${isDel ? 'e' : 'o'}" style="flex-direction:column;align-items:stretch;gap:10px">
        <div>
          <div class="ln" style="font-size:15px">
            Upload #${s.index} ${isDel ? '<span class="tg" style="background:#fee2e2;color:#991b1b">DIHAPUS</span>' : ''}
          </div>
          <div class="lm">${fmtTime(s.uploadedAt)} · oleh ${esc(s.uploadedByName || s.uploadedBy || '-')}</div>
          <div class="lt" style="margin-top:8px">
            <span class="tg" style="background:#dcfce7;color:#166534">${s.count || 0} produk</span>
            ${s.skipped ? `<span class="tg" style="background:#fef3c7;color:#92400e">${s.skipped} skip duplikat</span>` : ''}
            <span class="tg" style="background:var(--bg);color:var(--mt)">📄 ${esc(s.filename || '-')}</span>
          </div>
        </div>
        <div class="br" style="margin-top:4px">
          <button class="bt bs" data-act="view" data-id="${esc(s.id)}" style="padding:9px">👁 Lihat & Pindah</button>
          ${!isDel
            ? `<button class="bt" data-act="del" data-id="${esc(s.id)}" style="padding:9px;background:var(--dg);color:#fff">🗑 Hapus</button>`
            : `<button class="bt bs" data-act="restore" data-id="${esc(s.id)}" style="padding:9px">♻ Pulihkan</button>`}
        </div>
      </div>`;
    }).join('')}
  `;

  el.querySelectorAll('[data-act]').forEach(b => {
    b.addEventListener('click', async () => {
      const act = b.dataset.act;
      const id = b.dataset.id;
      if(act === 'view') openUploadDetail(id);
      else if(act === 'del') await deleteUploadSession(id);
      else if(act === 'restore') await restoreUploadSession(id);
    });
  });
}

async function openUploadDetail(uploadId){
  const s = window.state.uploadSessions.find(x => x.id === uploadId);
  if(!s){ toast('Sesi tidak ditemukan', 'er'); return; }

  window.state.uploadDetailId = uploadId;
  window.state.uploadSelected = new Set();

  const el = document.getElementById('upl-list');
  if(!el) return;
  el.innerHTML = '<div class="mt" style="padding:20px;text-align:center">Memuat produk…</div>';

  let prods = [];
  try{
    const bcs = s.barcodes || [];
    for(let i = 0; i < bcs.length; i += 10){
      const chunk = bcs.slice(i, i + 10);
      const q = window.fb.query(
        window.fb.collection(window.fb.db, 'master'),
        window.fb.where('__name__', 'in', chunk)
      );
      const snap = await window.fb.getDocs(q);
      snap.forEach(d => prods.push({ id: d.id, ...d.data() }));
    }
  }catch(e){ console.error(e); }

  prods.sort((a, b) => String(a.nm || '').localeCompare(String(b.nm || '')));
  window.state.uploadDetailProducts = prods;

  const divOpts = (window.DEFAULT_DIVISIONS || []).map(d =>
    `<option value="${d.id}">${d.icon} ${d.name}</option>`
  ).join('');

  el.innerHTML = `
    <div class="cd">
      <button class="bt bs" id="upl-back" style="margin-bottom:14px;padding:9px">← Kembali ke Daftar</button>
      <h2>Upload #${s.index} — ${esc(s.filename || '')}</h2>
      <div class="mt">${fmtTime(s.uploadedAt)} · ${s.count} produk · oleh ${esc(s.uploadedByName || s.uploadedBy || '-')}</div>
    </div>

    <div class="cd" style="background:var(--bg);position:sticky;top:60px;z-index:20">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn-mini bp" id="upl-selall" style="padding:9px 14px">☑ Pilih Semua</button>
        <button class="btn-mini bs" id="upl-selnone" style="padding:9px 14px">☐ Batal Pilih</button>
        <span class="mt" id="upl-selcount" style="margin-left:auto">0 dipilih</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
        <select id="upl-move-div" style="flex:1;min-width:160px;padding:10px;border:1px solid var(--bd);border-radius:8px;font-family:inherit;font-size:14px;background:var(--sur);color:var(--tx)">
          ${divOpts}
        </select>
        <button class="btn-mini bp" id="upl-move-btn" style="padding:10px 16px">➡ Pindahkan</button>
      </div>
    </div>

    <div id="upl-products">
      ${prods.length === 0 ? '<div class="cd"><div class="em">Tidak ada produk.</div></div>' : prods.map(p => {
        const div = resolveDivision(p);
        const divInfo = getDivision(div);
        const isDeleted = p.deleted === true;
        return `<div class="li ${isDeleted ? 'e' : 'o'}" data-bc="${esc(p.bc)}" style="cursor:pointer">
          <input type="checkbox" class="upl-chk" data-bc="${esc(p.bc)}" style="width:20px;height:20px;margin-top:4px;accent-color:var(--pr);flex-shrink:0">
          <div class="lb2">
            <div class="ln">${esc(p.nm || '-')}</div>
            <div class="lm">${esc(p.bc || '-')}</div>
            <div class="lt">
              <span class="div-badge" style="background:${divInfo.bg};color:${divInfo.color}">${divInfo.icon} ${divInfo.name}</span>
              ${isDeleted ? '<span class="tg" style="background:#fee2e2;color:#991b1b">DIHAPUS</span>' : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;

  document.getElementById('upl-back').addEventListener('click', () => renderUploadsPage());

  const chks = el.querySelectorAll('.upl-chk');
  const updateCount = () => {
    const sc = document.getElementById('upl-selcount');
    if(sc) sc.textContent = window.state.uploadSelected.size + ' dipilih';
  };

  chks.forEach(chk => {
    chk.addEventListener('change', () => {
      const bc = chk.dataset.bc;
      if(chk.checked) window.state.uploadSelected.add(bc);
      else window.state.uploadSelected.delete(bc);
      updateCount();
    });
  });

  el.querySelectorAll('#upl-products .li[data-bc]').forEach(row => {
    row.addEventListener('click', (e) => {
      if(e.target.tagName === 'INPUT') return;
      const chk = row.querySelector('.upl-chk');
      if(chk){ chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
    });
  });

  document.getElementById('upl-selall').addEventListener('click', () => {
    chks.forEach(chk => { chk.checked = true; window.state.uploadSelected.add(chk.dataset.bc); });
    updateCount();
  });
  document.getElementById('upl-selnone').addEventListener('click', () => {
    chks.forEach(chk => { chk.checked = false; });
    window.state.uploadSelected.clear();
    updateCount();
  });

  document.getElementById('upl-move-btn').addEventListener('click', async () => {
    const divId = document.getElementById('upl-move-div').value;
    const selected = Array.from(window.state.uploadSelected);
    if(!selected.length){ toast('Pilih minimal 1 produk', 'er'); return; }
    const divInfo = getDivision(divId);
    const ok = window.dlg && dlg.confirm
      ? await dlg.confirm({
          title: 'Pindahkan Produk',
          message: `Pindahkan ${selected.length} produk ke ${divInfo.name}?`,
          okText: 'Ya, Pindahkan'
        })
      : confirm(`Pindahkan ${selected.length} produk ke ${divInfo.name}?`);
    if(!ok) return;

    const r = await moveProductsToDivision(selected, divId);
    if(r.error){ toast(r.error, 'er'); return; }
    toast(`${r.done} produk dipindah ke ${divInfo.name}`, 'ok');
    openUploadDetail(uploadId);
  });
}

async function moveProductsToDivision(barcodes, divId){
  const ids = (window.DEFAULT_DIVISIONS || []).map(d => d.id);
  if(!ids.includes(divId)) return { error: 'Divisi tidak valid' };
  if(!barcodes.length) return { error: 'Tidak ada produk' };

  const BATCH = 400;
  let done = 0, failed = 0;
  const now = new Date().toISOString();
  const me = window.state.currentUser;

  for(let i = 0; i < barcodes.length; i += BATCH){
    try{
      const batch = window.fb.writeBatch(window.fb.db);
      barcodes.slice(i, i + BATCH).forEach(bc => {
        const ref = window.fb.doc(window.fb.db, 'master', bc);
        batch.set(ref, {
          division: divId,
          divisionChangedAt: now,
          divisionChangedBy: me ? me.username : '-'
        }, { merge: true });
      });
      await batch.commit();
      done += Math.min(BATCH, barcodes.length - i);
    }catch(e){ console.error(e); failed += 1; }
  }

  if(typeof refreshMasterFromFS === 'function') await refreshMasterFromFS(true);
  return { ok: true, done, failed };
}

async function deleteUploadSession(uploadId){
  const s = window.state.uploadSessions.find(x => x.id === uploadId);
  if(!s){ toast('Sesi tidak ditemukan', 'er'); return; }

  const ok = window.dlg && dlg.confirm
    ? await dlg.confirm({
        title: 'Hapus Sesi Upload',
        message: `Hapus Upload #${s.index}?\n\n${s.count} produk akan ditandai terhapus. Bisa dipulihkan kembali.`,
        okText: 'Ya, Hapus', cancelText: 'Batal', danger: true
      })
    : confirm(`Hapus Upload #${s.index}?`);
  if(!ok) return;

  const bcs = s.barcodes || [];
  const now = new Date().toISOString();
  const me = window.state.currentUser;

  const BATCH = 400;
  let done = 0;
  for(let i = 0; i < bcs.length; i += BATCH){
    try{
      const batch = window.fb.writeBatch(window.fb.db);
      bcs.slice(i, i + BATCH).forEach(bc => {
        const ref = window.fb.doc(window.fb.db, 'master', bc);
        batch.set(ref, { deleted: true, deletedAt: now, deletedBy: me ? me.username : '-' }, { merge: true });
      });
      await batch.commit();
      done += Math.min(BATCH, bcs.length - i);
    }catch(e){ console.error(e); }
  }

  try{
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'master_uploads', uploadId),
      { status: 'deleted', deletedAt: now, deletedBy: me ? me.username : '-', deletedCount: done },
      { merge: true }
    );
  }catch(e){}

  if(typeof refreshMasterFromFS === 'function') await refreshMasterFromFS(true);
  toast(`Upload #${s.index} dihapus (${done} produk)`, 'ok');
  renderUploadsPage();
}

async function restoreUploadSession(uploadId){
  const s = window.state.uploadSessions.find(x => x.id === uploadId);
  if(!s) return;

  const ok = window.dlg && dlg.confirm
    ? await dlg.confirm({
        title: 'Pulihkan Sesi Upload',
        message: `Pulihkan Upload #${s.index}?\n\n${s.count} produk akan dikembalikan.`,
        okText: 'Ya, Pulihkan'
      })
    : confirm(`Pulihkan Upload #${s.index}?`);
  if(!ok) return;

  const bcs = s.barcodes || [];
  const now = new Date().toISOString();
  const BATCH = 400;
  let done = 0;

  for(let i = 0; i < bcs.length; i += BATCH){
    try{
      const batch = window.fb.writeBatch(window.fb.db);
      bcs.slice(i, i + BATCH).forEach(bc => {
        const ref = window.fb.doc(window.fb.db, 'master', bc);
        batch.set(ref, { deleted: false, restoredAt: now }, { merge: true });
      });
      await batch.commit();
      done += Math.min(BATCH, bcs.length - i);
    }catch(e){ console.error(e); }
  }

  try{
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'master_uploads', uploadId),
      { status: 'active', restoredAt: now },
      { merge: true }
    );
  }catch(e){}

  if(typeof refreshMasterFromFS === 'function') await refreshMasterFromFS(true);
  toast(`Upload #${s.index} dipulihkan (${done} produk)`, 'ok');
  renderUploadsPage();
}

async function uploadMasterFile(file){
  if(!file){ toast('Pilih file dulu', 'er'); return; }

  let text = '';
  try{ text = await file.text(); }catch(e){ toast('Gagal baca file', 'er'); return; }

  const rows = parseMasterJsText(text);
  if(!rows.length){ toast('Tidak ada produk di file', 'er'); return; }

  const msg = document.getElementById('upl-msg');
  if(msg){ msg.style.color = 'var(--mt)'; msg.textContent = `Memproses ${rows.length} produk…`; }

  const r = await startUploadSession(rows, { filename: file.name });

  if(r.error){
    if(msg){ msg.style.color = 'var(--dg)'; msg.textContent = r.error; }
    toast(r.error, 'er');
    return;
  }

  if(msg){
    msg.style.color = 'var(--ok)';
    msg.textContent = `✅ Upload #${r.index}: ${r.done} produk baru · ${r.skippedDup} duplikat dilewati`;
  }
  toast(`Upload #${r.index}: ${r.done} produk ditambahkan`, 'ok');

  if(typeof refreshMasterFromFS === 'function') await refreshMasterFromFS(true);
  renderUploadsPage();
}

function parseMasterJsText(text){
  const rows = [];
  const re = /\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*(\d+|null)\s*,\s*(\d+|null)\s*\]/g;
  let m;
  while((m = re.exec(text)) !== null){
    rows.push({
      bc: m[1], nm: m[2],
      patternCode: m[3] === 'null' ? 0 : parseInt(m[3]),
      returnH: m[4] === 'null' ? 0 : parseInt(m[4])
    });
  }
  return rows;
}

function bindUploadsEvents(){
  const fileInp = document.getElementById('upl-file');
  const fileBtn = document.getElementById('upl-file-btn');
  const refreshBtn = document.getElementById('upl-refresh');

  if(fileBtn && fileInp) fileBtn.addEventListener('click', () => fileInp.click());
  if(fileInp){
    fileInp.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if(!f) return;
      await uploadMasterFile(f);
      e.target.value = '';
    });
  }
  if(refreshBtn) refreshBtn.addEventListener('click', () => renderUploadsPage());
}

window.renderUploadsPage = renderUploadsPage;
window.startUploadSession = startUploadSession;
window.loadUploadSessions = loadUploadSessions;
window.openUploadDetail = openUploadDetail;
window.deleteUploadSession = deleteUploadSession;
window.restoreUploadSession = restoreUploadSession;
window.moveProductsToDivision = moveProductsToDivision;
window.uploadMasterFile = uploadMasterFile;
window.bindUploadsEvents = bindUploadsEvents;

console.log('✅ uploads.js loaded');
