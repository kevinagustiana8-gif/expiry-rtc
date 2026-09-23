// ============================================================
// master.js — Tabel Pola RTC
// Data produk utama tersimpan di Firestore (collection "master")
// File ini hanya tabel pola P + fallback kosong.
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
// GABUNG DENGAN DATA OPEN FOOD FACTS (data kedua)
// Prioritas: master.js (data pertama) menang kalau barcode sama
// Format OFF: [bc, nm, brand, qty, division, pattern, returnH, origin]
// Format MASTER: [bc, nm, patternCode, returnH]
// ============================================================
if(typeof window.MASTER_OFF !== 'undefined' && Array.isArray(window.MASTER_OFF)){
  // Buat index barcode yang sudah ada di master.js
  const existingBc = new Set(MASTER.map(row => String(row[0])));

  let added = 0;
  let skipped = 0;

  window.MASTER_OFF.forEach(row => {
    const bc = String(row[0] || '');
    const nm = row[1];
    const pattern = row[5] || 1;
    const returnH = row[6] || 0;

    if(!bc || !nm){ return; }

    // ⭐ Kalau barcode sudah ada di data pertama → SKIP (pertahankan yang lama)
    if(existingBc.has(bc)){
      skipped++;
      return;
    }

    // Kalau belum ada → tambah ke MASTER
    MASTER.push([bc, nm, pattern, returnH]);
    existingBc.add(bc);   // tandai biar tidak duplikat internal
    added++;
  });

  console.log(`✅ Gabung OFF: +${added} produk baru (skip ${skipped} duplikat)`);
  console.log(`📊 Total master: ${MASTER.length} produk`);
}

window.P = P;
window.MASTER = MASTER;

console.log('✅ master.js loaded');
