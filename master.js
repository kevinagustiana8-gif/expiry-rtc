// ============================================================
// master.js — Tabel Pola RTC + Fallback
// ============================================================

const P = {
  0:  null,
  1:  [7, 5, 3, 2],
  2:  [30, 14, 7, 3],
  3:  [14, 7, 5, 3],
  4:  [10, 7, 5, 3],
  5:  [3, 2, 1],
  6:  [5, 3, 2, 1],
  7:  [4, 3, 2, 1],
  8:  [7, null, null, null],
  9:  [30, null, null, null],
  10: [14, null, null, null],
  11: [3, null, null, null],
};

const MASTER = [];

// ============================================================
// GABUNG DENGAN DATA OPEN FOOD FACTS
// Format OFF BARU: [bc, nm, patternCode, returnH, division, origin]
// Format MASTER: [bc, nm, patternCode, returnH, division, origin]
// ============================================================
if(typeof window.MASTER_OFF !== 'undefined' && Array.isArray(window.MASTER_OFF)){
  const existingBc = new Set(MASTER.map(row => String(row[0])));

  let added = 0;
  let skipped = 0;

  window.MASTER_OFF.forEach(row => {
    const bc = String(row[0] || '');
    const nm = row[1];
    const patternCode = row[2] !== undefined ? row[2] : 0;
    const returnH = row[3] !== undefined ? row[3] : 0;
    const division = row[4] || null;
    const origin = row[5] || null;

    if(!bc || !nm) return;

    // Skip kalau barcode sudah ada
    if(existingBc.has(bc)){
      skipped++;
      return;
    }

    MASTER.push([bc, nm, patternCode, returnH, division, origin]);
    existingBc.add(bc);
    added++;
  });

  console.log(`✅ Gabung OFF: +${added} produk baru (skip ${skipped} duplikat)`);
  console.log(`📊 Total master: ${MASTER.length} produk`);
}

window.P = P;
window.MASTER = MASTER;

console.log('✅ master.js loaded');
