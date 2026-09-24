// ============================================================
// masterprod.js — Halaman Master Produk
// ============================================================

// ============ FILL PATTERN DROPDOWN ============
function fillPatternDropdown(){
  const sel = document.getElementById('mst-new-pattern');
  if(!sel || sel.options.length > 0) return;
  const P = window.P || {};
  Object.keys(P).forEach(k => {
    const code = parseInt(k);
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `Pola ${code}: ${patternLabel(code)}`;
    sel.appendChild(opt);
  });
}

// ============ LOAD MASTER DARI FIRESTORE ============
async function loadMasterFromFirestore(){
  if(window.state.masterLoaded) return window.state.masterCache;
  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'master')
    );
    window.state.masterCache = [];
    snap.forEach(d => {
      const data = d.data();
      if(data.deleted === true) return;
      window.state.masterCache.push({ id: d.id, ...data });
    });
    window.state.masterCache.sort((a, b) =>
      String(a.nm || '').localeCompare(String(b.nm || ''))
    );
    window.state.masterLoaded = true;
    console.log(`📚 Master dari Firebase: ${window.state.masterCache.length}`);
    return window.state.masterCache;
  }catch(e){
    console.error('Load master error:', e);
    toast('Gagal memuat master', 'er');
    return [];
  }
}

// ============ LOAD MASTER PAGE ============
async function loadMasterPage(){
  if(!isAdmin()) return;
  fillPatternDropdown();
  const list = await loadMasterFromFirestore();
  const countEl = document.getElementById('mst-count');
  if(countEl) countEl.textContent = `Total: ${list.length} produk`;

  const kw = document.getElementById('mst-search').value.trim();
  if(kw) doMasterSearch();
  else {
    const res = document.getElementById('mst-results');
    if(res) res.innerHTML = '';
  }
}

// ============ RENDER LIST ============
function renderMasterList(list, keyword){
  const el = document.getElementById('mst-results');
  if(!el) return;

  if(!list.length){
    el.innerHTML = '<div class="cd"><div class="em" style="padding:24px 10px">📭 Tidak ada produk cocok.</div></div>';
    return;
  }

  const shown = list.slice(0, 100);
  const title = keyword
    ? `Hasil untuk "${esc(keyword)}" (${list.length}${list.length > 100 ? ', tampil 100' : ''})`
    : `Semua produk (${list.length}${list.length > 100 ? ', tampil 100' : ''})`;

  el.innerHTML = `<div class="cd"><h2>${title}</h2>` +
    shown.map(m => {
      let patLabel;
      if(Array.isArray(m.customRtc) && m.customRtc.length){
        const pcts = [30, 50, 70, 80, 90];
        const parts = [];
        m.customRtc.forEach((h, i) => { if(h != null) parts.push(`${pcts[i]}%@H-${h}`); });
        patLabel = parts.join(' → ') || '(tanpa RTC)';
      } else {
        patLabel = patternLabel(m.patternCode || 0);
      }
      const retLabel = (m.returnH && m.returnH > 0) ? `Return H-${m.returnH}` : 'Tanpa return';
      return `<div class="usr-item" style="align-items:flex-start">
        <div class="usr-info">
          <div class="usr-name">${esc(m.nm || '-')}</div>
          <div class="usr-meta" style="margin-bottom:6px">
            <span style="font-family:monospace">${esc(m.bc)}</span>
          </div>
          <div class="mt" style="margin-bottom:2px">${patLabel}</div>
          <div class="mt">${retLabel}</div>
        </div>
        <div class="usr-actions">
          <button class="usr-btn" data-edit="${esc(m.bc)}" title="Edit RTC">✏️</button>
          <button class="usr-btn danger" data-del="${esc(m.bc)}" title="Hapus">🗑</button>
        </div>
      </div>`;
    }).join('') + '</div>';

  el.querySelectorAll('[data-edit]').forEach(b => {
    b.addEventListener('click', () => openMasterEdit(b.dataset.edit));
  });

  el.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', () => deleteMasterProduct(b.dataset.del));
  });
}

// ============ SEARCH ============
function doMasterSearch(){
  const q = (document.getElementById('mst-search').value || '').trim().toLowerCase();
  if(!q){
    const res = document.getElementById('mst-results');
    if(res) res.innerHTML = '';
    return;
  }
  const filtered = window.state.masterCache.filter(m =>
    String(m.bc || '').toLowerCase().includes(q) ||
    String(m.nm || '').toLowerCase().includes(q)
  );
  renderMasterList(filtered, q);
}

