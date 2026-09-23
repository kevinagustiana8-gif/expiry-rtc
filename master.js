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
  4:  [10, 7, 5, 2],
  5:  [3, 2, 1],
  6:  [5, 3, 2, 1],
  7:  [4, 3, 2, 1],
  8:  [7, null, null, null],
  9:  [30, null, null, null],
  10: [14, null, null, null],
  11: [3, null, null, null],
};

const MASTER = [];

window.P = P;
window.MASTER = MASTER;

console.log('✅ master.js loaded');
