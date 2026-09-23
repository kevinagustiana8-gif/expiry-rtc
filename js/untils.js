// ============================================================
// utils.js — Helper functions
// ============================================================

// ============ TANGGAL ============
function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(iso, n){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysDiff(a, b){
  return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 86400000);
}

function fmtD(iso){
  if(!iso) return '—';
  const [y,m,d] = iso.split('-');
  const b = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d} ${b[+m-1]} ${y}`;
}

function fmtDI(iso){
  if(!iso) return '—';
  const [y,m,d] = iso.split('-');
  const b = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${+d} ${b[+m-1]} ${y}`;
}

function fmtTime(iso){
  if(!iso) return '-';
  const d = new Date(iso);
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const pad = n => String(n).padStart(2,'0');
  return `${pad(d.getDate())} ${bulan[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function relativeTime(iso){
  if(!iso) return 'belum pernah';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if(diff < 0) return 'baru saja';
  if(diff < 60) return 'baru saja';
  if(diff < 3600) return Math.floor(diff/60) + ' menit lalu';
  if(diff < 86400) return Math.floor(diff/3600) + ' jam lalu';
  if(diff < 2592000) return Math.floor(diff/86400) + ' hari lalu';
  return fmtTime(iso);
}

function isOnline(iso){
  if(!iso) return false;
  return (Date.now() - new Date(iso).getTime()) < 90000; // 90 detik
}

// ============ STRING ============
function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function slugify(s){
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

// ============ UI ============
function toast(msg, type){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.className = 'ts ' + (type || '');
  el.classList.remove('hide');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hide'), 2600);
}

function beep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .12);
    osc.start(); osc.stop(ctx.currentTime + .12);
    setTimeout(() => ctx.close(), 200);
  }catch(e){}
}

function vib(ms){
  if(navigator.vibrate) navigator.vibrate(ms);
}

function show(el){
  if(typeof el === 'string') el = document.getElementById(el);
  if(el) el.classList.remove('hide');
}

function hide(el){
  if(typeof el === 'string') el = document.getElementById(el);
  if(el) el.classList.add('hide');
}

function qs(s){ return document.querySelector(s); }
function qsa(s){ return Array.from(document.querySelectorAll(s)); }

function detectDevice(ua){
  ua = (ua || '').toLowerCase();
  if(ua.includes('android')) return '📱 Android';
  if(ua.includes('iphone') || ua.includes('ipad')) return '📱 iOS';
  if(ua.includes('windows')) return '💻 Windows';
  if(ua.includes('mac')) return '💻 Mac';
  if(ua.includes('linux')) return '💻 Linux';
  return '❓ Unknown';
}

// ============ DEBOUNCE ============
function debounce(fn, ms){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ============ DEVICE ID ============
function getDeviceId(){
  let id = localStorage.getItem('expiry-device-id');
  if(!id){
    id = 'dev-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('expiry-device-id', id);
  }
  return id;
}

// Expose ke window
window.todayISO = todayISO;
window.addDays = addDays;
window.daysDiff = daysDiff;
window.fmtD = fmtD;
window.fmtDI = fmtDI;
window.fmtTime = fmtTime;
window.relativeTime = relativeTime;
window.isOnline = isOnline;
window.esc = esc;
window.slugify = slugify;
window.toast = toast;
window.beep = beep;
window.vib = vib;
window.show = show;
window.hide = hide;
window.qs = qs;
window.qsa = qsa;
window.detectDevice = detectDevice;
window.debounce = debounce;
window.getDeviceId = getDeviceId;

console.log('✅ utils.js loaded');
