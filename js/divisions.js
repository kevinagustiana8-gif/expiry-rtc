// ============================================================
// divisions.js — 4 divisi (Grocery, Daily&Dairy, Perishable, Health&Beauty)
// ============================================================

const DEFAULT_DIVISIONS = [
  { id:'grocery', name:'Grocery', icon:'🛒', color:'#16a34a', bg:'#dcfce7',
    desc:'Grocery / GMS / Non-Food · tahan suhu ruangan', schedule:'grocery' },
  { id:'daily_dairy', name:'Daily & Dairy', icon:'🥛', color:'#6366f1', bg:'#e0e7ff',
    desc:'Susu, keju, yogurt, frozen, roti kemasan', schedule:'pattern' },
  { id:'perishable', name:'Perishable', icon:'🥬', color:'#65a30d', bg:'#ecfccb',
    desc:'Buah, sayur, daging, diproses di tempat', schedule:'perishable' },
  { id:'health_beauty', name:'Health & Beauty', icon:'💄', color:'#db2777', bg:'#fce7f3',
    desc:'Skincare, makeup, obat, vitamin, perawatan diri', schedule:'pattern' }
];

const GROCERY_SECTIONS = [
  { id:'grocery',  name:'Grocery',  desc:'Makanan kering, minuman, bumbu' },
  { id:'gms',      name:'GMS',      desc:'General merchandise' },
  { id:'non_food', name:'Non-Food', desc:'Household, alat, perlengkapan' }
];

const DIVISION_MIGRATION = {
  'frozen':'daily_dairy','fresh':'perishable','groceries':'grocery',
  'dairy':'daily_dairy','bakery':'daily_dairy','beverages':'grocery','household':'grocery',
  'frozen_food':'daily_dairy','snack':'grocery','household_care':'health_beauty'
};

const DIVISION_RULES = [
  { id:'daily_dairy', keywords:[
    'FROZEN','ICE CREAM','ES KRIM','AICE','CAMPINA','WALLS','MAGNUM','CORNETTO',
    'FEAST','PADDLE POP','HAKU','LA CREMERIA','HAAGENDAZS',
    'NUGGET','SOSIS','SAUSAGE','KIMBO','BELFOOD','FIESTA','BERNARDI','KANZLER',
    'MILK','SUSU','CHEESE','KEJU','YOGURT','YOGHURT','BUTTER','MENTEGA',
    'CREAM','KRIM','PROCHIZ','KRAFT','ANCHOR','ARLA','EMBORG',
    'CIMORY','GREENFIELDS','ULTRA','INDOMILK','FRISIAN',
    'ROTI','BREAD','CAKE','KUE','PASTRY','DONAT','CROISSANT',
    'SARI ROTI','MY ROTI','BISKUIT','COOKIES','WAFER'
  ]},
  { id:'health_beauty', keywords:[
    'SKINCARE','MAKEUP','MASCARA','LIPSTICK','FOUNDATION','POWDER','BLUSH',
    'SABUN','SHAMPO','KONDISIONER','PASTA GIGI','SIKAT GIGI','DEODORANT',
    'PARFUM','BODY LOTION','SUNSCREEN','VITAMIN','SUPLEMEN','OBAT',
    'PAMPERS','POPOK','TISU','PEMBALUT','COTTON BUD',
    'NIVEA','POND\'S','GARNIER','VASELINE','L\'OREAL','WARDAH','EMINA',
    'PONDS','OLAY','SENSODYNE','PEPSODENT','DOVE','LIFEBUOY','DETTOL'
  ]},
  { id:'perishable', keywords:[
    'DAGING','AYAM','IKAN','UDANG','SAYUR','BUAH','TELUR','EGG',
    'TEMPE','TAHU','BAYAM','KANGKUNG','WORTEL','TOMAT','KENTANG',
    'APEL','JERUK','PISANG','MANGGA','ANGGUR','SEMANGKA',
    'DIMSUM','SIOMAY','BAKSO','OTAK-OTAK','SUSHI'
  ]},
  { id:'grocery', keywords:[
    'BERAS','MINYAK','GULA','TEPUNG','MIE','INSTAN','BUMBU','SAUS',
    'KECAP','GARAM','KALDU','PENYEDAP','MASAKO','ROYCO','AJINOMOTO',
    'SASA','INDOMIE','SARIMI','MAGGIE','POP MIE','GARUDA','KACANG',
    'KERUPUK','MAKANAN','SNACK','KERIPIK',
    'JUICE','JUS','SODA','MINUMAN','TEH','KOPI','COFFEE','TEA','WATER',
    'AIR MINERAL','AQUA','SYRUP','SIRUP','SOYMILK','VSOY',
    'DETERJEN','PEMBERSIH','SUNLIGHT','RINSO','SO KLIN','MOLTO','DOWNY','BAYCLIN'
  ]}
];

