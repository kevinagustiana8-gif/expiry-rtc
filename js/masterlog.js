// ============================================================
// masterlog.js — Log penambahan produk master
// ============================================================

async function loadMasterLog(){
  if(!isManager() && !isOwner()) return;
  const el = document.getElementById('mlog-list');
  if(!el) return;

  el.innerHTML = '<div class="mt" style="padding:20px;text-align:center">Memuat…</div>';

  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'master_log'));
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

    window.state.masterLogCache = arr;
    renderMasterLogList(arr);

    const countEl = document.getElementById('mlog-count');
    if(countEl){
      const active = arr.filter(x => x.deleted !== true).length;
      countEl.textContent = `Total: ${active} log aktif · ${arr.length} total`;
    }
  }catch(e){
    console.error('Load master log error:', e);
    el.innerHTML = '<div class="cd"><div class="em">Gagal memuat log.</div></div>';
  }
}

function renderMasterLogList(list){
  const el = document.getElementById('mlog-list');
  if(!el) return;

  const active = list.filter(x => x.deleted !== true);

  if(!active.length){
    el.innerHTML = '<div class="cd"><div class="em" style="padding:30px 10px"><div class="ic">📝</div>Belum ada log.</div></div>';
    return;
  }

  // Group by date
  const groups = {};
  active.forEach(l => {
    const d = (l.timestamp || '').substring(0, 10);
    if(!groups[d]) groups[d] = [];
    groups[d].push(l);
  });

  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  el.innerHTML = dates.map(dt => {
    const items = groups[dt];
    return `<div class="cd">
      <h2 style="font-size:14px;margin:0 0 12px">📅 ${fmtDI(dt)} (${items.length})</h2>
      ${items.map(l => {
        const divInfo = getDivision(l.division || 'grocery');
        return `<div class="usr-item" style="align-items:flex-start">
          <div class="usr-info">
            <div class="usr-name">${esc(l.nm || '-')}</div>
            <div class="usr-meta">
              <span style="font-family:monospace">${esc(l.bc || '-')}</span>
              <span class="role-badge" style="background:${divInfo.bg};color:${divInfo.color}">${divInfo.icon} ${divInfo.name}</span>
            </div>
            <div class="mt" style="margin-top:4px">
              👤 ${esc(l.byName || l.by || '-')} (@${esc(l.by || '-')}) · ${(l.role || '').toUpperCase()}
            </div>
            <div class="mt">🕒 ${fmtTime(l.timestamp)}</div>
          </div>
          <div class="usr-actions">
            <button class="usr-btn danger" data-del-log="${esc(l.id)}" data-bc="${esc(l.bc)}" title="Hapus dari master">🗑</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  el.querySelectorAll('[data-del-log]').forEach(b => {
    b.addEventListener('click', async () => {
      const logId = b.dataset.delLog;
      const bc = b.dataset.bc;

      const ok = window.dlg && dlg.confirm
        ? await dlg.confirm({
            title: 'Hapus dari Master',
            message: `Hapus produk ini dari master?\n\nBarcode: ${bc}\n\nProduk akan hilang dari master, log tetap tercatat.`,
            okText: 'Ya, Hapus', danger: true
          })
        : confirm(`Hapus produk ${bc} dari master?`);
      if(!ok) return;

      const r = await deleteMasterFromLog(logId, bc);
      if(r.error){ toast(r.error, 'er'); return; }

      toast('Produk dihapus dari master', 'ok');
      loadMasterLog();
    });
  });
}

function bindMasterLogEvents(){
  const refreshBtn = document.getElementById('mlog-refresh');
  if(refreshBtn) refreshBtn.addEventListener('click', loadMasterLog);
}

window.loadMasterLog = loadMasterLog;
window.renderMasterLogList = renderMasterLogList;
window.bindMasterLogEvents = bindMasterLogEvents;

console.log('✅ masterlog.js loaded');
