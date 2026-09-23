// ============================================================
// dashboard.js — Halaman Dasbor, edit, hapus, quantity
// ============================================================

// ============ RENDER DASHBOARD ============
function renderDash(){
  const list = window.state.products.map(decorate);
  const today = todayISO();

  const urgent = list.filter(p => p.next && daysDiff(today, p.next.date) <= 3).length;
  const todayN = list.filter(p => p.todayEvents.length > 0).length;
  const weekN = list.filter(p => p.next && daysDiff(today, p.next.date) <= 7).length;
  const retN = list.filter(p => p.brand.ret !== null && p.brand.ret !== undefined).length;

  const dsum = document.getElementById('dsum');
  if(dsum){
    dsum.innerHTML = `
      <div class="si d"><span class="sn">${urgent}</span><span class="sl">Urgent ≤3 hari</span></div>
      <div class="si w"><span class="sn">${todayN}</span><span class="sl">Event Hari Ini</span></div>
      <div class="si w"><span class="sn">${weekN}</span><span class="sl">≤ 7 hari</span></div>
      <div class="si p"><span class="sn">${retN}</span><span class="sl">Ada RETURN</span></div>
    `;
  }

  const curFilter = window.state.curFilter;
  let filtered = list;
  if(curFilter === 'urgent'){
    filtered = list.filter(p => p.next && daysDiff(today, p.next.date) <= 3 && daysDiff(today, p.next.date) >= 0);
  } else if(curFilter === 'today'){
    filtered = list.filter(p => p.todayEvents.length > 0);
  } else if(curFilter === 'week'){
    filtered = list.filter(p => p.next && daysDiff(today, p.next.date) <= 7 && daysDiff(today, p.next.date) >= 0);
  } else if(curFilter === 'ret'){
    filtered = list.filter(p => p.brand.ret !== null && p.brand.ret !== undefined);
  } else if(curFilter === 'done'){
    filtered = list.filter(p => p.doneRtc > 0);
  }

  filtered.sort((a, b) => (a.next?.date || '9999').localeCompare(b.next?.date || '9999'));

  const el = document.getElementById('plist');
  if(!el) return;

  if(!filtered.length){
    el.innerHTML = `<div class="em"><div class="ic">📦</div><div>Belum ada produk.</div></div>`;
    return;
  }

  el.innerHTML = filtered.map(p => {
    let cls = 'o', stTxt = 'Aman';
    const hasTakeoutToday = p.todayEvents.some(e => e.type === 'takeout');
    const hasRetToday = p.todayEvents.some(e => e.type === 'ret');
    const hasRtc80EmpToday = p.todayEvents.some(e => e.type === 'rtc' && e.emp);

    if(p.expired){ cls = 'e'; stTxt = 'Kedaluwarsa'; }
    else if(hasTakeoutToday){ cls = 'h'; stTxt = 'Take Out Hari Ini'; }
    else if(hasRetToday){ cls = 'e'; stTxt = 'Return Hari Ini'; }
    else if(hasRtc80EmpToday){ cls = 'e'; stTxt = 'RTC 80% Karyawan'; }
    else if(p.next){
      const d = daysDiff(today, p.next.date);
      if(d === 0){ cls = 't'; stTxt = 'Hari ini'; }
      else if(d <= 3){ cls = 'e'; stTxt = `${d} hari`; }
      else if(d <= 7){ cls = 'w'; stTxt = `${d} hari`; }
      else { stTxt = `${d} hari`; }
    }

    const tags = [];
    if(p.next){
      if(p.next.type === 'rtc'){
        tags.push(`<span class="tg tg-p${p.next.pct}">${p.next.pct}%${p.next.emp ? ' (kar)' : ''} · H-${p.next.h}</span>`);
      } else if(p.next.type === 'takeout'){
        tags.push(`<span class="tg tg-to">TAKE OUT · H-${p.next.h}</span>`);
      } else if(p.next.type === 'ret'){
        tags.push(`<span class="tg tg-ret">RETURN · H-${p.next.h}</span>`);
      } else if(p.next.type === 'extra'){
        tags.push(`<span class="tg tg-p80">${p.next.pct}% manual</span>`);
      }
    }
    tags.push(`<span class="tg" style="background:var(--bg);color:var(--mt)">${stTxt}</span>`);
    if(p.totalRtc){
      tags.push(`<span class="tg" style="background:#ede9fe;color:#5b21b6">RTC ${p.doneRtc}/${p.totalRtc}</span>`);
    }
    if(p.quantity && p.quantity > 1){
      tags.push(`<span class="tg" style="background:#fef3c7;color:#92400e">Qty: ${p.quantity}</span>`);
    }

    return `<div class="li ${cls}" data-bc="${esc(p.bc)}">
      <div class="lb2">
        <div class="ln">${esc(p.nm)}</div>
        <div class="lm">${esc(p.barcode || barcodeFromId(p.bc))} · Exp ${fmtD(p.expiry)}</div>
        <div class="lt">${tags.join('')}</div>
      </div>
      <div class="usr-actions" style="flex-direction:column;gap:4px;align-items:stretch">
        <button class="usr-btn" data-action="edit" data-bc="${esc(p.bc)}" title="Edit">✏️</button>
        <button class="usr-btn danger" data-action="del" data-bc="${esc(p.bc)}" title="Hapus">🗑</button>
      </div>
    </div>`;
  }).join('');

  // Bind actions
  el.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bc = btn.dataset.bc;
      const action = btn.dataset.action;
      if(action === 'edit'){
        openProductEdit(bc);
      } else if(action === 'del'){
        confirmDeleteProduct(bc);
      }
    });
  });
}

