// ============================================================
// data.js — Master per-divisi (hemat kuota) + cache
// ============================================================

const MASTER_CACHE_PREFIX = 'expiry-master-cache-';
const MASTER_CACHE_TTL = 4 * 60 * 60 * 1000;

window.state.loadedDivisions = window.state.loadedDivisions || {};

function invalidateMasterCache(divId){
  try{
    if(divId){
      localStorage.removeItem(MASTER_CACHE_PREFIX + divId);
      localStorage.removeItem(MASTER_CACHE_PREFIX + divId + '-at');
    } else {
      Object.keys(localStorage).forEach(k => {
        if(k.startsWith(MASTER_CACHE_PREFIX)) localStorage.removeItem(k);
      });
    }
  }catch(e){}
}

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
    cat: '', rtc,
    ret: (returnH && returnH > 0) ? returnH : null
  };
}

function loadMasterFromFile(){ /* deprecated */ }

function getEffectiveDivisions(){
  const u = window.state.currentUser;
  if(!u) return [];
  if(u.role === 'staff' || u.role === 'admin'){
    return [u.division || 'grocery'];
  }
  const active = window.state.activeDivision;
  if(!active || active === 'all') return [u.division || 'grocery'];
  return [active];
}

async function loadMasterDivision(divId, force){
  if(!divId) return { byBc: {}, byName: {} };

  if(!force){
    try{
      const cached = localStorage.getItem(MASTER_CACHE_PREFIX + divId);
      const cachedAt = parseInt(localStorage.getItem(MASTER_CACHE_PREFIX + divId + '-at') || '0');
      if(cached && (Date.now() - cachedAt) < MASTER_CACHE_TTL){
        const data = JSON.parse(cached);
        if(data && data.byBc){
          console.log(`📚 Master ${divId} dari cache (${Object.keys(data.byBc).length})`);
          return data;
        }
      }
    }catch(e){}
  }

  if(!window.fbReady) return { byBc: {}, byName: {} };

  try{
    const snap = await window.fb.getDocs(
      window.fb.query(
        window.fb.collection(window.fb.db, 'master'),
        window.fb.where('division', '==', divId)
      )
    );

    const byBc = {}, byName = {};
    snap.forEach(d => {
      const data = d.data();
      if(!data.bc) return;
      if(data.deleted === true) return;
      const brand = buildBrandFromPattern(data.nm, data.patternCode || 0, data.returnH || 0, data.customRtc);
      const entry = {
        bc: data.bc, nm: data.nm, brand,
        division: data.division || divId,
        origin: data.origin || null,
        _src: 'fs'
      };
      byBc[data.bc] = entry;
      byName[String(data.nm).toLowerCase()] = entry;
    });

    try{
      localStorage.setItem(MASTER_CACHE_PREFIX + divId, JSON.stringify({ byBc, byName }));
      localStorage.setItem(MASTER_CACHE_PREFIX + divId + '-at', String(Date.now()));
    }catch(e){}

    console.log(`✅ Master ${divId}: ${Object.keys(byBc).length} produk`);
    return { byBc, byName };
  }catch(e){
    console.error(`Load master ${divId} error:`, e);
    return { byBc: {}, byName: {} };
  }
}

async function refreshMasterFromFS(force){
  const u = window.state.currentUser;
  if(!u) return false;

  const divs = getEffectiveDivisions();
  if(!divs.length) return false;

  const mergedByBc = {};
  const mergedByName = {};

  for(const divId of divs){
    const result = await loadMasterDivision(divId, force);
    Object.assign(mergedByBc, result.byBc);
    Object.assign(mergedByName, result.byName);
    window.state.loadedDivisions[divId] = result;
  }

  window.state.byBc = mergedByBc;
  window.state.byName = mergedByName;
  console.log(`✅ Master loaded: ${Object.keys(mergedByBc).length} produk (${divs.join(', ')})`);
  return true;
}

async function getMasterByBarcode(bc){
  if(!bc) return null;
  if(window.state.byBc[bc]) return window.state.byBc[bc];
  if(!window.fbReady) return null;

  try{
    const snap = await window.fb.getDoc(window.fb.doc(window.fb.db, 'master', String(bc)));
    if(!snap.exists()) return null;
    const data = snap.data();
    if(data.deleted === true) return null;
    const brand = buildBrandFromPattern(data.nm, data.patternCode || 0, data.returnH || 0, data.customRtc);
    const entry = {
      bc: data.bc, nm: data.nm, brand,
      division: data.division || null,
      origin: data.origin || null,
      _src: 'fs-query'
    };
    window.state.byBc[bc] = entry;
    return entry;
  }catch(e){
    console.warn('getMasterByBarcode error:', e);
    return null;
  }
}

function resolveDivision(p){
  if(!p) return 'grocery';
  const validIds = (window.DEFAULT_DIVISIONS || []).map(d => d.id);
  if(p.division && validIds.includes(p.division)) return p.division;
  if(p.bc){
    const m = window.state.byBc[p.bc];
    if(m && m.division && validIds.includes(m.division)) return m.division;
  }
  const u = window.state && window.state.currentUser;
  if(u && (u.role === 'staff' || u.role === 'admin') && u.division && validIds.includes(u.division)){
    return u.division;
  }
  return 'grocery';
}

