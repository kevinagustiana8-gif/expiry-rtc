// ============================================================
// data.js — Master data, timeline, products
// ============================================================

// ============ BRAND DARI PATTERN ============
function buildBrandFromPattern(nama, patternCode, returnH, customRtc){
  let rtc = null;
  if(Array.isArray(customRtc) && customRtc.length){
    rtc = [];
    const pcts = [30, 50, 70, 80, 90];
    for(let i = 0; i < customRtc.length; i++){
      if(customRtc[i] == null) continue;
      rtc.push({ pct: pcts[i], h: customRtc[i], emp: pcts[i] >= 80 });
    }
  } else {
    const arr = window.P && window.P[patternCode];
    if(arr){
      rtc = [];
      const pcts = [30, 50, 70, 80];
      for(let i = 0; i < arr.length; i++){
        if(arr[i] == null) continue;
        rtc.push({ pct: pcts[i], h: arr[i], emp: pcts[i] === 80 });
      }
    }
  }
  return {
    key: Array.isArray(customRtc) ? 'custom' : 'p' + patternCode,
    cat: '',
    rtc,
    takeout: 0,
    ret: (returnH && returnH > 0) ? returnH : null
  };
}

// ============ LOAD MASTER DARI FILE (master.js) ============
function loadMasterFromFile(){
  const M = window.MASTER || [];
  window.state.byBc = {};
  window.state.byName = {};
  M.forEach(row => {
    const [bc, nm, pcode, retH] = row;
    const brand = buildBrandFromPattern(nm, pcode || 0, retH || 0);
    const entry = { bc, nm, brand, _src: 'file' };
    window.state.byBc[bc] = entry;
    window.state.byName[String(nm).toLowerCase()] = entry;
  });
  console.log(`📚 Master file: ${Object.keys(window.state.byBc).length} produk`);
}

// ============ REFRESH MASTER DARI FIRESTORE ============
async function refreshMasterFromFS(){
  if(!window.fbReady) return false;
  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'master')
    );
    if(snap.empty){
      console.log('ℹ️ Master Firestore kosong, pakai file');
      return false;
    }
    const newByBc = {}, newByName = {};
    snap.forEach(d => {
      const data = d.data();
      if(!data.bc) return;
      const brand = buildBrandFromPattern(data.nm, data.patternCode || 0, data.returnH || 0, data.customRtc);
      const entry = { bc: data.bc, nm: data.nm, brand, _src: 'fs' };
      newByBc[data.bc] = entry;
      newByName[String(data.nm).toLowerCase()] = entry;
    });
    window.state.byBc = newByBc;
    window.state.byName = newByName;
    console.log(`✅ Master Firestore: ${Object.keys(newByBc).length} produk`);
    return true;
  }catch(e){
    console.error('refreshMasterFromFS error:', e);
    return false;
  }
}

// ============ TIMELINE BUILDER (support removed & edited) ============
function buildTimeline(brand, expiry, applied, extra, removedLevels, editedLevels){
  const items = [];
  applied = applied || [];
  extra = extra || [];
  removedLevels = removedLevels || [];
  editedLevels = editedLevels || {};
  if(!brand || !expiry) return items;

  // --- RTC levels ---
  (brand.rtc || []).forEach(r => {
    const key = 'p' + r.pct;
    // Skip kalau sudah dihapus admin
    if(removedLevels.includes(key)) return;
    // Pakai H-N edit kalau ada, kalau tidak pakai default
    const hVal = editedLevels[key] !== undefined ? editedLevels[key] : r.h;
    items.push({
      type: 'rtc', pct: r.pct, h: hVal, emp: !!r.emp, key,
      date: addDays(expiry, -hVal),
      done: applied.includes(key),
      edited: editedLevels[key] !== undefined
    });
  });

  // --- Take out ---
  if(brand.takeout !== null && brand.takeout !== undefined){
    const key = 'takeout';
    if(!removedLevels.includes(key)){
      const hVal = editedLevels[key] !== undefined ? editedLevels[key] : brand.takeout;
      items.push({
        type: 'takeout', h: hVal, key,
        date: addDays(expiry, -hVal),
        done: applied.includes(key),
        edited: editedLevels[key] !== undefined
      });
    }
  }

  // --- Return ---
  if(brand.ret !== null && brand.ret !== undefined){
    const key = 'ret';
    if(!removedLevels.includes(key)){
      const hVal = editedLevels[key] !== undefined ? editedLevels[key] : brand.ret;
      items.push({
        type: 'ret', h: hVal, key,
        date: addDays(expiry, -hVal),
        done: applied.includes(key),
        edited: editedLevels[key] !== undefined
      });
    }
  }

  // --- RTC manual (extra) ---
  extra.forEach((r, i) => {
    const date = r.date || addDays(expiry, -(+r.days || 0));
    items.push({
      type: 'extra', pct: r.pct, key: 'ext' + i,
      date, done: false, note: r.note || '',
      days: r.date ? daysDiff(expiry, r.date) : (+r.days || 0)
    });
  });

  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}