// ============ BUKA MODAL EDIT PRODUK ============
function openProductEdit(bc){
  const p = window.state.products.find(x => x.bc === bc);
  if(!p){ toast('Produk tidak ditemukan', 'er'); return; }

  const body = document.getElementById('prod-modal-body');
  const title = document.getElementById('prod-modal-title');
  if(!body || !title) return;

  title.textContent = '✏️ Edit Produk';

  body.innerHTML = `
    <div class="mt" style="margin-bottom:14px;font-weight:600">
      ${esc(p.nm)} <br>
      <span style="font-family:monospace;font-size:11px">${esc(p.barcode || barcodeFromId(p.bc))}</span>
    </div>

    <div class="fr">
      <label for="pm-nm">Nama Produk <span class="rq">*</span></label>
      <input id="pm-nm" type="text" required value="${esc(p.nm || '')}">
    </div>

    <div class="fr">
      <label for="pm-exp">Tanggal Kedaluwarsa <span class="rq">*</span></label>
      <input id="pm-exp" type="date" required value="${esc(p.expiry || '')}">
    </div>

    <div class="fr">
      <label for="pm-qty">Quantity</label>
      <input id="pm-qty" type="number" min="1" value="${p.quantity || 1}">
    </div>

    <div class="cd" style="margin:14px 0;background:var(--bg)">
      <h2 style="font-size:14px;margin:0 0 4px">📅 Jadwal RTC</h2>
      <div class="mt" style="margin-bottom:10px">Centang yang sudah dijalankan.</div>
      <div id="pm-tl" class="tl"></div>
      <div class="mt" id="pm-hd"></div>
    </div>

    <div id="pm-err" class="mt" style="color:var(--dg)"></div>
  `;

  let applied = Array.isArray(p.applied) ? p.applied.slice() : [];
  let extraRtc = Array.isArray(p.extraRtc) ? p.extraRtc.slice() : [];
  let removedLevels = Array.isArray(p.removedLevels) ? p.removedLevels.slice() : [];
  let editedLevels = Object.assign({}, p.editedLevels || {});
  const expEl = document.getElementById('pm-exp');
  const tlEl = document.getElementById('pm-tl');
  const hdEl = document.getElementById('pm-hd');

    function drawEditTimeline(){
    const expiry = expEl.value;
    if(!expiry){
      tlEl.innerHTML = '<div class="mt">Isi tanggal kedaluwarsa dulu.</div>';
      hdEl.textContent = '';
      return;
    }

    const brand = brandOfProduct(p);
    const items = buildTimeline(brand, expiry, applied, extraRtc, removedLevels, editedLevels);

    // ⭐ Cek izin
    const myRole = window.state.currentUser ? window.state.currentUser.role : 'staff';
    const canEdit = ['admin', 'manager', 'owner'].includes(myRole);

    if(!items.length){
      tlEl.innerHTML = '<div class="mt">Tidak ada jadwal RTC untuk produk ini.</div>';
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
        } else if(it.type === 'takeout'){
          cls = 'takeout';
          lbl = 'TAKE OUT (tarik dari rak)';
          hint = it.h === 0 ? 'Hari H' : `H-${it.h}`;
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

        // Tombol inline-style (tidak tergantung CSS external)
        const isExtra = it.type === 'extra';
        const actionsHTML = (canEdit && !isExtra) ? `
          <div style="position:absolute;right:0;top:2px;display:flex;gap:4px;z-index:5">
            <button type="button" data-tl-act="edit" data-key="${it.key}"
              title="Ubah H-N"
              style="background:#fff;border:1px solid #ccc;border-radius:6px;padding:4px 8px;font-size:13px;line-height:1;cursor:pointer;color:#1f2937">✏️</button>
            <button type="button" data-tl-act="del" data-key="${it.key}"
              title="Hapus jadwal"
              style="background:#fff;border:1px solid #ef4444;border-radius:6px;padding:4px 8px;font-size:13px;line-height:1;cursor:pointer;color:#dc2626">🗑</button>
          </div>` : '';

        return `<div class="tli ${cls} ${it.done ? 'done' : ''}"
          style="position:relative;padding-right:70px">
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

    // Bind checkbox
    tlEl.querySelectorAll('.rtc-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const k = chk.dataset.key;
        if(chk.checked){
          if(!applied.includes(k)) applied.push(k);
        } else {
          applied = applied.filter(x => x !== k);
        }
        chk.closest('.tli').classList.toggle('done', chk.checked);
      });
    });

    // Bind edit/hapus
    tlEl.querySelectorAll('[data-tl-act]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const key = btn.dataset.key;
        const act = btn.dataset.tlAct;

        if(act === 'edit'){
          const currentItems = buildTimeline(brand, expEl.value, applied, extraRtc, removedLevels, editedLevels);
          const cur = currentItems.find(x => x.key === key);
          if(!cur) return;

          const newH = prompt(`Ubah jadwal "${key}"\n\nH-berapa sebelum kedaluwarsa?\n(sekarang: H-${cur.h})`, cur.h);
          if(newH === null) return;
          const hVal = parseInt(newH);
          if(isNaN(hVal) || hVal < 0 || hVal > 365){
            toast('Nilai harus 0-365', 'er');
            return;
          }
          editedLevels[key] = hVal;
          drawEditTimeline();
          toast(`Jadwal diubah ke H-${hVal}`, 'ok');

        } else if(act === 'del'){
          if(!confirm(`Hapus jadwal "${key}" dari produk ini?`)) return;
          if(!removedLevels.includes(key)) removedLevels.push(key);
          applied = applied.filter(x => x !== key);
          delete editedLevels[key];
          drawEditTimeline();
          toast('Jadwal dihapus', 'ok');
        }
      });
    });
  }

  expEl.addEventListener('input', drawEditTimeline);
  drawEditTimeline();

  // Simpan referensi ke window untuk dibaca saveProductEdit
  window._editProductBc = bc;
  window._editProductApplied = () => applied;
  window._editProductRemoved = () => removedLevels;
  window._editProductEdited = () => editedLevels;

  document.getElementById('prod-modal').classList.remove('hide');
}

// ============ SIMPAN EDIT PRODUK ============
async function saveProductEdit(){
  const bc = window._editProductBc;
  if(!bc) return;

  const p = window.state.products.find(x => x.bc === bc);
  if(!p){ toast('Produk tidak ditemukan', 'er'); return; }

  const nmV = document.getElementById('pm-nm').value.trim();
  const expV = document.getElementById('pm-exp').value;
  const qtyV = Math.max(1, +document.getElementById('pm-qty').value || 1);
  const err = document.getElementById('pm-err');

  if(!nmV){ err.textContent = 'Nama produk wajib'; return; }
  if(!expV){ err.textContent = 'Tanggal kedaluwarsa wajib'; return; }

  const applied = window._editProductApplied ? window._editProductApplied() : (p.applied || []);
  const removedLevels = window._editProductRemoved ? window._editProductRemoved() : (p.removedLevels || []);
  const editedLevels = window._editProductEdited ? window._editProductEdited() : (p.editedLevels || {});

  const updated = {
    ...p,
    nm: nmV,
    expiry: expV,
    quantity: qtyV,
    applied,
    removedLevels,
    editedLevels,
    updatedAt: new Date().toISOString(),
    updatedBy: window.state.currentUser ? (window.state.currentUser.username || '-') : '-'
  };

  // Update state lokal
  const idx = window.state.products.findIndex(x => x.bc === bc);
  if(idx >= 0) window.state.products[idx] = updated;
  saveProductsLocal();

  // Update Firestore
  await saveProductToFS(updated);

  toast('Produk diperbarui', 'ok');
  closeProductEdit();
  renderDash();
}

// ============ TUTUP MODAL EDIT ============
function closeProductEdit(){
  const modal = document.getElementById('prod-modal');
  if(modal) modal.classList.add('hide');
  window._editProductBc = null;
  window._editProductApplied = null;
  window._editProductRemoved = null;
  window._editProductEdited = null;
}

// ============ KONFIRMASI HAPUS PRODUK ============
async function confirmDeleteProduct(bc){
  const p = window.state.products.find(x => x.bc === bc);
  if(!p){ toast('Produk tidak ditemukan', 'er'); return; }

  if(!confirm(`Hapus produk ini?\n\n${p.nm}\nExp: ${fmtD(p.expiry)}\nQty: ${p.quantity || 1}\n\nTindakan ini tidak bisa dibatalkan.`)) return;

  // Hapus dari state lokal
  window.state.products = window.state.products.filter(x => x.bc !== bc);
  saveProductsLocal();

  // Hapus dari Firestore
  await deleteProductFromFS(bc);

  toast('Produk dihapus', 'ok');
  renderDash();
}

// ============ BIND CHIPS FILTER ============
function bindDashboardChips(){
  const chips = document.querySelectorAll('#chips .cp');
  chips.forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#chips .cp').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      window.state.curFilter = c.dataset.f;
      renderDash();
    });
  });
}

// ============ BIND MODAL EDIT ============
function bindProdModal(){
  const close = document.getElementById('prod-modal-close');
  const cancel = document.getElementById('prod-modal-cancel');
  const save = document.getElementById('prod-modal-save');
  const modal = document.getElementById('prod-modal');

  if(close) close.addEventListener('click', closeProductEdit);
  if(cancel) cancel.addEventListener('click', closeProductEdit);
  if(save) save.addEventListener('click', saveProductEdit);
  if(modal){
    modal.addEventListener('click', (e) => {
      if(e.target === modal) closeProductEdit();
    });
  }
}

// Expose
window.renderDash = renderDash;
window.openProductEdit = openProductEdit;
window.saveProductEdit = saveProductEdit;
window.closeProductEdit = closeProductEdit;
window.confirmDeleteProduct = confirmDeleteProduct;
window.bindDashboardChips = bindDashboardChips;
window.bindProdModal = bindProdModal;

console.log('✅ dashboard.js loaded');