function buildTimeline(brand, expiry, applied, extra, removedLevels, editedLevels, product){
  const items = [];
  applied = applied || [];
  extra = extra || [];
  removedLevels = removedLevels || [];
  editedLevels = editedLevels || {};
  if(!expiry) return items;

  product = product || {};
  const div = resolveDivision(product);
  const origin = product.origin || 'L';

  if(div === 'grocery'){
    const h = origin === 'I' ? 30 : 90;
    items.push({ type:'rtc', pct:30, h, emp:false, key:'rtc30', date: addDays(expiry, -h), done: applied.includes('rtc30') });
    items.push({ type:'ret', h, key:'ret', date: addDays(expiry, -h), done: applied.includes('ret') });
  }
  else if(div === 'perishable'){
    items.push({ type:'rtc', pct:30, h:1, emp:false, key:'rtc30', date: addDays(expiry, -1), done: applied.includes('rtc30') });
    items.push({ type:'ret', h:1, key:'ret', date: addDays(expiry, -1), done: applied.includes('ret') });
  }
  else {
    (brand && brand.rtc ? brand.rtc : []).forEach(r => {
      const key = 'p' + r.pct;
      if(removedLevels.includes(key)) return;
      const hVal = editedLevels[key] !== undefined ? editedLevels[key] : r.h;
      if(hVal === 0 || hVal == null) return;
      items.push({
        type:'rtc', pct: r.pct, h: hVal, emp: !!r.emp, key,
        date: addDays(expiry, -hVal), done: applied.includes(key),
        edited: editedLevels[key] !== undefined
      });
    });
    if(brand && brand.ret > 0){
      const key = 'ret';
      if(!removedLevels.includes(key)){
        const hVal = editedLevels[key] !== undefined ? editedLevels[key] : brand.ret;
        if(hVal > 0){
          items.push({ type:'ret', h: hVal, key, date: addDays(expiry, -hVal), done: applied.includes(key) });
        }
      }
    }
  }

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
  if(p.patternCode !== undefined) return buildBrandFromPattern(p.nm, p.patternCode, p.returnH);
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
    division: resolveDivision(p),
    brand, items, next, expired, todayEvents,
    overdueItems, hasOverdue: overdueItems.length > 0,
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
    window.state.products = arr;
    saveProductsLocal();
    console.log(`📥 Produk: ${arr.length}`);
    return true;
  }catch(e){
    console.error('loadProductsFromFS error:', e);
    return false;
  }
}

let fsUnsub = null;
function startRealtimeSync(){
  if(!window.fbReady || fsUnsub) return;
  if(window.state.curPage !== 'dash' && window.state.curPage !== 'set') return;
  try{
    fsUnsub = window.fb.onSnapshot(
      window.fb.collection(window.fb.db, 'products'),
      (snap) => {
        if(window.state.curPage !== 'dash' && window.state.curPage !== 'set') return;
        const changes = snap.docChanges();
        if(changes.length === 0 && window.state.products.length > 0) return;
        const arr = [];
        snap.forEach(d => arr.push({ ...d.data(), bc: d.id }));
        window.state.products = arr;
        saveProductsLocal();
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
  }catch(e){ console.error('Save error:', e); toast('Gagal simpan', 'er'); return false; }
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
function barcodeFromId(id){ return !id ? '' : String(id).split('__')[0] || id; }

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

async function bulkSetDivision(divId, opts){
  opts = opts || {};
  const ids = (window.DEFAULT_DIVISIONS || []).map(d => d.id);
  if(!ids.includes(divId)) return { error: 'Divisi tidak valid' };
  const prods = window.state.products || [];
  if(!prods.length) return { error: 'Tidak ada produk' };
  prods.forEach(p => { p.division = divId; });
  saveProductsLocal();
  Object.values(window.state.byBc || {}).forEach(m => { m.division = divId; });

  let done = 0, failed = 0;
  if(window.fbReady && !opts.skipFS){
    const BATCH = 400;
    for(let i = 0; i < prods.length; i += BATCH){
      try{
        const batch = window.fb.writeBatch(window.fb.db);
        const slice = prods.slice(i, i + BATCH);
        slice.forEach(p => {
          const { bc, ...data } = p;
          batch.set(window.fb.doc(window.fb.db, 'products', bc), data);
        });
        await batch.commit();
        done += slice.length;
      }catch(e){ console.error('Bulk error:', e); failed += 1; }
    }
  }
  return { ok: true, done, failed, total: prods.length };
}

window.buildBrandFromPattern = buildBrandFromPattern;
window.loadMasterFromFile = loadMasterFromFile;
window.loadMasterDivision = loadMasterDivision;
window.refreshMasterFromFS = refreshMasterFromFS;
window.getMasterByBarcode = getMasterByBarcode;
window.getEffectiveDivisions = getEffectiveDivisions;
window.invalidateMasterCache = invalidateMasterCache;
window.buildTimeline = buildTimeline;
window.resolveDivision = resolveDivision;
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
window.bulkSetDivision = bulkSetDivision;

console.log('✅ data.js loaded (per-divisi)');