// ============ DAPATKAN BRAND DARI PRODUK ============
function brandOfProduct(p){
  const m = window.state.byBc[p.bc];
  if(m && m.brand) return m.brand;
  if(p.patternCode !== undefined){
    return buildBrandFromPattern(p.nm, p.patternCode, p.returnH);
  }
  return buildBrandFromPattern(p.nm, 0, 0);
}

// ============ DECORATE PRODUK ============
function decorate(p){
  const brand = brandOfProduct(p);
  const items = buildTimeline(
    brand,
    p.expiry,
    p.applied,
    p.extraRtc,
    p.removedLevels,
    p.editedLevels
  );
  const today = todayISO();
  const upcoming = items.filter(i => !i.done && daysDiff(today, i.date) >= 0);
  const next = upcoming[0] || null;
  const expired = daysDiff(today, p.expiry) < 0;
  const todayEvents = items.filter(i => i.date === today);
  return {
    ...p,
    brand, items, next, expired, todayEvents,
    totalRtc: items.length,
    doneRtc: items.filter(i => i.done).length
  };
}

// ============ LOAD PRODUCTS DARI FIRESTORE ============
async function loadProductsFromFS(){
  if(!window.fbReady) return false;
  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'products')
    );
    const arr = [];
    snap.forEach(d => arr.push({ ...d.data(), bc: d.id }));
    window.state.products = arr;
    saveProductsLocal();
    console.log(`📥 Produk dari Firebase: ${arr.length}`);
    return true;
  }catch(e){
    console.error('loadProductsFromFS error:', e);
    return false;
  }
}

// ============ REALTIME SYNC PRODUK ============
let fsUnsub = null;

function startRealtimeSync(){
  if(!window.fbReady || fsUnsub) return;
  try{
    fsUnsub = window.fb.onSnapshot(
      window.fb.collection(window.fb.db, 'products'),
      (snap) => {
        const arr = [];
        snap.forEach(d => arr.push({ ...d.data(), bc: d.id }));
        window.state.products = arr;
        saveProductsLocal();
        console.log(`🔄 Sync realtime: ${arr.length}`);
        if(window.state.curPage === 'dash' && typeof renderDash === 'function') renderDash();
        if(window.state.curPage === 'set' && typeof renderSet === 'function') renderSet();
      },
      (err) => console.error('Realtime error:', err)
    );
  }catch(e){
    console.error('Sync setup error:', e);
  }
}

function stopRealtimeSync(){
  if(fsUnsub){
    try{ fsUnsub(); }catch(e){}
    fsUnsub = null;
  }
}

// ============ SIMPAN PRODUK KE FIRESTORE ============
async function saveProductToFS(p){
  if(!window.fbReady) return false;
  try{
    const { bc, ...data } = p;
    await window.fb.setDoc(
      window.fb.doc(window.fb.db, 'products', bc),
      data
    );
    console.log(`💾 Tersimpan: ${bc}`);
    return true;
  }catch(e){
    console.error('Save error:', e);
    toast('Gagal simpan ke server', 'er');
    return false;
  }
}

// ============ HAPUS PRODUK DARI FIRESTORE ============
async function deleteProductFromFS(bc){
  if(!window.fbReady) return false;
  try{
    await window.fb.deleteDoc(window.fb.doc(window.fb.db, 'products', bc));
    console.log(`🗑️ Dihapus: ${bc}`);
    return true;
  }catch(e){
    console.error('Delete error:', e);
    return false;
  }
}

// ============ GENERATE PRODUCT ID ============
function generateProductId(barcode){
  const ts = Date.now();
  const rnd = Math.random().toString(36).substring(2, 8);
  return `${barcode}__${ts}__${rnd}`;
}

// Extract barcode dari ID
function barcodeFromId(id){
  if(!id) return '';
  const parts = String(id).split('__');
  return parts[0] || id;
}

// ============ PATTERN LABEL ============
function patternLabel(code){
  const arr = window.P && window.P[code];
  if(!arr) return '(tanpa RTC)';
  const pcts = [30, 50, 70, 80];
  const parts = [];
  for(let i = 0; i < arr.length; i++){
    if(arr[i] == null) continue;
    parts.push(`${pcts[i]}%@H-${arr[i]}`);
  }
  return parts.join(' → ') || '(kosong)';
}

// ============ ACTION LABEL ============
function actionLabel(a){
  return a === 'diskon' ? 'Diskon'
       : a === 'return' ? 'Return'
       : a === 'musnah' ? 'Musnah'
       : a;
}

// ============ EXPOSE ============
window.buildBrandFromPattern = buildBrandFromPattern;
window.loadMasterFromFile = loadMasterFromFile;
window.refreshMasterFromFS = refreshMasterFromFS;
window.buildTimeline = buildTimeline;
window.brandOfProduct = brandOfProduct;
window.decorate = decorate;
window.loadProductsFromFS = loadProductsFromFS;
window.startRealtimeSync = startRealtimeSync;
window.stopRealtimeSync = stopRealtimeSync;
window.saveProductToFS = saveProductToFS;
window.deleteProductFromFS = deleteProductFromFS;
window.generateProductId = generateProductId;
window.barcodeFromId = barcodeFromId;
window.patternLabel = patternLabel;
window.actionLabel = actionLabel;

console.log('✅ data.js loaded');
