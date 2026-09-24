// ============================================================
// logs.js — Log login (OPTIMIZED: manual refresh only)
// ============================================================

let logRealtimeUnsub = null;

async function loadLoginLogs(){
  if(!isAdmin()) return;
  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'login_log'));
    const all = [];
    snap.forEach(d => all.push({ id: d.id, ...d.data() }));

    const visible = all.filter(l => canSeeLog(l));
    visible.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

    window.state.logCache = visible;
    renderLogList(visible);

    const countEl = document.getElementById('log-count');
    if(countEl) countEl.textContent = `Total: ${visible.length} log`;
  }catch(e){
    console.error('Load logs error:', e);
    toast('Gagal memuat log', 'er');
  }
}

function startLogsRealtime(){
  console.log('ℹ️ Logs realtime disabled (hemat kuota)');
}
function stopLogsRealtime(){
  if(logRealtimeUnsub){ try{ logRealtimeUnsub(); }catch(e){} logRealtimeUnsub = null; }
}

function renderLogList(list){
  const el = document.getElementById('log-list');
  if(!el) return;
  if(!list.length){
    el.innerHTML = '<div class="cd"><div class="em" style="padding:24px 10px">Belum ada log.</div></div>';
    return;
  }
  const shown = list.slice(0, 200);
  el.innerHTML = `<div class="cd"><h2>Riwayat (${list.length}${list.length > 200 ? ', tampil 200' : ''})</h2>` +
    shown.map(l => {
      const roleCls = 'role-' + (l.role || 'staff');
      const online = isOnline(l.timestamp);
      return `<div class="usr-item">
        <div class="usr-avatar" style="position:relative">
          ${esc((l.nama || l.username || '?').charAt(0).toUpperCase())}
          <span class="online-dot ${online ? 'on' : ''}" style="position:absolute;bottom:2px;right:2px;border:2px solid var(--sur)"></span>
        </div>
        <div class="usr-info">
          <div class="usr-name">${esc(l.nama || '-')}</div>
          <div class="usr-meta">
            <span>@${esc(l.username || '-')}</span>
            <span class="role-badge ${roleCls}">${(l.role || 'staff').toUpperCase()}</span>
          </div>
          <div class="mt" style="margin-top:4px">
            🕒 ${fmtTime(l.timestamp)} · ${detectDevice(l.ua)}
            ${online ? ' · <span style="color:var(--ok);font-weight:600">🟢 Online</span>' : ''}
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
}

function filterLogs(){
  const q = (document.getElementById('log-search').value || '').trim().toLowerCase();
  if(!q){ renderLogList(window.state.logCache); return; }
  const filtered = window.state.logCache.filter(l =>
    String(l.username || '').toLowerCase().includes(q) ||
    String(l.nama || '').toLowerCase().includes(q)
  );
  renderLogList(filtered);
}

async function clearOldLogs(){
  if(!isOwner()){ toast('Hanya owner yang bisa hapus log', 'er'); return; }
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  if(!confirm('Hapus log lebih dari 30 hari ke belakang?')) return;

  let count = 0;
  for(const l of window.state.logCache){
    const t = new Date(l.timestamp || 0).getTime();
    if(t && t < cutoff){
      try{
        await window.fb.deleteDoc(window.fb.doc(window.fb.db, 'login_log', l.id));
        count++;
      }catch(e){}
    }
  }
  toast(`Dihapus ${count} log lama`, 'ok');
  loadLoginLogs();
}

function bindLogsEvents(){
  const searchBtn = document.getElementById('log-search-btn');
  const searchInput = document.getElementById('log-search');
  const refreshBtn = document.getElementById('log-refresh');
  const clearBtn = document.getElementById('log-clear');

  if(searchBtn) searchBtn.addEventListener('click', filterLogs);
  if(searchInput){
    searchInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); filterLogs(); }
    });
  }
  if(refreshBtn) refreshBtn.addEventListener('click', loadLoginLogs);
  if(clearBtn) clearBtn.addEventListener('click', clearOldLogs);
}

window.loadLoginLogs = loadLoginLogs;
window.startLogsRealtime = startLogsRealtime;
window.stopLogsRealtime = stopLogsRealtime;
window.renderLogList = renderLogList;
window.filterLogs = filterLogs;
window.clearOldLogs = clearOldLogs;
window.bindLogsEvents = bindLogsEvents;

console.log('✅ logs.js loaded (optimized)');
