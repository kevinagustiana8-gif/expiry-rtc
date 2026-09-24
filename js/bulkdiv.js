// ============================================================
// bulkdiv.js — Multi-select pindah divisi + pagination
// ============================================================

let bulkSelected = new Set();
let bulkFiltered = [];
let bulkPage = 0;
const BULK_PER_PAGE = 200;

function renderBulkDivisionPanel(){
  const listEl = document.getElementById('bulk-list');
  if(!listEl) return;

  const srcDiv = document.getElementById('bulk-src')?.value || 'all';
  const q = (document.getElementById('bulk-search')?.value || '').trim().toLowerCase();

  const all = Object.values(window.state.byBc);

  if(!all.length){
    listEl.innerHTML = '<div class="mt" style="text-align:center;padding:20px">Master kosong.</div>';
    updateBulkCount();
    return;
  }

  let filtered = all;

  if(srcDiv !== 'all'){
    filtered = filtered.filter(x => resolveDivision(x) === srcDiv);
  }
  if(q){
    filtered = filtered.filter(x =>
      String(x.nm || '').toLowerCase().includes(q) ||
      String(x.bc).includes(q)
    );
  }

  // ⭐ Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / BULK_PER_PAGE));
  if(bulkPage >= totalPages) bulkPage = totalPages - 1;
  if(bulkPage < 0) bulkPage = 0;
  const start = bulkPage * BULK_PER_PAGE;
  const shown = filtered.slice(start, start + BULK_PER_PAGE);
  bulkFiltered = shown.map(x => x.bc);

  if(!shown.length){
    listEl.innerHTML = '<div class="em" style="padding:20px 10px;font-size:13px">Tidak ada produk cocok.</div>';
    updateBulkCount();
    return;
  }

  const itemsHTML = shown.map(x => {
    const div = resolveDivision(x);
    const divInfo = getDivision(div);
    const checked = bulkSelected.has(x.bc) ? 'checked' : '';
    return `<label class="li" style="padding:10px;margin-bottom:6px;cursor:pointer;display:flex;gap:10px;align-items:flex-start">
      <input type="checkbox" class="bulk-chk" data-bc="${esc(x.bc)}" ${checked}
        style="width:18px;height:18px;margin-top:4px;accent-color:var(--pr);flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.nm)}</div>
        <div style="font-size:11px;color:var(--mt);font-family:monospace">${esc(x.bc)}</div>
        <div style="margin-top:4px">
          <span class="div-badge" style="background:${divInfo.bg};color:${divInfo.color}">${divInfo.icon} ${divInfo.name}</span>
        </div>
      </div>
    </label>`;
  }).join('');

  // ⭐ Pagination controls
  const paginationHTML = totalPages > 1 ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;padding:12px 4px 6px;border-top:1px solid var(--bd);margin-top:6px">
      <button class="btn-mini bs" data-bulk-page="prev" ${bulkPage === 0 ? 'disabled style="opacity:.4;cursor:not-allowed;padding:8px 14px"' : 'style="padding:8px 14px"'}>← Prev</button>
      <span style="font-size:12px;color:var(--mt);font-weight:600;padding:0 6px">
        Halaman ${bulkPage + 1} / ${totalPages}
        · ${start + 1}–${Math.min(start + BULK_PER_PAGE, filtered.length)} dari ${filtered.length}
      </span>
      <button class="btn-mini bs" data-bulk-page="next" ${bulkPage >= totalPages - 1 ? 'disabled style="opacity:.4;cursor:not-allowed;padding:8px 14px"' : 'style="padding:8px 14px"'}>Next →</button>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;width:100%;justify-content:center">
        ${Array.from({length: totalPages}).map((_, i) => {
          const active = i === bulkPage;
          return `<button class="btn-mini ${active ? 'bp' : 'bs'}" data-bulk-jump="${i}" style="padding:6px 10px;min-width:34px;font-size:11px">${i + 1}</button>`;
        }).join('')}
      </div>
    </div>
  ` : `
    <div class="mt" style="text-align:center;padding:8px;font-size:11px">
      Total ${filtered.length} produk
    </div>
  `;

  listEl.innerHTML = itemsHTML + paginationHTML;

  // Bind checkbox
  listEl.querySelectorAll('.bulk-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      const bc = chk.dataset.bc;
      if(chk.checked) bulkSelected.add(bc);
      else bulkSelected.delete(bc);
      updateBulkCount();
    });
  });

  // Bind pagination
  listEl.querySelectorAll('[data-bulk-page]').forEach(b => {
    b.addEventListener('click', () => {
      const dir = b.dataset.bulkPage;
      if(dir === 'prev' && bulkPage > 0) bulkPage--;
      else if(dir === 'next' && bulkPage < totalPages - 1) bulkPage++;
      renderBulkDivisionPanel();
      listEl.scrollTop = 0;
    });
  });

  listEl.querySelectorAll('[data-bulk-jump]').forEach(b => {
    b.addEventListener('click', () => {
      bulkPage = parseInt(b.dataset.bulkJump) || 0;
      renderBulkDivisionPanel();
      listEl.scrollTop = 0;
    });
  });

  updateBulkCount();
}

function updateBulkCount(){
  const el = document.getElementById('bulk-count');
  if(el) el.textContent = bulkSelected.size + ' dipilih';
}

async function applyBulkDivision(){
  const destEl = document.getElementById('bulk-dest');
  const msg = document.getElementById('bulk-msg');
  if(!destEl) return;

  const destDiv = destEl.value;
  if(!destDiv){ toast('Pilih divisi tujuan', 'er'); return; }
  if(!bulkSelected.size){ toast('Pilih minimal 1 produk', 'er'); return; }

  const list = Array.from(bulkSelected);
  const divInfo = getDivision(destDiv);

  const ok = window.dlg && dlg.confirm
    ? await dlg.confirm({
        title: 'Konfirmasi',
        message: `Pindahkan ${list.length} produk ke divisi ${divInfo.name}?`,
        okText: 'Ya, Pindahkan'
      })
    : confirm(`Pindahkan ${list.length} produk ke ${divInfo.name}?`);
  if(!ok) return;

  if(msg){ msg.style.color = 'var(--mt)'; msg.textContent = `Memproses ${list.length} produk...`; }

  try{
    const BATCH = 400;
    let done = 0;
    const now = new Date().toISOString();
    const me = window.state.currentUser;

    for(let i = 0; i < list.length; i += BATCH){
      const batch = window.fb.writeBatch(window.fb.db);
      list.slice(i, i + BATCH).forEach(bc => {
        const ref = window.fb.doc(window.fb.db, 'master', bc);
        batch.set(ref, {
          division: destDiv,
          divisionChangedAt: now,
          divisionChangedBy: me ? me.username : '-'
        }, { merge: true });
      });
      await batch.commit();
      done += Math.min(BATCH, list.length - i);
    }

    list.forEach(bc => {
      const m = window.state.byBc[bc];
      if(m) m.division = destDiv;
    });
    if(typeof refreshMasterFromFS === 'function') await refreshMasterFromFS();

    if(msg){ msg.style.color = 'var(--ok)'; msg.textContent = `✅ ${done} produk dipindah ke ${divInfo.name}`; }
    toast(`${done} produk dipindah ke ${divInfo.name}`, 'ok');

    bulkSelected.clear();
    renderBulkDivisionPanel();

    if(window.state.curPage === 'dash' && typeof renderDash === 'function') renderDash();
  }catch(e){
    console.error('Bulk move error:', e);
    if(msg){ msg.style.color = 'var(--dg)'; msg.textContent = 'Gagal: ' + e.message; }
    toast('Gagal: ' + e.message, 'er');
  }
}

function bindBulkDivEvents(){
  const srcEl     = document.getElementById('bulk-src');
  const searchEl  = document.getElementById('bulk-search');
  const selAllBtn = document.getElementById('bulk-select-all');
  const clearBtn  = document.getElementById('bulk-clear');
  const applyBtn  = document.getElementById('bulk-apply');

  if(srcEl){
    srcEl.addEventListener('change', () => { bulkPage = 0; renderBulkDivisionPanel(); });
  }
  if(searchEl){
    searchEl.addEventListener('input', debounce(() => { bulkPage = 0; renderBulkDivisionPanel(); }, 250));
  }
  if(selAllBtn){
    selAllBtn.addEventListener('click', () => {
      // ⭐ Pilih semua di halaman yang sedang tampil
      bulkFiltered.forEach(bc => bulkSelected.add(bc));
      renderBulkDivisionPanel();
      toast(`${bulkFiltered.length} produk dipilih`, 'ok');
    });
  }
  if(clearBtn){
    clearBtn.addEventListener('click', () => {
      bulkSelected.clear();
      renderBulkDivisionPanel();
    });
  }
  if(applyBtn){
    applyBtn.addEventListener('click', applyBulkDivision);
  }
}

window.renderBulkDivisionPanel = renderBulkDivisionPanel;
window.applyBulkDivision = applyBulkDivision;
window.bindBulkDivEvents = bindBulkDivEvents;

console.log('✅ bulkdiv.js loaded');
