// ============================================================
// scan.js — Scanner barcode, autocomplete, form hasil scan
// ============================================================

let qr = null;
let running = false;
let lastCode = null;
let lastTime = 0;
let torchOn = false;

async function startScan(){
  if(running) return;
  if(typeof Html5Qrcode === 'undefined'){ toast('Library scanner tidak dimuat', 'er'); return; }

  if(!qr){
    qr = new Html5Qrcode('reader', {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF, Html5QrcodeSupportedFormats.QR_CODE
      ],
      verbose: false
    });
  }

  try{
    await qr.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: (w, h) => {
          const s = Math.min(w * 0.85, 320);
          return { width: Math.floor(s), height: Math.floor(s * 0.55) };
        },
        aspectRatio: 1.0,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      },
      onScanSuccess, () => {}
    );
    running = true;
    show('bstop'); hide('bstart');
    try{
      const caps = qr.getRunningTrackCapabilities?.();
      if(caps && 'torch' in caps) show('btorch');
    }catch(e){}
  }catch(e){
    console.error('Start scan error:', e);
    toast('Kamera tidak bisa diakses. Perlu HTTPS.', 'er');
  }
}

async function stopScan(){
  if(!qr || !running) return;
  try{ await qr.stop(); await qr.clear(); }catch(e){}
  running = false; torchOn = false;
  show('bstart'); hide('bstop'); hide('btorch');
}

async function toggleTorch(){
  try{
    torchOn = !torchOn;
    await qr.applyVideoConstraints({ advanced: [{ torch: torchOn }] });
    const btn = document.getElementById('btorch');
    if(btn) btn.textContent = torchOn ? '🔦 Matikan' : '🔦 Senter';
  }catch(e){ toast('Senter tidak didukung', 'er'); }
}

function onScanSuccess(decodedText){
  const now = Date.now();
  if(decodedText === lastCode && (now - lastTime) < 2000) return;
  lastCode = decodedText;
  lastTime = now;
  beep(); vib(80);
  stopScan();

  const code = decodedText.trim();
  const master = window.state.byBc[code];
  const existing = window.state.products.filter(p => (p.barcode || barcodeFromId(p.bc)) === code);
  renderScanResult({ bc: code, master, existing });
}