// ============ TAMBAH PRODUK ============
async function addMasterProduct(){
  const bc = document.getElementById('mst-new-bc').value.trim();
  const nm = document.getElementById('mst-new-nm').value.trim();
  const patternCode = parseInt(document.getElementById('mst-new-pattern').value);
  const returnH = parseInt(document.getElementById('mst-new-ret').value);
  const msg = document.getElementById('mst-add-msg');

  msg.style.color = 'var(--dg)';
  if(!bc){ msg.textContent = 'Barcode wajib diisi'; return; }
  if(!nm){ msg.textContent = 'Nama produk wajib diisi'; return; }
  if(window.state.masterCache.some(x => x.bc === bc)){
    msg.textContent = 'Barcode sudah ada di master';
    return;
  }

  try{
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'master', bc),
      {
        bc, nm, patternCode, returnH,
        createdAt: new Date().toISOString(),
        updatedBy: window.state.currentUser ? window.state.currentUser.username : '-'
      }
    );

    window.state.masterCache.push({ bc, nm, patternCode, returnH });
    window.state.masterCache.sort((a, b) =>
      String(a.nm || '').localeCompare(String(b.nm || ''))
    );

    msg.style.color = 'var(--ok)';
    msg.textContent = `✅ ${nm} ditambahkan ke master`;
    document.getElementById('mst-new-bc').value = '';
    document.getElementById('mst-new-nm').value = '';

    await refreshMasterFromFS(true);
    const countEl = document.getElementById('mst-count');
    if(countEl) countEl.textContent = `Total: ${window.state.masterCache.length} produk`;
    doMasterSearch();
  }catch(e){
    msg.textContent = 'Gagal: ' + e.message;
  }
}

// ============ EDIT RTC MASTER (MODAL) ============
let currentEditBc = null;

function openMasterEdit(bc){
  const m = window.state.masterCache.find(x => x.bc === bc);
  if(!m) return;
  currentEditBc = bc;

  document.getElementById('rtc-modal-product').textContent = `${m.nm} — ${m.bc}`;

  let cr = m.customRtc;
  if(!Array.isArray(cr)){
    const pat = (window.P && window.P[m.patternCode]) || [];
    cr = [pat[0], pat[1], pat[2], pat[3], null];
  }

  document.getElementById('rtc-30').value = cr[0] != null ? cr[0] : '';
  document.getElementById('rtc-50').value = cr[1] != null ? cr[1] : '';
  document.getElementById('rtc-70').value = cr[2] != null ? cr[2] : '';
  document.getElementById('rtc-80').value = cr[3] != null ? cr[3] : '';
  document.getElementById('rtc-90').value = cr[4] != null ? cr[4] : '';
  document.getElementById('rtc-ret').value = m.returnH || 0;
  document.getElementById('rtc-pattern').value = '';
  document.getElementById('rtc-modal-msg').textContent = '';

  document.getElementById('rtc-modal').classList.remove('hide');
}

function closeRtcModal(){
  document.getElementById('rtc-modal').classList.add('hide');
  currentEditBc = null;
}

async function saveMasterEdit(){
  if(!currentEditBc) return;
  const msg = document.getElementById('rtc-modal-msg');
  msg.style.color = 'var(--dg)';

  const patSel = document.getElementById('rtc-pattern').value;
  let update = {};

  if(patSel !== ''){
    update.patternCode = parseInt(patSel);
    update.customRtc = [];
  } else {
    const g = id => {
      const v = document.getElementById(id).value.trim();
      return v === '' ? null : parseInt(v);
    };
    const h30 = g('rtc-30'), h50 = g('rtc-50'), h70 = g('rtc-70'), h80 = g('rtc-80'), h90 = g('rtc-90');
    const ret = parseInt(document.getElementById('rtc-ret').value) || 0;

    if([h30, h50, h70, h80, h90].every(v => v === null)){
      msg.textContent = 'Isi minimal 1 level diskon atau pilih pola standar';
      return;
    }

    update.customRtc = [h30, h50, h70, h80, h90];
    update.returnH = ret;
    update.patternCode = 0;
  }

  update.updatedAt = new Date().toISOString();
  update.updatedBy = window.state.currentUser ? window.state.currentUser.username : '-';

  try{
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'master', currentEditBc),
      update,
      { merge: true }
    );

    const m = window.state.masterCache.find(x => x.bc === currentEditBc);
    if(m) Object.assign(m, update);

    await refreshMasterFromFS(true);
    toast('RTC tersimpan. Berlaku untuk semua staf.', 'ok');
    closeRtcModal();
    doMasterSearch();
  }catch(e){
    msg.textContent = 'Gagal: ' + e.message;
  }
}

