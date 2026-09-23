// ============================================================
// themes.js — 5 Tema
// ============================================================

const THEME_KEY = 'expiry-rtc-theme';

const THEMES = [
  {
    id: 'default',
    icon: '⚪',
    nama: 'Default',
    desc: 'Tema asli aplikasi (netral abu-abu)',
    preview: 'linear-gradient(135deg,#f4f5f7 50%,#1f2937 50%)'
  },
  {
    id: 'malam',
    icon: '🌙',
    nama: 'Malam',
    desc: 'Langit malam dengan bintang & bulan',
    preview: 'linear-gradient(135deg,#0a0e27 50%,#fcd34d 50%)'
  },
  {
    id: 'siang',
    icon: '☀️',
    nama: 'Siang',
    desc: 'Langit biru dengan matahari & awan',
    preview: 'linear-gradient(135deg,#87ceeb 50%,#facc15 50%)'
  },
  {
    id: 'pagi',
    icon: '🌅',
    nama: 'Pagi',
    desc: 'Matahari terbit dengan langit keemasan',
    preview: 'linear-gradient(135deg,#fef3c7 50%,#f97316 50%)'
  },
  {
    id: 'sore',
    icon: '🌇',
    nama: 'Sore',
    desc: 'Senja dengan langit ungu keemasan',
    preview: 'linear-gradient(135deg,#4c1d95 50%,#fb923c 50%)'
  }
];

function applyTheme(id){
  // Hapus semua kelas theme-*
  document.body.className = document.body.className
    .split(' ')
    .filter(c => !c.startsWith('theme-'))
    .join(' ')
    .trim();
  if(id && id !== 'default'){
    document.body.classList.add('theme-' + id);
  }
  try{
    localStorage.setItem(THEME_KEY, id || 'default');
  }catch(e){}
}

function getCurrentTheme(){
  try{
    return localStorage.getItem(THEME_KEY) || 'default';
  }catch(e){
    return 'default';
  }
}

function loadTheme(){
  const t = getCurrentTheme();
  if(t && t !== 'default'){
    applyTheme(t);
  }
}

function renderThemePage(){
  const el = document.getElementById('tema-grid');
  if(!el) return;
  const cur = getCurrentTheme();
  el.innerHTML = THEMES.map(t => {
    const active = t.id === cur;
    return `
      <div class="usr-item" style="cursor:pointer;${active ? 'border:2px solid var(--pr);background:rgba(37,99,235,.05)' : ''}" data-tema="${t.id}">
        <div style="width:56px;height:56px;border-radius:12px;background:${t.preview};flex-shrink:0;border:1px solid rgba(0,0,0,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3)"></div>
        <div class="usr-info">
          <div class="usr-name">${t.icon} ${t.nama}${active ? ' <span style="color:var(--pr);font-size:11px">✓ Aktif</span>' : ''}</div>
          <div class="mt" style="margin-top:4px">${t.desc}</div>
        </div>
      </div>
    `;
  }).join('');
  el.querySelectorAll('[data-tema]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.tema;
      applyTheme(id);
      renderThemePage();
      const t = THEMES.find(x => x.id === id);
      toast(`Tema ${t ? t.nama : id} diterapkan`, 'ok');
    });
  });
}

// Expose
window.THEMES = THEMES;
window.applyTheme = applyTheme;
window.getCurrentTheme = getCurrentTheme;
window.loadTheme = loadTheme;
window.renderThemePage = renderThemePage;

console.log('✅ themes.js loaded');
