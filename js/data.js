// ============================================================
// data.js — Master, timeline per divisi, products
// ============================================================

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
    ret: (returnH && returnH > 0) ? returnH : null
  };
}

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

async function refreshMasterFromFS(){
  if(!window.fbReady) return false;
  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'master'));
    if(snap.empty){ console.log('ℹ️ Master Firestore kosong, pakai file'); return false; }
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

// ============ TIMELINE PER DIVISI ============
function buildTimeline(brand, expiry, applied, extra, removedLevels, editedLevels, product){
  const items = [];
  applied = applied || [];
  extra = extra || [];
  removedLevels = removedLevels || [];
  editedLevels = editedLevels || {};
  if(!expiry) return items;

  product = product || {};
  const div = migrateDivision(product.division || 'grocery');
  const origin = product.origin || 'L';

  // === GROCERY: H-90 lokal / H-30 import ===
  if(div === 'grocery'){
    const h = origin === 'I' ? 30 : 90;
    items.push({ type:'rtc', pct:30, h, emp:false, key:'rtc30',
      date: addDays(expiry, -h), done: applied.includes('rtc30') });
    items.push({ type:'ret', h, key:'ret',
      date: addDays(expiry, -h), done: applied.includes('ret') });
  }
  // === PERISHABLE: H-1 saja ===
  else if(div === 'perishable'){
    items.push({ type:'rtc', pct:30, h:1, emp:false, key:'rtc30',
      date: addDays(expiry, -1), done: applied.includes('rtc30') });
    items.push({ type:'ret', h:1, key:'ret',
      date: addDays(expiry, -1), done: applied.includes('ret') });
  }
  // === DAILY & DAIRY: pakai Pola P ===
  else {
    (brand && brand.rtc ? brand.rtc : []).forEach(r => {
      const key = 'p' + r.pct;
      if(removedLevels.includes(key)) return;
      const hVal = editedLevels[key] !== undefined ? editedLevels[key] : r.h;
      if(hVal === 0 || hVal == null) return;
      items.push({
        type:'rtc', pct: r.pct, h: hVal, emp: !!r.emp, key,
        date: addDays(expiry, -hVal),
        done: applied.includes(key),
        edited: editedLevels[key] !== undefined
      });
    });
    if(brand && brand.ret > 0){
      const key = 'ret';
      if(!removedLevels.includes(key)){
        const hVal = editedLevels[key] !== undefined ? editedLevels[key] : brand.ret;
        if(hVal > 0){
          items.push({ type:'ret', h: hVal, key,
            date: addDays(expiry, -hVal),
            done: applied.includes(key) });
        }
      }
    }
  }

  // Extra RTC manual (semua divisi)
  extra.forEach((r, i) => {
    const date = r.date || addDays(expiry, -(+r.days || 0));
    if(date === expiry) return;
    items.push({
      type:'extra', pct: r.pct, key: 'ext' + i,
      date, done:false, note: r.note || '',
      days: r.date ? daysDiff(expiry, r.date) : (+r.days || 0)
    });
  });

  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}

function brandOfProduct(p){
  const m = window.state.byBc[p.bc];
  if(m && m.brand) return m.brand;
  if(p.patternCode !== undefined){
    return buildBrandFromPattern(p.nm, p.patternCode, p.returnH);
  }
  return buildBrandFromPattern(p.nm, 0, 0);
}

function decorate(p){
  const brand = brandOfProduct(p);
  const items = buildTimeline(brand, p.expiry, p.applied, p.extraRtc, p.removedLevels, p.editedLevels, p);
  const today = todayISO();
  const upcoming = items.filter(i => !i.done && daysDiff(today, i.date) >= 0);
  const next = upcoming[0] || null;
  const expired = daysDiff(today, p.expiry) < 0;
  const todayEvents = items.filter(i => i.date === today);
  const overdueItems = items.filter(i => !i.done && daysDiff(today, i.date) < 0);
  return {
    ...p,
    division: migrateDivision(p.division || detectDivision(p.nm)),
    brand, items, next, expired, todayEvents,
    overdueItems,
    hasOverdue: overdueItems.length > 0,
    totalRtc: items.length,
    doneRtc: items.filter(i => i.done).length
  };
}

async function loadProductsFromFS(){
  if(!window.fbReady) return false;
  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'products'));
    const arr = [];
    snap.forEach(d => arr.push({ ...d.data(), bc: d.id }));
    // Migrasi divisi lama
    arr.forEach(p => {
      if(p.division) p.division = migrateDivision(p.division);
      if(!p.division) p.division = detectDivision(p.nm);
    });
    window.state.products = arr;
    saveProductsLocal();
    console.log(`📥 Produk dari Firebase: ${arr.length}`);
    return true;
  }catch(e){
    console.error('loadProductsFromFS error:', e);
    return false;
  }
}

let fsUnsub = null;
function startRealtimeSync(){
  if(!window.fbReady || fsUnsub) return;
  try{
    fsUnsub = window.fb.onSnapshot(
      window.fb.collection(window.fb.db, 'products'),
      (snap) => {
        const arr = [];
        snap.forEach(d => arr.push({ ...d.data(), bc: d.id }));
        arr.forEach(p => {
          if(p.division) p.division = migrateDivision(p.division);
          if(!p.division) p.division = detectDivision(p.nm);
        });
        window.state.products = arr;
        saveProductsLocal();
        console.log(`🔄 Sync realtime: ${arr.length}`);
        if(window.state.curPage === 'dash' && typeof renderDash === 'function') renderDash();
        if(window.state.curPage === 'set'  && typeof renderSet  === 'function') renderSet();
      },
      (err) => console.error('Realtime error:', err)
    );
  }catch(e){ console.error('Sync setup error:', e); }
}
function stopRealtimeSync(){
  if(fsUnsub){ try{ fsUnsub(); }catch(e){} fsUnsub = null; }
}

async function saveProductToFS(p){
  if(!window.fbReady) return false;
  try{
    const { bc, ...data } = p;
    await window.fb.setDoc(window.fb.doc(window.fb.db, 'products', bc), data);
    return true;
  }catch(e){
    console.error('Save error:', e);
    toast('Gagal simpan ke server', 'er');
    return false;
  }
}

async function deleteProductFromFS(bc){
  if(!window.fbReady) return false;
  try{
    await window.fb.deleteDoc(window.fb.doc(window.fb.db, 'products', bc));
    return true;
  }catch(e){ console.error('Delete error:', e); return false; }
}

function generateProductId(barcode){
  const ts = Date.now();
  const rnd = Math.random().toString(36).substring(2, 8);
  return `${barcode}__${ts}__${rnd}`;
}
function barcodeFromId(id){
  if(!id) return '';
  return String(id).split('__')[0] || id;
}

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

function actionLabel(a){
  return a === 'diskon' ? 'Diskon'
       : a === 'return' ? 'Return'
       : a === 'musnah' ? 'Musnah'
       : a;
}

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