// ============ HAPUS PRODUK MASTER ============
async function deleteMasterProduct(bc){
  const m = window.state.masterCache.find(x => x.bc === bc);
  const nama = m ? m.nm : bc;
  const isOwnerRole = window.state.currentUser && window.state.currentUser.role === 'owner';

  const confirmMsg = isOwnerRole
    ? `Hapus "${nama}" dari master?\n\nAnda OWNER — tanpa batasan harian.`
    : `Hapus "${nama}" dari master?\n\n⚠️ Sebagai ADMIN, hanya 1 produk per hari.`;

  if(!confirm(confirmMsg)) return;

  const today = todayISO();

  try{
    if(!isOwnerRole){
      const logRef = window.fb.doc(window.fb.db, 'deletion_log', today);
      const snap = await window.fb.getDoc(logRef);
      let count = 0, items = [];
      if(snap.exists()){
        const d = snap.data();
        count = d.count || 0;
        items = d.items || [];
      }
      if(count >= 1){
        toast('Admin hanya bisa hapus 1 produk/hari.', 'er');
        return;
      }
      await window.fb.setDoc(logRef, {
        count: count + 1,
        items: [...items, bc],
        deletedBy: window.state.currentUser ? window.state.currentUser.username : '-',
        deletedAt: new Date().toISOString()
      }, { merge: true });
    }

    await window.fb.deleteDoc(window.fb.doc(window.fb.db, 'master', bc));
    window.state.masterCache = window.state.masterCache.filter(x => x.bc !== bc);
    await refreshMasterFromFS(true);
    toast('Produk dihapus dari master', 'ok');
    doMasterSearch();

    const countEl = document.getElementById('mst-count');
    if(countEl) countEl.textContent = `Total: ${window.state.masterCache.length} produk`;
  }catch(e){
    toast('Gagal hapus: ' + e.message, 'er');
  }
}

// ============ BIND EVENTS ============
function bindMasterEvents(){
  const searchBtn = document.getElementById('mst-search-btn');
  const searchInput = document.getElementById('mst-search');
  const addBtn = document.getElementById('mst-add-btn');
  const toggleAdd = document.getElementById('mst-toggle-add');
  const rtcClose = document.getElementById('rtc-modal-close');
  const rtcCancel = document.getElementById('rtc-modal-cancel');
  const rtcSave = document.getElementById('rtc-modal-save');
  const rtcModal = document.getElementById('rtc-modal');

  if(searchBtn) searchBtn.addEventListener('click', doMasterSearch);
  if(searchInput){
    searchInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); doMasterSearch(); }
    });
  }
  if(addBtn) addBtn.addEventListener('click', addMasterProduct);

  if(toggleAdd){
    toggleAdd.addEventListener('click', () => {
      const f = document.getElementById('mst-add-form');
      const i = document.getElementById('mst-toggle-add-icon');
      f.classList.toggle('hide');
      i.textContent = f.classList.contains('hide') ? 'buka ▾' : 'tutup ▴';
    });
  }

  if(rtcClose) rtcClose.addEventListener('click', closeRtcModal);
  if(rtcCancel) rtcCancel.addEventListener('click', closeRtcModal);
  if(rtcSave) rtcSave.addEventListener('click', saveMasterEdit);
  if(rtcModal){
    rtcModal.addEventListener('click', (e) => {
      if(e.target === rtcModal) closeRtcModal();
    });
  }
}

// Expose
window.fillPatternDropdown = fillPatternDropdown;
window.loadMasterFromFirestore = loadMasterFromFirestore;
window.loadMasterPage = loadMasterPage;
window.renderMasterList = renderMasterList;
window.doMasterSearch = doMasterSearch;
window.addMasterProduct = addMasterProduct;
window.openMasterEdit = openMasterEdit;
window.closeRtcModal = closeRtcModal;
window.saveMasterEdit = saveMasterEdit;
window.deleteMasterProduct = deleteMasterProduct;
window.bindMasterEvents = bindMasterEvents;

console.log('✅ masterprod.js loaded');
