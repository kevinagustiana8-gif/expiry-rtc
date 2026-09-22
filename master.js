// ============================================================
// master.js — Tabel Pola RTC
// Data produk utama tersimpan di Firestore (collection "master")
// File ini hanya tabel pola P + fallback kosong.
// ============================================================

// Tabel pola RTC → [H-30%, H-50%, H-70%, H-80%]
// null = level tersebut tidak ada
const P = {
  0:  null,                   // tanpa RTC
  1:  [7, 5, 3, 2],           // paling umum
  2:  [30, 14, 7, 3],         // long-life (frozen, cheese, miso)
  3:  [14, 7, 5, 3],          // tofu besar / baso ikan
  4:  [10, 7, 5, 2],          // telur premium
  5:  [3, 2, 1],              // tempe
  6:  [5, 3, 2, 1],           // TOWANG
  7:  [4, 3, 2, 1],           // Japanese tofu
  8:  [7, null, null, null],  // 30% saja
  9:  [30, null, null, null],
  10: [14, null, null, null],
  11: [3, null, null, null],
};

// Fallback kosong — data produk diambil dari Firestore
const MASTER = [];

window.P = P;
window.MASTER = MASTER;
