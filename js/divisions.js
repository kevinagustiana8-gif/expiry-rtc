// ============================================================
// divisions.js — Sistem divisi produk (seperti supermarket)
// ============================================================

// Divisi default
const DEFAULT_DIVISIONS = [
  { id:'groceries', name:'Groceries', icon:'🛒', color:'#16a34a', bg:'#dcfce7', desc:'Beras, minyak, gula, tepung, mie' },
  { id:'fresh',     name:'Fresh',     icon:'🥬', color:'#65a30d', bg:'#ecfccb', desc:'Sayur, buah, daging, telur' },
  { id:'frozen',    name:'Frozen',    icon:'🧊', color:'#0ea5e9', bg:'#e0f2fe', desc:'Makanan beku & ice cream' },
  { id:'dairy',     name:'Dairy',     icon:'🥛', color:'#6366f1', bg:'#e0e7ff', desc:'Susu, keju, yogurt, mentega' },
  { id:'bakery',    name:'Bakery',    icon:'🍞', color:'#d97706', bg:'#fef3c7', desc:'Roti, kue, pastry' },
  { id:'beverages', name:'Beverages', icon:'🥤', color:'#0891b2', bg:'#cffafe', desc:'Air, jus, soda, kopi, teh' },
  { id:'household', name:'Household', icon:'🧼', color:'#a855f7', bg:'#f3e8ff', desc:'Deterjen, sabun, tisu' },
];

// ============ RULES AUTO-DETEKSI ============
// Urutan penting: cek dari paling spesifik dulu
const DIVISION_RULES = [
  { id:'frozen', keywords:[
    'FROZEN','ICE CREAM','ES KRIM','AICE','CAMPINA','WALLS','MAGNUM','CORNETTO',
    'FEAST','PADDLE POP','FROSTBITE','HAKU','LA CREMERIA','HAAGENDAZS',
    'NUGGET','SOSIS','SAUSAGE','KIMBO','BELFOOD','FIESTA','BERNARDI','KANZLER',
    'SO GOOD','SO NICE','CEDEA','EL PRIMO','RIVERLAND','SUNNY GOLD','LEZZA',
    'TOFU','TAHU BEKU','DIMSUM','SIOMAY','BAKSO','OTAK-OTAK'
  ]},
  { id:'dairy', keywords:[
    'MILK','SUSU','CHEESE','KEJU','YOGURT','YOGHURT','BUTTER','MENTEGA',
    'CREAM','KRIM','PROCHIZ','KRAFT','ANCHOR','ARLA','EMBORG','PRESIDENT',
    'CIMORY','GREENFIELDS','ULTRA','INDOMILK','FRISIAN'
  ]},
  { id:'bakery', keywords:[
    'ROTI','BREAD','CAKE','KUE','PASTRY','BAGUETTE','DONAT','CROISSANT',
    'SARI ROTI','MY ROTI','HAILAI','I BREAD','SWEET','BUN','TOAST',
    'BISKUIT','COOKIES','WAFER','BROWNIES','MUFFIN'
  ]},
  { id:'beverages', keywords:[
    'JUICE','JUS','SODA','MINUMAN','TEH','KOPI','COFFEE','TEA','WATER',
    'AIR MINERAL','AQUA','SYRUP','SIRUP','SOYMILK','VSOY','BOTTLE',
    'JUNGLE','DIAMOND JUICE','BERRI','TOZA','NATURAL ONE','MONTEBELO',
    'COCA','PEPSI','SPRITE','FANTA','TEBS','POCARI','MILO','OVALTINE'
  ]},
  { id:'household', keywords:[
    'DETERJEN','SABUN','SHAMPO','PASTA GIGI','TISU','PEMBERSIH','PEL',
    'SOFTENER','PELEMBUT','SUNLIGHT','RINSO','SO KLIN','MOLTO','DOWNY',
    'BAYCLIN','VIP','OK','MR MUSCLE'
  ]},
  { id:'fresh', keywords:[
    'DAGING','AYAM','IKAN','UDANG','SAYUR','BUAH','TELUR','EGG',
    'TEMPE','TAHU','BAYAM','KANGKUNG','WORTEL','TOMAT','KENTANG',
    'APEL','JERUK','PISANG','MANGGA','ANGGUR','SEMANGKA'
  ]},
  { id:'groceries', keywords:[
    'BERAS','MINYAK','GULA','TEPUNG','MIE','INSTAN','BUMBU','SAUS',
    'KECAP','GARAM','KALDU','PENYEDAP','MASAKO','ROYCO','AJINOMOTO',
    'SASA','INDOMIE','SARIMI','MAGGIE','POP MIE','GARUDA','KACANG',
    'KERUPUK','MAKANAN','SNACK','KERIPIK','BISKUIT'
  ]},
];

// ============ DETEKSI OTOMATIS ============
function detectDivision(productName){
  if(!productName) return 'groceries';
  const u = String(productName).toUpperCase();

  for(const rule of DIVISION_RULES){
    for(const kw of rule.keywords){
      if(u.includes(kw)){
        return rule.id;
      }
    }
  }
  return 'groceries'; // default
}

// ============ GET DIVISI INFO ============
function getDivision(id){
  const custom = window.state && window.state.divisions ? window.state.divisions : DEFAULT_DIVISIONS;
  return custom.find(d => d.id === id) || DEFAULT_DIVISIONS.find(d => d.id === id) || DEFAULT_DIVISIONS[0];
}

// ============ RENDER BADGE ============
function divisionBadge(divId){
  const d = getDivision(divId);
  return `<span class="div-badge" style="background:${d.bg};color:${d.color}">${d.icon} ${d.name}</span>`;
}

// ============ LOAD DIVISI DARI FIRESTORE ============
async function loadDivisionsFromFS(){
  if(!window.fbReady) return;
  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'divisions')
    );
    if(snap.empty){
      // Belum ada → pakai default
      window.state.divisions = DEFAULT_DIVISIONS.slice();
      console.log('📁 Divisi: pakai default (7)');
      return;
    }
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a, b) => (a.order || 0) - (b.order || 0));
    window.state.divisions = arr;
    console.log(`📁 Divisi dari Firestore: ${arr.length}`);
  }catch(e){
    console.warn('Load divisions error:', e);
    window.state.divisions = DEFAULT_DIVISIONS.slice();
  }
}

// ============ SEED DIVISI KE FIRESTORE ============
async function seedDivisionsToFS(){
  if(!window.fbReady) return;
  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'divisions')
    );
    if(!snap.empty) return; // sudah ada

    const batch = window.fb.writeBatch(window.fb.db);
    DEFAULT_DIVISIONS.forEach((d, i) => {
      const ref = window.fb.doc(window.fb.db, 'divisions', d.id);
      batch.set(ref, { ...d, order: i, createdAt: new Date().toISOString() });
    });
    await batch.commit();
    console.log('✅ Divisi default di-seed ke Firestore');
  }catch(e){
    console.warn('Seed divisions error:', e);
  }
}

// ============ FILTER HELPER ============
function filterByDivision(list, divId){
  if(!divId || divId === 'all') return list;
  return list.filter(p => {
    const d = p.division || detectDivision(p.nm);
    return d === divId;
  });
}

// Expose
window.DEFAULT_DIVISIONS = DEFAULT_DIVISIONS;
window.detectDivision = detectDivision;
window.getDivision = getDivision;
window.divisionBadge = divisionBadge;
window.loadDivisionsFromFS = loadDivisionsFromFS;
window.seedDivisionsToFS = seedDivisionsToFS;
window.filterByDivision = filterByDivision;

console.log('✅ divisions.js loaded');
