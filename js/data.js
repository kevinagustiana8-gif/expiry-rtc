// ============================================================
// data.js — Master, timeline, products, bulk ops (OPTIMIZED)
// ============================================================

const MASTER_CACHE_TTL = 60 * 60 * 1000;
const MASTER_CACHE_KEY = 'expiry-master-cache';
const MASTER_CACHE_AT  = 'expiry-master-cache-at';

function invalidateMasterCache(){
  try{
    localStorage.removeItem(MASTER_CACHE_KEY);
    localStorage.removeItem(MASTER_CACHE_AT);
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

function loadMasterFromFile(){
  const M = window.MASTER || [];
  if(!Object.keys(window.state.byBc || {}).length){
    window.state.byBc = {};
    window.state.byName = {};
  }
  M.forEach(row => {
    const [bc, nm, pcode, retH] = row;
    if(window.state.byBc[bc]) return;
    const brand = buildBrandFromPattern(nm, pcode || 0, retH || 0);
    const entry = { bc, nm, brand, division: null, origin: null, _src: 'file' };
    window.state.byBc[bc] = entry;
    window.state.byName[String(nm).toLowerCase()] = entry;
  });
  console.log(`📚 Master file: ${Object.keys(window.state.byBc).length}`);
}

async function refreshMasterFromFS(force){
  if(!window.fbReady) return false;

  if(!force){
    try{
      const cached = localStorage.getItem(MASTER_CACHE_KEY);
      const cachedAt = parseInt(localStorage.getItem(MASTER_CACHE_AT) || '0');
      if(cached && (Date.now() - cachedAt) < MASTER_CACHE_TTL){
        const data = JSON.parse(cached);
        if(data && data.byBc && Object.keys(data.byBc).length > 0){
          window.state.byBc = data.byBc;
          window.state.byName = data.byName;
          console.log(`📚 Master dari cache (${Object.keys(data.byBc).length} produk)`);
          return true;
        }
      }
    }catch(e){}
  }

  try{
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, 'master'));
    if(snap.empty){ console.log('ℹ️ Master kosong'); return false; }

    const newByBc = {}, newByName = {};
    snap.forEach(d => {
      const data = d.data();
      if(!data.bc) return;
      if(data.deleted === true) return;
      const brand = buildBrandFromPattern(data.nm, data.patternCode || 0, data.returnH || 0, data.customRtc);
      const entry = {
        bc: data.bc, nm: data.nm, brand,
        division: data.division || null,
        origin: data.origin || null,
        _src: 'fs'
      };
      newByBc[data.bc] = entry;
      newByName[String(data.nm).toLowerCase()] = entry;
    });

    window.state.byBc = newByBc;
    window.state.byName = newByName;

    try{
      localStorage.setItem(MASTER_CACHE_KEY, JSON.stringify({ byBc: newByBc, byName: newByName }));
      localStorage.setItem(MASTER_CACHE_AT, String(Date.now()));
    }catch(e){}

    console.log(`✅ Master Firestore: ${Object.keys(newByBc).length} produk`);
    return true;
  }catch(e){
    console.error('refreshMasterFromFS error:', e);
    return false;
  }
}

function resolveDivision(p){
  if(!p) return 'grocery';
  const validIds = (window.DEFAULT_DIVISIONS || []).map(d => d.id);

  if(p.division && validIds.includes(p.division)) return p.division;

  if(p.division && typeof migrateDivision === 'function'){
    const migrated = migrateDivision(p.division);
    if(migrated && validIds.includes(migrated)) return migrated;
  }

  if(p.bc){
    const m = window.state.byBc[p.bc];
    if(m && m.division){
      if(validIds.includes(m.division)) return m.division;
      if(typeof migrateDivision === 'function'){
        const migrated = migrateDivision(m.division);
        if(migrated && validIds.includes(migrated)) return migrated;
      }
    }
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
    items.push({ type:'rtc', pct:30, h, emp:false, key:'rtc30',
      date: addDays(expiry, -h), done: applied.includes('rtc30') });
    items.push({ type:'ret', h, key:'ret',
      date: addDays(expiry, -h), done: applied.includes('ret') });
  }
  else if(div === 'perishable'){
    items.push({ type:'rtc', pct:30, h:1, emp:false, key:'rtc30',
      date: addDays(expiry, -1), done: applied.includes('rtc30') });
    items.push({ type:'ret', h:1, key:'ret',
      date: addDays(expiry, -1), done: applied.includes('ret') });
  }
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
    division: resolveDivision(p),
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
        console.log(`🔄 Sync realtime: ${arr.length} (${changes.length} changes)`);

        if(window.state.curPage === 'dash' && typeof renderDash === 'function') renderDash();
        if(window.state.curPage === 'set'  && typeof renderSet  === 'function') renderSet();
      },
      (err) => console.error('Realtime error:', err)
    );
  }catch(e){ console.error('Sync setup error:', e); }
}

function stopRealtimeSync(){
  if(fsUnsub){
    try{ fsUnsub(); }catch(e){}
    fsUnsub = null;
    console.log('🛑 Realtime sync stopped');
  }
}

async function saveProductToFS(p){
  if(!window.fbReady) return false;
  try{
    const { bc, ...data } = p;
    await window.fb.setDoc(window.fb.doc(window.fb.db, 'products', bc), data);
    return true;
  }catch(e){
    console.error('Save error:', e);
    toast('Gagal simpan', 'er');
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
      }catch(e){
        console.error('Bulk error:', e);
        failed += 1;
      }
    }
  }
  return { ok: true, done, failed, total: prods.length };
}

window.buildBrandFromPattern = buildBrandFromPattern;
window.loadMasterFromFile = loadMasterFromFile;
window.refreshMasterFromFS = refreshMasterFromFS;
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

console.log('✅ data.js loaded (optimized)');