function renderScanResult({ bc, master, existing }){
  const box = document.getElementById('sr');
  if(!box) return;
  existing = existing || [];

  const u = window.state.currentUser;
  const myDiv = canSwitchDivision()
    ? (window.state.activeDivision === 'all' ? 'grocery' : window.state.activeDivision)
    : (u?.division || 'grocery');

  const nm = master ? master.nm : '';
  const detectedDiv = myDiv;
  const detectedOrigin = detectOrigin(bc);

  box.classList.remove('hide');
  box.innerHTML = `
    <div class="hr">
      <div class="bc">${esc(bc)}</div>
      <div class="nm">${esc(nm || 'Produk Baru')}</div>
      <div class="src">${existing.length ? `✅ ${existing.length} entri sudah ada` : (master ? '📦 Ditemukan di master' : '⚠️ Tidak ada di master')}</div>
    </div>

    ${existing.length ? `
      <div class="cd" style="background:var(--bg);border-color:var(--wr)">
        <h2 style="font-size:14px;margin:0 0 8px">📦 Entri Sebelumnya</h2>
        ${existing.map(p => `
          <div style="padding:8px 0;border-bottom:1px solid var(--bd)">
            <div style="font-weight:600;font-size:13px">${esc(p.nm || '-')}</div>
            <div class="mt">Exp: ${fmtD(p.expiry)} · Qty: ${p.quantity || 1}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <form id="pf" class="cd">
      <h2 style="font-size:15px;margin:0 0 12px">➕ ${existing.length ? 'Tambah Entri Baru' : 'Input Produk'}</h2>

      <div class="fr"><label for="fnm">Nama Produk <span class="rq">*</span></label>
        <input id="fnm" required value="${esc(nm)}" placeholder="Nama produk"></div>

      <div class="fr"><label for="fdiv">Divisi</label>
        <select id="fdiv">
          ${DEFAULT_DIVISIONS.map(d =>
            `<option value="${d.id}" ${d.id === detectedDiv ? 'selected' : ''}>${d.icon} ${d.name}</option>`
          ).join('')}
        </select></div>

      <div class="fr" id="forigin-wrap" style="${detectedDiv === 'grocery' ? '' : 'display:none'}">
        <label for="forigin">Asal Produk (khusus Grocery)</label>
        <select id="forigin">
          <option value="L" ${detectedOrigin === 'L' ? 'selected' : ''}>🇮🇩 Lokal (RTC/Return H-90)</option>
          <option value="I" ${detectedOrigin === 'I' ? 'selected' : ''}>🌏 Import (RTC/Return H-30)</option>
        </select>
      </div>

      <div class="fr"><label for="fex">Tanggal Kedaluwarsa <span class="rq">*</span></label>
        <input id="fex" type="date" required value="${addDays(todayISO(), 30)}"></div>

      <div class="fr"><label for="fqty">Quantity <span class="rq">*</span></label>
        <input id="fqty" type="number" min="1" value="1" required>
        <small>Jumlah produk dengan tanggal expired ini</small></div>

      <div class="cd" style="margin:14px 0;background:var(--bg)">
        <h2 style="font-size:14px;margin:0 0 4px">📅 Jadwal RTC & Return</h2>
        <div class="mt" style="margin-bottom:10px">Centang yang sudah dijalankan.</div>
        <div id="tl" class="tl"></div>
        <div class="mt" id="hd"></div>
        <div class="ext-list" id="extlist"></div>
        <div class="br" style="margin-top:12px">
          <button type="button" class="btn-mini bp" id="baddrtc" style="flex:1">➕ Tambah RTC Manual</button>
        </div>
        <div id="rtcform" class="hide" style="margin-top:12px;background:var(--sur);padding:12px;border-radius:10px;border:1px solid var(--bd)">
          <div class="fr" style="margin-bottom:10px">
            <label for="rtcpct">Persentase Diskon (%)</label>
            <input id="rtcpct" type="number" min="1" max="100" value="85"></div>
          <div class="fr" style="margin-bottom:10px">
            <label for="rtcmode">Jadwal</label>
            <select id="rtcmode">
              <option value="h">H-N sebelum kedaluwarsa</option>
              <option value="date">Tanggal spesifik</option>
            </select></div>
          <div class="fr" id="rtcHwrap" style="margin-bottom:10px">
            <label for="rtchari">Berapa hari sebelum</label>
            <input id="rtchari" type="number" min="0" max="365" value="1"></div>
          <div class="fr hide" id="rtcDwrap" style="margin-bottom:10px">
            <label for="rtcdate">Tanggal</label>
            <input id="rtcdate" type="date"></div>
          <div class="fr" style="margin-bottom:10px">
            <label for="rtcnote">Catatan (opsional)</label>
            <input id="rtcnote" type="text"></div>
          <div class="br">
            <button type="button" class="bt bp" id="rtcsave" style="padding:10px">Simpan</button>
            <button type="button" class="bt bs" id="rtccancel" style="padding:10px">Batal</button>
          </div>
        </div>
      </div>

      <div id="ferr" class="mt" style="color:var(--dg)"></div>
      <div class="br">
        <button type="submit" class="bt bp">💾 Simpan Produk</button>
        <button type="button" class="bt bs" id="bcancel">Batal</button>
      </div>
    </form>
  `;

  let applied = [];
  let extraRtc = [];
  let removedLevels = [];
  let editedLevels = {};
  let curDiv = detectedDiv;
  let curOrigin = detectedOrigin;

  const expEl = document.getElementById('fex');
  const divEl = document.getElementById('fdiv');
  const originEl = document.getElementById('forigin');
  const originWrap = document.getElementById('forigin-wrap');
  const tlEl = document.getElementById('tl');
  const hdEl = document.getElementById('hd');
  const extEl = document.getElementById('extlist');

  divEl.addEventListener('change', () => {
    curDiv = divEl.value;
    originWrap.style.display = curDiv === 'grocery' ? '' : 'none';
    drawTimeline();
  });
  originEl.addEventListener('change', () => {
    curOrigin = originEl.value;
    drawTimeline();
  });

  function drawTimeline(){
    const expiry = expEl.value;
    if(!expiry){
      tlEl.innerHTML = '<div class="mt">Isi tanggal kedaluwarsa dulu.</div>';
      hdEl.textContent = '';
      return;
    }

    const brand = master ? master.brand : buildBrandFromPattern(document.getElementById('fnm').value, 0, 0);
    const fakeProduct = { division: curDiv, origin: curOrigin };
    const items = buildTimeline(brand, expiry, applied, extraRtc, removedLevels, editedLevels, fakeProduct);

    if(!items.length){
      tlEl.innerHTML = '<div class="mt">Tidak ada jadwal untuk divisi ini.</div>';
    } else {
      tlEl.innerHTML = items.map(it => {
        const diff = daysDiff(todayISO(), it.date);
        let st = 'pa', stT = 'Terlewat';
        if(diff > 0){ st = 'nw'; stT = `Dalam ${diff} hari`; }
        else if(diff === 0){ st = 'ac'; stT = 'Hari ini'; }
        else if(diff >= -3){ st = 'ac'; stT = `${-diff} hari lalu`; }
        else { st = 'ur'; stT = `Terlewat ${-diff} hari`; }

        let cls = 'takeout', lbl = '', hint = '';
        if(it.type === 'rtc'){
          cls = 'p' + it.pct;
          lbl = `Diskon ${it.pct}%${it.emp ? ' <span class="badge-emp">KARYAWAN</span>' : ''}`;
          hint = `H-${it.h} sebelum kedaluwarsa`;
        } else if(it.type === 'ret'){
          cls = 'ret';
          lbl = 'RETURN ke supplier';
          hint = `H-${it.h}`;
        } else if(it.type === 'extra'){
          cls = 'p' + Math.min(80, it.pct);
          lbl = `Diskon ${it.pct}% (manual)`;
          hint = it.days >= 0 ? `H-${it.days}` : 'tanggal spesifik';
        }

        const editBadge = it.edited ? '<span class="edited-badge">DIEDIT</span>' : '';
        const isExtra = it.type === 'extra';
        const actionsHTML = !isExtra ? `
          <div style="position:absolute;right:0;top:2px;display:flex;gap:4px;z-index:5">
            <button type="button" data-tl-act="edit" data-key="${it.key}"
              style="background:#fff;border:1px solid #ccc;border-radius:6px;padding:4px 8px;font-size:13px;cursor:pointer;color:#1f2937">✏️</button>
            <button type="button" data-tl-act="del" data-key="${it.key}"
              style="background:#fff;border:1px solid #ef4444;border-radius:6px;padding:4px 8px;font-size:13px;cursor:pointer;color:#dc2626">🗑</button>
          </div>` : '';

        return `<div class="tli ${cls} ${it.done ? 'done' : ''}" style="position:relative;padding-right:70px">
          ${actionsHTML}
          <label class="rtc-row">
            <input type="checkbox" class="rtc-chk" data-key="${it.key}" ${it.done ? 'checked' : ''}>
            <div style="flex:1">
              <div class="lb">${lbl}${editBadge}</div>
              <div class="vl">${fmtDI(it.date)}</div>
              <div class="dt">${hint}${it.note ? ' · ' + esc(it.note) : ''}</div>
              <span class="st ${st}">${stT}</span>
            </div>
          </label>
        </div>`;
      }).join('');
    }

    const expDiff = daysDiff(todayISO(), expiry);
    hdEl.textContent = `Kedaluwarsa: ${fmtDI(expiry)} (${expDiff >= 0 ? 'dalam ' + expDiff + ' hari' : 'terlewat ' + (-expDiff) + ' hari'})`;

    if(!extraRtc.length){ extEl.innerHTML = ''; }
    else {
      extEl.innerHTML = `<div class="mt" style="margin-bottom:8px;font-weight:600">RTC Tambahan (${extraRtc.length})</div>` +
        extraRtc.map((r, i) => {
          const dt = r.date ? r.date : (expiry ? addDays(expiry, -(+r.days || 0)) : '');
          const label = r.date ? `Tanggal ${fmtDI(r.date)}` : `H-${r.days} (${dt ? fmtDI(dt) : '—'})`;
          return `<div class="ext-item">
            <div class="info">
              <div class="ttl">Diskon ${r.pct}%</div>
              <div class="sub">${label}${r.note ? ' · ' + esc(r.note) : ''}</div>
            </div>
            <button type="button" class="del" data-rm="${i}">✕</button>
          </div>`;
        }).join('');
      extEl.querySelectorAll('[data-rm]').forEach(b => {
        b.addEventListener('click', () => { extraRtc.splice(+b.dataset.rm, 1); drawTimeline(); });
      });
    }

    tlEl.querySelectorAll('.rtc-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const k = chk.dataset.key;
        if(chk.checked){ if(!applied.includes(k)) applied.push(k); }
        else { applied = applied.filter(x => x !== k); }
        chk.closest('.tli').classList.toggle('done', chk.checked);
      });
    });

    tlEl.querySelectorAll('[data-tl-act]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const key = btn.dataset.key;
        const act = btn.dataset.tlAct;
        if(act === 'edit'){
          const cur = buildTimeline(brand, expEl.value, applied, extraRtc, removedLevels, editedLevels, fakeProduct).find(x => x.key === key);
          if(!cur) return;
          const newH = prompt(`Ubah jadwal "${key}"\n\nH-berapa?\n(sekarang: H-${cur.h})`, cur.h);
          if(newH === null) return;
          const hVal = parseInt(newH);
          if(isNaN(hVal) || hVal < 0 || hVal > 365){ toast('Nilai 0-365', 'er'); return; }
          editedLevels[key] = hVal;
          drawTimeline();
        } else if(act === 'del'){
          if(!confirm(`Hapus jadwal "${key}"?`)) return;
          if(!removedLevels.includes(key)) removedLevels.push(key);
          applied = applied.filter(x => x !== key);
          delete editedLevels[key];
          drawTimeline();
        }
      });
    });
  }

  expEl.addEventListener('input', drawTimeline);
  drawTimeline();

  const rtcForm = document.getElementById('rtcform');
  const rtcMode = document.getElementById('rtcmode');
  const rtcH = document.getElementById('rtcHwrap');
  const rtcD = document.getElementById('rtcDwrap');

  document.getElementById('baddrtc').addEventListener('click', () => {
    rtcForm.classList.toggle('hide');
    if(!rtcForm.classList.contains('hide')){
      document.getElementById('rtcdate').value = expEl.value || todayISO();
    }
  });
  rtcMode.addEventListener('change', () => {
    const isH = rtcMode.value === 'h';
    rtcH.classList.toggle('hide', !isH);
    rtcD.classList.toggle('hide', isH);
  });
  document.getElementById('rtccancel').addEventListener('click', () => rtcForm.classList.add('hide'));
  document.getElementById('rtcsave').addEventListener('click', () => {
    const pct = Math.max(1, Math.min(100, +document.getElementById('rtcpct').value || 0));
    const note = document.getElementById('rtcnote').value.trim();
    if(rtcMode.value === 'h'){
      const hari = Math.max(0, +document.getElementById('rtchari').value || 0);
      extraRtc.push({ pct, days: hari, note });
    } else {
      const date = document.getElementById('rtcdate').value;
      if(!date){ toast('Pilih tanggal dulu', 'er'); return; }
      extraRtc.push({ pct, date, note });
    }
    document.getElementById('rtcnote').value = '';
    rtcForm.classList.add('hide');
    drawTimeline();
  });

  document.getElementById('bcancel').addEventListener('click', () => {
    box.classList.add('hide'); box.innerHTML = ''; lastCode = null;
  });

  document.getElementById('pf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nmV = document.getElementById('fnm').value.trim();
    const expV = document.getElementById('fex').value;
    const qty = Math.max(1, +document.getElementById('fqty').value || 1);
    if(!nmV){ document.getElementById('ferr').textContent = 'Nama produk wajib'; return; }
    if(!expV){ document.getElementById('ferr').textContent = 'Tanggal kedaluwarsa wajib'; return; }

    const fresh = window.state.byName[nmV.toLowerCase()] || null;
    const pcode = fresh ? fresh.brand.key.replace('p', '') * 1 : 0;
    const retH = fresh && fresh.brand.ret ? fresh.brand.ret : 0;

    const newId = generateProductId(bc);
    const rec = {
      bc: newId, barcode: bc, nm: nmV,
      division: curDiv,
      origin: curDiv === 'grocery' ? curOrigin : null,
      patternCode: pcode, returnH: retH,
      expiry: expV, quantity: qty,
      applied, extraRtc, removedLevels, editedLevels,
      scannedBy: u?.username || 'unknown',
      scannedByName: u?.nama || '-',
      savedAt: new Date().toISOString()
    };

    window.state.products.push(rec);
    saveProductsLocal();
    await saveProductToFS(rec);

    toast('Produk disimpan', 'ok');
    box.classList.add('hide'); box.innerHTML = ''; lastCode = null;
    if(typeof goTo === 'function') goTo('dash');
  });

  setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function renderManualSuggestions(query){
  const el = document.getElementById('mbi-suggestions');
  if(!el) return;

  if(!query || query.length < 2){
    el.classList.add('hide'); el.innerHTML = '';
    return;
  }

  const q = query.toLowerCase();
  const all = Object.values(window.state.byBc);
  const u = window.state.currentUser;

  const visible = all.filter(x => {
    if(canSwitchDivision()){
      const active = window.state.activeDivision || 'all';
      if(active === 'all') return true;
      return resolveDivision(x) === active;
    }
    return resolveDivision(x) === (u?.division || 'grocery');
  });

  const matches = visible
    .filter(x => x.nm.toLowerCase().includes(q) || String(x.bc).includes(q))
    .slice(0, 15);

  if(!matches.length){
    el.innerHTML = '<div class="suggestion" style="color:var(--mt)">Tidak ada produk cocok</div>';
    el.classList.remove('hide');
    return;
  }

  el.innerHTML = matches.map(m => `
    <div class="suggestion" data-bc="${esc(m.bc)}" tabindex="0">
      <div class="s-name">${esc(m.nm)}</div>
      <div class="s-bc">${esc(m.bc)}</div>
    </div>
  `).join('');

  el.classList.remove('hide');

  el.querySelectorAll('.suggestion[data-bc]').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const bc = item.dataset.bc;
      const master = window.state.byBc[bc];
      if(master){
        const inp = document.getElementById('mbi');
        if(inp) inp.value = '';
        el.classList.add('hide');
        el.innerHTML = '';
        const existing = window.state.products.filter(p => (p.barcode || barcodeFromId(p.bc)) === bc);
        renderScanResult({ bc, master, existing });
      }
    });
  });
}