function detectDivision(productName){
  if(!productName) return 'grocery';
  const u = String(productName).toUpperCase();
  for(const rule of DIVISION_RULES){
    for(const kw of rule.keywords){
      if(u.includes(kw)) return rule.id;
    }
  }
  return 'grocery';
}

function migrateDivision(oldDiv){
  if(!oldDiv) return 'grocery';
  return DIVISION_MIGRATION[oldDiv] || oldDiv;
}

function detectOrigin(barcode){
  const s = String(barcode || '');
  if(!s) return 'L';
  if(s.startsWith('899')) return 'L';
  if(s.startsWith('888') || s.startsWith('880') || s.startsWith('885')) return 'I';
  const p3 = parseInt(s.substring(0, 3));
  if(p3 >= 0 && p3 <= 139) return 'I';
  if(p3 >= 300 && p3 <= 379) return 'I';
  if(p3 >= 400 && p3 <= 440) return 'I';
  if(p3 >= 450 && p3 <= 459) return 'I';
  if(p3 === 490) return 'I';
  if(p3 >= 690 && p3 <= 699) return 'I';
  if(p3 >= 930 && p3 <= 939) return 'I';
  if(p3 >= 940 && p3 <= 949) return 'I';
  return 'L';
}

function originLabel(o){ return o === 'I' ? '🌏 Import' : '🇮🇩 Lokal'; }

function getDivision(id){
  const custom = (window.state && window.state.divisions) ? window.state.divisions : DEFAULT_DIVISIONS;
  return custom.find(d => d.id === id) || DEFAULT_DIVISIONS.find(d => d.id === id) || DEFAULT_DIVISIONS[0];
}

function divisionBadge(divId){
  const d = getDivision(divId);
  return `<span class="div-badge" style="background:${d.bg};color:${d.color}">${d.icon} ${d.name}</span>`;
}

function loadDivisionsFromFS(){
  window.state.divisions = DEFAULT_DIVISIONS.slice();
  return Promise.resolve();
}
function seedDivisionsToFS(){ return Promise.resolve(); }

function filterByDivision(list, divId){
  if(!divId || divId === 'all') return list;
  return list.filter(p => migrateDivision(p.division || detectDivision(p.nm)) === divId);
}

window.DEFAULT_DIVISIONS = DEFAULT_DIVISIONS;
window.GROCERY_SECTIONS = GROCERY_SECTIONS;
window.DIVISION_MIGRATION = DIVISION_MIGRATION;
window.detectDivision = detectDivision;
window.migrateDivision = migrateDivision;
window.detectOrigin = detectOrigin;
window.originLabel = originLabel;
window.getDivision = getDivision;
window.divisionBadge = divisionBadge;
window.loadDivisionsFromFS = loadDivisionsFromFS;
window.seedDivisionsToFS = seedDivisionsToFS;
window.filterByDivision = filterByDivision;

console.log('✅ divisions.js loaded (4 divisi)');
