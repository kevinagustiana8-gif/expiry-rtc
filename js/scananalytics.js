// ============================================================
// scananalytics.js — Tracking scan + Top Produk
// ============================================================

const SCAN_BATCH_KEY = 'expiry-scan-batch';
const SCAN_BATCH_SIZE = 50;

let scanFlushTimer = null;

async function recordScan(barcode, nm, division, source){
  const u = window.state.currentUser;
  if(!u) return;

  try{
    const batch = JSON.parse(localStorage.getItem(SCAN_BATCH_KEY) || '[]');
    batch.push({
      barcode: String(barcode),
      nm: nm || '',
      division: division || 'grocery',
      scannedAt: new Date().toISOString(),
      scannedBy: u.username,
      scannedByName: u.nama,
      role: u.role,
      source: source || 'unknown'
    });

    if(batch.length >= SCAN_BATCH_SIZE){
      await flushScanBatch();
    } else {
      localStorage.setItem(SCAN_BATCH_KEY, JSON.stringify(batch));
    }
  }catch(e){ console.warn('recordScan error:', e); }
}

async function flushScanBatch(){
  const batch = JSON.parse(localStorage.getItem(SCAN_BATCH_KEY) || '[]');
  if(!batch.length) return;
  if(!window.fbReady) return;

  try{
    const wb = window.fb.writeBatch(window.fb.db);
    batch.forEach(entry => {
      const ref = window.fb.doc(window.fb.collection(window.fb.db, 'scan_analytics'));
      wb.set(ref, entry);
    });
    await wb.commit();
    localStorage.setItem(SCAN_BATCH_KEY, '[]');
    console.log(`📤 Flush ${batch.length} scan events`);
  }catch(e){
    console.error('Flush batch error:', e);
  }
}

function startScanAutoFlush(){
  if(scanFlushTimer) clearInterval(scanFlushTimer);
  scanFlushTimer = setInterval(() => { flushScanBatch(); }, 5 * 60 * 1000);
}

window.addEventListener('beforeunload', () => { flushScanBatch(); });

async function loadTopScannedProducts(days, limit, division){
  days = days || 30;
  limit = limit || 30;
  division = division || 'all';

  if(!window.fbReady) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString();

  try{
    const q = window.fb.query(
      window.fb.collection(window.fb.db, 'scan_analytics'),
      window.fb.where('scannedAt', '>=', cutoffISO)
    );
    const snap = await window.fb.getDocs(q);
    const all = [];
    snap.forEach(d => all.push(d.data()));

    const filtered = division === 'all'
      ? all
      : all.filter(s => (s.division || 'grocery') === division);

    const counts = {};
    filtered.forEach(s => {
      const bc = s.barcode;
      if(!bc) return;
      if(!counts[bc]){
        counts[bc] = {
          barcode: bc, nm: s.nm,
          division: s.division || 'grocery',
          count: 0, lastScan: s.scannedAt,
          scannedBy: {}
        };
      }
      counts[bc].count++;
      if(s.scannedAt > counts[bc].lastScan) counts[bc].lastScan = s.scannedAt;
      const uname = s.scannedBy || '-';
      counts[bc].scannedBy[uname] = (counts[bc].scannedBy[uname] || 0) + 1;
    });

    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }catch(e){
    console.error('loadTopScannedProducts error:', e);
    return [];
  }
}

async function renderTopScannedPage(){
  if(!isManager() && !isOwner()) return;

  const el = document.getElementById('topscan-list');
  if(!el) return;

  el.innerHTML = '<div class="mt" style="padding:20px;text-align:center">Memuat data…</div>';

  const days = parseInt(document.getElementById('topscan-days')?.value || '30');
  const limit = parseInt(document.getElementById('topscan-limit')?.value || '30');
  const division = document.getElementById('topscan-div')?.value || 'all';

  const ranking = await loadTopScannedProducts(days, limit, division);

  if(!ranking.length){
    el.innerHTML = `<div class="cd"><div class="em" style="padding:30px 10px">
      <div class="ic">📊</div>
      <div>Belum ada data scan dalam ${days} hari terakhir.</div>
      <div class="mt" style="margin-top:8px">Data akan muncul setelah staff mulai scan produk.</div>
    </div></div>`;
    return;
  }

  const total = ranking.reduce((sum, r) => sum + r.count, 0);

  el.innerHTML = `
    <div class="cd">
      <h2>📈 Top ${ranking.length} Produk</h2>
      <div class="mt">Total ${total} scan dalam ${days} hari terakhir${division !== 'all' ? ' · ' + getDivision(division).name : ''}</div>
    </div>
    ${ranking.map((r, i) => {
      const divInfo = getDivision(r.division);
      const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const top3 = i < 3 ? 'border-left:4px solid var(--wr)' : '';
      const scanByList = Object.entries(r.scannedBy)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([u, c]) => `@${esc(u)} (${c})`)
        .join(', ');

      return `<div class="li o" style="${top3}">
        <div class="lb2">
          <div class="ln" style="font-size:15px">${rankIcon} ${esc(r.nm || '-')}</div>
          <div class="lm">${esc(r.barcode)}</div>
          <div class="lt">
            <span class="tg" style="background:#dcfce7;color:#166534;font-weight:700">📊 ${r.count}× scan</span>
            <span class="div-badge" style="background:${divInfo.bg};color:${divInfo.color}">${divInfo.icon} ${divInfo.name}</span>
          </div>
          <div class="mt" style="margin-top:6px;font-size:11px">Terakhir: ${fmtTime(r.lastScan)}</div>
          <div class="mt" style="font-size:11px">👥 ${scanByList}</div>
        </div>
      </div>`;
    }).join('')}
  `;
}

function bindTopScannedEvents(){
  ['topscan-days','topscan-limit','topscan-div'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', () => renderTopScannedPage());
  });
  const refreshBtn = document.getElementById('topscan-refresh');
  if(refreshBtn) refreshBtn.addEventListener('click', () => renderTopScannedPage());
}

window.recordScan = recordScan;
window.flushScanBatch = flushScanBatch;
window.startScanAutoFlush = startScanAutoFlush;
window.loadTopScannedProducts = loadTopScannedProducts;
window.renderTopScannedPage = renderTopScannedPage;
window.bindTopScannedEvents = bindTopScannedEvents;

console.log('✅ scananalytics.js loaded');