function bindScanEvents(){
  const bstart = document.getElementById('bstart');
  const bstop = document.getElementById('bstop');
  const btorch = document.getElementById('btorch');
  const mbi = document.getElementById('mbi');

  if(bstart) bstart.addEventListener('click', startScan);
  if(bstop) bstop.addEventListener('click', stopScan);
  if(btorch) btorch.addEventListener('click', toggleTorch);

  if(mbi){
    const handler = debounce((e) => renderManualSuggestions(e.target.value.trim()), 200);
    mbi.addEventListener('input', handler);
    mbi.addEventListener('blur', () => {
      setTimeout(() => {
        if(document.activeElement === mbi) return;
        const el = document.getElementById('mbi-suggestions');
        if(el) el.classList.add('hide');
      }, 300);
    });
    mbi.addEventListener('focus', () => {
      const v = mbi.value.trim();
      if(v.length >= 2) renderManualSuggestions(v);
    });
    mbi.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') e.preventDefault();
      if(e.key === 'Escape'){
        const el = document.getElementById('mbi-suggestions');
        if(el) el.classList.add('hide');
      }
    });
  }
}

window.startScan = startScan;
window.stopScan = stopScan;
window.toggleTorch = toggleTorch;
window.renderScanResult = renderScanResult;
window.bindScanEvents = bindScanEvents;
window.renderManualSuggestions = renderManualSuggestions;

console.log('✅ scan.js loaded');
