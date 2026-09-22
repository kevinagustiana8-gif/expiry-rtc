// ==================== UTIL ====================
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const daysDiff=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000);
const fmtD=iso=>{if(!iso)return'—';const[y,m,d]=iso.split('-');const b=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return `${d} ${b[+m-1]} ${y}`};
const fmtDI=iso=>{if(!iso)return'—';const[y,m,d]=iso.split('-');const b=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];return `${+d} ${b[+m-1]} ${y}`};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m,t){const el=$('#toast');el.textContent=m;el.className='ts '+(t||'');el.classList.remove('hide');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.add('hide'),2600)}
function beep(){try{const c=new(window.AudioContext||window.webkitAudioContext)();const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='square';o.frequency.value=880;g.gain.setValueAtTime(.15,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.12);o.start();o.stop(c.currentTime+.12);setTimeout(()=>c.close(),200)}catch(e){}}
function vib(ms){if(navigator.vibrate)navigator.vibrate(ms)}

// ==================== MASTER ====================
function buildBrandFromPattern(nama,patternCode,returnH,customRtc){
  let rtc=null;
  if(Array.isArray(customRtc)&&customRtc.length){
    rtc=[];
    const pcts=[30,50,70,80,90];
    for(let i=0;i<customRtc.length;i++){
      if(customRtc[i]==null)continue;
      rtc.push({pct:pcts[i],h:customRtc[i],emp:pcts[i]>=80});
    }
  } else {
    const arr=window.P[patternCode];
    if(arr){
      rtc=[];
      const pcts=[30,50,70,80];
      for(let i=0;i<arr.length;i++){
        if(arr[i]==null)continue;
        rtc.push({pct:pcts[i],h:arr[i],emp:pcts[i]===80});
      }
    }
  }
  return {
    key:Array.isArray(customRtc)?'custom':'p'+patternCode,
    cat:'',
    rtc,
    takeout:0,
    ret:(returnH&&returnH>0)?returnH:null
  };
}

const byBc={},byName={};
(window.MASTER||[]).forEach(row=>{
  const [bc,nm,pcode,retH]=row;
  const brand=buildBrandFromPattern(nm,pcode||0,retH||0);
  const entry={bc,nm,brand,_src:'file'};
  byBc[bc]=entry;
  byName[String(nm).toLowerCase()]=entry;
});
console.log(`Master awal (file): ${Object.keys(byBc).length} produk`);

async function refreshMasterFromFS(){
  if(!window.fbReady)return false;
  try{
    const snap=await window.fb.getDocs(window.fb.collection(window.fb.db,'master'));
    if(snap.empty){console.log('ℹ️ Master Firestore kosong');return false}
    const nB={},nN={};
    snap.forEach(d=>{
      const data=d.data();if(!data.bc)return;
      const brand=buildBrandFromPattern(data.nm,data.patternCode||0,data.returnH||0,data.customRtc);
      const entry={bc:data.bc,nm:data.nm,brand,_src:'fs'};
      nB[data.bc]=entry;
      nN[String(data.nm).toLowerCase()]=entry;
    });
    Object.keys(byBc).forEach(k=>delete byBc[k]);
    Object.assign(byBc,nB);
    Object.keys(byName).forEach(k=>delete byName[k]);
    Object.assign(byName,nN);
    console.log(`✅ Master dari Firestore: ${Object.keys(byBc).length} produk`);
    return true;
  }catch(e){console.error('refreshMasterFromFS error:',e);return false}
}

// ==================== STATE ====================
const LS_KEY='expiry-rtc-v3';
let state={products:[],settings:{notif:true}};
function loadLocal(){try{const r=localStorage.getItem(LS_KEY);if(r){const d=JSON.parse(r);state.products=d.products||[];state.settings={notif:true,...(d.settings||{})}}}catch(e){}}
function saveLocal(){try{localStorage.setItem(LS_KEY,JSON.stringify(state))}catch(e){}}

// ==================== FIREBASE SYNC ====================
let fsReady=false,fsUnsub=null;
async function loadFromFirestore(){
  if(!window.fbReady)return false;
  try{
    const snap=await window.fb.getDocs(window.fb.collection(window.fb.db,'products'));
    const arr=[];
    snap.forEach(d=>arr.push({...d.data(),bc:d.id}));
    state.products=arr;fsReady=true;
    console.log(`📥 Dimuat dari Firebase: ${arr.length} produk`);
    return true;
  }catch(e){console.error('Firestore load error:',e);return false}
}
function startRealtimeSync(){
  if(!window.fbReady||fsUnsub)return;
  try{
    fsUnsub=window.fb.onSnapshot(window.fb.collection(window.fb.db,'products'),(snap)=>{
      const arr=[];
      snap.forEach(d=>arr.push({...d.data(),bc:d.id}));
      state.products=arr;fsReady=true;
      console.log(`🔄 Sync realtime: ${arr.length} produk`);
      if(curPage==='dash')renderDash();
      if(curPage==='set')renderSet();
    },(err)=>console.error('Realtime error:',err));
  }catch(e){console.error('Sync setup error:',e)}
}
async function syncProduct(p){
  if(!window.fbReady)return false;
  try{
    const {bc,...data}=p;
    await window.fb.setDoc(window.fb.doc(window.fb.db,'products',bc),data);
    console.log(`💾 Tersimpan ke Firebase: ${bc}`);
    return true;
  }catch(e){console.error('Save error:',e);toast('Gagal simpan ke server','er');return false}
}
async function syncDelete(bc){
  if(!window.fbReady)return false;
  try{
    await window.fb.deleteDoc(window.fb.doc(window.fb.db,'products',bc));
    console.log(`🗑️ Dihapus dari Firebase: ${bc}`);
    return true;
  }catch(e){console.error('Delete error:',e);return false}
}

// ==================== AUTH ====================
const SESSION_KEY='expiry-rtc-session';
let currentUser=null;

function loadSession(){try{const s=localStorage.getItem(SESSION_KEY);if(s)currentUser=JSON.parse(s)}catch(e){}}
function saveSession(){try{localStorage.setItem(SESSION_KEY,JSON.stringify(currentUser))}catch(e){}}
function clearSession(){try{localStorage.removeItem(SESSION_KEY)}catch(e){}currentUser=null}
function isOwner(){return currentUser&&currentUser.role==='owner'}
function isAdmin(){return currentUser&&(currentUser.role==='admin'||currentUser.role==='owner')}
function canEditUser(targetRole){
  if(!isAdmin())return false;
  if(isOwner())return true;
  return targetRole==='staff';
}
function isLoggedIn(){return !!currentUser}

function showLogin(){
  $('#login-overlay').classList.remove('hide');
  $('#login-user').value='';
  $('#login-pass').value='';
  $('#login-err').textContent='';
  setTimeout(()=>$('#login-user').focus(),100);
}
function showApp(){
  $('#login-overlay').classList.add('hide');
  const admin=isAdmin();
  const owner=isOwner();
  const nu=document.getElementById('nav-users');
  const nm=document.getElementById('nav-master');
  const nl=document.getElementById('nav-log');
  if(nu)nu.classList.toggle('hide',!admin);
  if(nm)nm.classList.toggle('hide',!admin);
  if(nl)nl.classList.toggle('hide',!owner);
  if(curPage==='users'&&!admin)goTo('scan');
  if(curPage==='master'&&!admin)goTo('scan');
  if(curPage==='log'&&!owner)goTo('scan');
}

async function ensureAdminExists(){
  if(!window.fbReady)return;
  try{
    const snap=await window.fb.getDocs(window.fb.collection(window.fb.db,'users'));
    if(snap.size===0){
      await window.fb.setDoc(window.fb.doc(window.fb.db,'users','admin'),{
        username:'admin',password:'admin2025',nama:'Administrator',role:'admin',
        createdAt:new Date().toISOString()
      });
      console.log('🔧 Admin default dibuat: admin / admin2025');
    }
  }catch(e){console.error('Seed error:',e)}
}

async function tryLogin(username,password){
  if(!window.fbReady)return {error:'Firebase belum siap. Tunggu sebentar.'};
  try{
    const snap=await window.fb.getDocs(window.fb.collection(window.fb.db,'users'));
    let found=null;
    snap.forEach(d=>{if(d.id===username)found={id:d.id,...d.data()}});
    if(!found)return {error:'Username tidak ditemukan.'};
    if(found.password!==password)return {error:'Password salah.'};
    currentUser={
      username: found.username || found.id || username,
      nama: found.nama || found.username || found.id || '-',
      role: found.role || 'staff'
    };
    saveSession();
    const now=new Date().toISOString();
    await window.fb.setDoc(window.fb.doc(window.fb.db,'users',username),
      {lastLogin:now,lastSeen:now},{merge:true});
    try{
      const logRef = window.fb.doc(window.fb.collection(window.fb.db,'login_log'));
      await window.fb.setDoc(logRef, {
        username: currentUser.username,
        nama: currentUser.nama,
        role: currentUser.role,
        timestamp: now,
        ua: (navigator.userAgent||'').substring(0,180)
      });
    }catch(e){console.warn('Login log error:', e);}
    return {ok:true};
  }catch(e){console.error(e);return {error:'Gagal login: '+e.message}}
}

function logout(){
  if(!confirm('Keluar dari aplikasi?'))return;
  clearSession();
  if(fsUnsub){try{fsUnsub()}catch(e){}fsUnsub=null}
  location.reload();
}

setInterval(async()=>{
  if(!currentUser||!window.fbReady)return;
  const uname = currentUser.username || currentUser.id;
  if(!uname) return;
  try{
    await window.fb.setDoc(window.fb.doc(window.fb.db,'users',uname),
      {lastSeen:new Date().toISOString()},{merge:true});
  }catch(e){}
},60000);

// ==================== NAVIGASI ====================
let curPage='scan';
function goTo(p){
  curPage=p;
  $$('.pg').forEach(x=>x.classList.add('hide'));
  const el=document.getElementById('pg-'+p);
  if(el)el.classList.remove('hide');
  $$('.bn button').forEach(b=>b.classList.toggle('active',b.dataset.p===p));
  const t={scan:'Scan Barcode',dash:'Dasbor',set:'Pengaturan',users:'Pengguna',master:'Master Produk',tema:'Pilih Tema',log:'Log Login'};
  $('#tt').textContent=t[p]||'Expiry RTC';
  if(p!=='scan')stopScan();
  if(p==='dash')renderDash();
  if(p==='set')renderSet();
  if(p==='users')loadUsers();
  if(p==='master')loadMasterPage();
  if(p==='tema')renderThemePage();
  if(p==='log')loadLoginLogs();
  if(p==='set'){
    const card=document.getElementById('set-migrate-card');
    const card2=document.getElementById('set-export-master-card');
    const show = currentUser && (currentUser.role==='admin' || currentUser.role==='owner');
    if(card)card.style.display=show?'':'none';
    if(card2)card2.style.display=show?'':'none';
  }
  window.scrollTo(0,0);
}
$$('.bn button').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.p)));

// ==================== SCANNER ====================
let qr=null,running=false,lastCode=null,lastTime=0,torchOn=false;
async function startScan(){
  if(running)return;
  if(!qr)qr=new Html5Qrcode('reader',{
    formatsToSupport:[
      Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.ITF,Html5QrcodeSupportedFormats.QR_CODE],
    verbose:false
  });
  try{
    await qr.start({facingMode:'environment'},
      {fps:10,qrbox:(w,h)=>{const s=Math.min(w*.85,320);return{width:Math.floor(s),height:Math.floor(s*.55)}},
       aspectRatio:1.0,
       experimentalFeatures:{useBarCodeDetectorIfSupported:true}},
      onScan,()=>{});
    running=true;
    $('#bstart').classList.add('hide');
    $('#bstop').classList.remove('hide');
    try{const c=qr.getRunningTrackCapabilities?.();if(c&&'torch' in c)$('#btorch').classList.remove('hide')}catch(e){}
  }catch(e){toast('Kamera tidak dapat diakses. Perlu HTTPS.','er')}
}
async function stopScan(){
  if(!qr||!running)return;
  try{await qr.stop();await qr.clear()}catch(e){}
  running=false;torchOn=false;
  $('#bstart').classList.remove('hide');
  $('#bstop').classList.add('hide');
  $('#btorch').classList.add('hide');
}
async function toggleTorch(){
  try{torchOn=!torchOn;await qr.applyVideoConstraints({advanced:[{torch:torchOn}]});$('#btorch').textContent=torchOn?'🔦 Matikan':'🔦 Senter'}catch(e){toast('Senter tidak didukung.','er')}
}
$('#bstart').addEventListener('click',startScan);
$('#bstop').addEventListener('click',stopScan);
$('#btorch').addEventListener('click',toggleTorch);

function onScan(text){
  const now=Date.now();
  if(text===lastCode&&(now-lastTime)<2000)return;
  lastCode=text;lastTime=now;
  beep();vib(80);
  const m=byBc[text.trim()];
  renderResult({bc:text.trim(),master:m});
}

// ==================== TIMELINE ====================
function buildTimeline(brand,expiry,applied,extra){
  const items=[];
  applied=applied||[];extra=extra||[];
  if(!brand||!expiry)return items;
  (brand.rtc||[]).forEach(r=>{
    const key='p'+r.pct;
    items.push({type:'rtc',pct:r.pct,h:r.h,emp:!!r.emp,key,date:addDays(expiry,-r.h),done:applied.includes(key)});
  });
  if(brand.takeout!==null&&brand.takeout!==undefined){
    items.push({type:'takeout',h:brand.takeout,key:'takeout',date:addDays(expiry,-brand.takeout),done:applied.includes('takeout')});
  }
  if(brand.ret!==null&&brand.ret!==undefined){
    items.push({type:'ret',h:brand.ret,key:'ret',date:addDays(expiry,-brand.ret),done:applied.includes('ret')});
  }
  extra.forEach((r,i)=>{
    const date=r.date||addDays(expiry,-(+r.days||0));
    items.push({type:'extra',pct:r.pct,key:'ext'+i,date,done:false,note:r.note||'',days:r.date?daysDiff(expiry,r.date):(+r.days||0)});
  });
  items.sort((a,b)=>a.date.localeCompare(b.date));
  return items;
}

// ==================== HASIL SCAN ====================
function renderResult({bc,master}){
  const box=$('#sr');
  const prod=state.products.find(p=>p.bc===bc);
  const exists=!!prod;
  const today=todayISO();
  const nm=master?master.nm:(prod?prod.nm:'');
  const brand=master?master.brand:buildBrandFromPattern(nm,0,0);
  const p=prod||{bc,nm,expiry:addDays(today,30),patternCode:0,returnH:0,applied:[],extraRtc:[]};
  if(!Array.isArray(p.applied))p.applied=[];
  if(!Array.isArray(p.extraRtc))p.extraRtc=[];

  box.classList.remove('hide');
  box.innerHTML=`
    <div class="hr">
      <div class="bc">${esc(bc)}</div>
      <div class="nm">${esc(nm||'Produk Baru')}</div>
      <div class="src">${exists?'✅ Sudah tersimpan':(master?'📦 Ditemukan di master':'⚠️ Tidak ada di master')}</div>
      ${brand&&brand.rtc?`<div class="brand">Pola RTC #${brand.key.replace('p','')}</div>`:''}
      ${brand&&brand.ret?'<div class="brand">RETURN H-'+brand.ret+'</div>':''}
    </div>
    <form id="pf" class="cd">
      <div class="fr">
        <label for="fnm">Nama Produk <span class="rq">*</span></label>
        <input id="fnm" required value="${esc(p.nm||nm)}">
      </div>
      <div class="fr">
        <label for="fex">Tanggal Kedaluwarsa <span class="rq">*</span></label>
        <input id="fex" type="date" required value="${p.expiry}">
      </div>
      <div class="cd" style="margin:14px 0;background:var(--bg)">
        <h2 style="font-size:14px;margin:0 0 4px">📅 Jadwal RTC, Take Out & Return</h2>
        <div class="mt" style="margin-bottom:10px">Centang yang sudah dijalankan. <span class="badge-emp">KARYAWAN</span> = khusus karyawan.</div>
        <div id="tl" class="tl"></div>
        <div class="mt" id="hd"></div>
        <div class="ext-list" id="extlist"></div>
        <div class="br" style="margin-top:12px">
          <button type="button" class="btn-mini bp" id="baddrtc" style="flex:1">➕ Tambah RTC Manual</button>
        </div>
        <div id="rtcform" class="hide" style="margin-top:12px;background:var(--sur);padding:12px;border-radius:10px;border:1px solid var(--bd)">
          <div class="fr" style="margin-bottom:10px">
            <label for="rtcpct">Persentase Diskon (%)</label>
            <input id="rtcpct" type="number" min="1" max="100" value="85">
          </div>
          <div class="fr" style="margin-bottom:10px">
            <label for="rtcmode">Jadwal</label>
            <select id="rtcmode">
              <option value="h">H-N sebelum kedaluwarsa</option>
              <option value="date">Tanggal spesifik</option>
            </select>
          </div>
          <div class="fr" id="rtcHwrap" style="margin-bottom:10px">
            <label for="rtchari">Berapa hari sebelum kedaluwarsa</label>
            <input id="rtchari" type="number" min="0" max="365" value="1">
          </div>
          <div class="fr hide" id="rtcDwrap" style="margin-bottom:10px">
            <label for="rtcdate">Tanggal</label>
            <input id="rtcdate" type="date">
          </div>
          <div class="fr" style="margin-bottom:10px">
            <label for="rtcnote">Catatan (opsional)</label>
            <input id="rtcnote" type="text" placeholder="mis: Clearance akhir">
          </div>
          <div class="br">
            <button type="button" class="bt bp" id="rtcsave" style="padding:10px">Simpan RTC</button>
            <button type="button" class="bt bs" id="rtccancel" style="padding:10px">Batal</button>
          </div>
        </div>
      </div>
      <div id="ferr" class="mt" style="color:var(--dg)"></div>
      <div class="br">
        <button type="submit" class="bt bp">💾 Simpan Produk</button>
        <button type="button" class="bt bs" id="bcancel">Batal</button>
      </div>
    </form>
  `;

  let applied=p.applied.slice();
  let extraRtc=p.extraRtc.slice();
  const expEl=$('#fex'),tlEl=$('#tl'),hdEl=$('#hd'),extEl=$('#extlist');

  function drawTimeline(){
    const expiry=expEl.value;
    if(!expiry){tlEl.innerHTML='<div class="mt">Isi tanggal kedaluwarsa dulu.</div>';hdEl.textContent='';return}
    const items=buildTimeline(brand,expiry,applied,extraRtc);
    if(!items.length){
      tlEl.innerHTML='<div class="mt">Tidak ada jadwal RTC / return untuk produk ini.</div>';
    } else {
      tlEl.innerHTML=items.map(it=>{
        const diff=daysDiff(todayISO(),it.date);
        let st='pa',stT='Terlewat';
        if(diff>0){st='nw';stT=`Dalam ${diff} hari`}
        else if(diff===0){st='ac';stT='Hari ini'}
        else if(diff>=-3){st='ac';stT=`${-diff} hari lalu`}
        else{st='ur';stT=`Terlewat ${-diff} hari`}
        let cls='takeout',lbl='',hint='';
        if(it.type==='rtc'){cls='p'+it.pct;lbl=`Diskon ${it.pct}%${it.emp?' <span class="badge-emp">KARYAWAN</span>':''}`;hint=`H-${it.h} sebelum kedaluwarsa`}
        else if(it.type==='takeout'){cls='takeout';lbl='TAKE OUT (tarik dari rak)';hint=it.h===0?'Hari H (kedaluwarsa)':`H-${it.h} sebelum kedaluwarsa`}
        else if(it.type==='ret'){cls='ret';lbl='RETURN ke supplier';hint=`H-${it.h} sebelum kedaluwarsa`}
        else if(it.type==='extra'){cls='p'+Math.min(80,it.pct);lbl=`Diskon ${it.pct}% (manual)`;hint=it.days>=0?`H-${it.days}`:'tanggal spesifik'}
        return `<div class="tli ${cls} ${it.done?'done':''}">
          <label class="rtc-row">
            <input type="checkbox" class="rtc-chk" data-key="${it.key}" ${it.done?'checked':''}>
            <div style="flex:1">
              <div class="lb">${lbl}</div>
              <div class="vl">${fmtDI(it.date)}</div>
              <div class="dt">${hint}${it.note?' · '+esc(it.note):''}</div>
              <span class="st ${st}">${stT}</span>
            </div>
          </label>
        </div>`;
      }).join('');
    }
    const expDiff=daysDiff(todayISO(),expiry);
    hdEl.textContent=`Kedaluwarsa: ${fmtDI(expiry)} (${expDiff>=0?'dalam '+expDiff+' hari':'terlewat '+(-expDiff)+' hari'})`;

    if(!extraRtc.length){extEl.innerHTML=''}
    else{
      extEl.innerHTML=`<div class="mt" style="margin-bottom:8px;font-weight:600">RTC Tambahan (${extraRtc.length})</div>`+
        extraRtc.map((r,i)=>{
          const dt=r.date?r.date:(expiry?addDays(expiry,-(+r.days||0)):'');
          const label=r.date?`Tanggal ${fmtDI(r.date)}`:`H-${r.days} (${dt?fmtDI(dt):'—'})`;
          return `<div class="ext-item">
            <div class="info"><div class="ttl">Diskon ${r.pct}%</div>
            <div class="sub">${label}${r.note?' · '+esc(r.note):''}</div></div>
            <button type="button" class="del" data-rm="${i}">✕</button>
          </div>`;
        }).join('');
      extEl.querySelectorAll('[data-rm]').forEach(b=>{
        b.addEventListener('click',()=>{extraRtc.splice(+b.dataset.rm,1);drawTimeline()});
      });
    }
    tlEl.querySelectorAll('.rtc-chk').forEach(chk=>{
      chk.addEventListener('change',()=>{
        const k=chk.dataset.key;
        if(chk.checked){if(!applied.includes(k))applied.push(k)}
        else{applied=applied.filter(x=>x!==k)}
        chk.closest('.tli').classList.toggle('done',chk.checked);
      });
    });
  }

  expEl.addEventListener('input',drawTimeline);
  drawTimeline();

  const rtcForm=$('#rtcform'),rtcMode=$('#rtcmode'),rtcH=$('#rtcHwrap'),rtcD=$('#rtcDwrap');
  $('#baddrtc').addEventListener('click',()=>{
    rtcForm.classList.toggle('hide');
    if(!rtcForm.classList.contains('hide'))$('#rtcdate').value=expEl.value||todayISO();
  });
  rtcMode.addEventListener('change',()=>{
    const isH=rtcMode.value==='h';
    rtcH.classList.toggle('hide',!isH);
    rtcD.classList.toggle('hide',isH);
  });
  $('#rtccancel').addEventListener('click',()=>rtcForm.classList.add('hide'));
  $('#rtcsave').addEventListener('click',()=>{
    const pct=Math.max(1,Math.min(100,+$('#rtcpct').value||0));
    const note=$('#rtcnote').value.trim();
    if(rtcMode.value==='h'){
      const hari=Math.max(0,+$('#rtchari').value||0);
      extraRtc.push({pct,days:hari,note});
    } else {
      const date=$('#rtcdate').value;
      if(!date){toast('Pilih tanggal dulu.','er');return}
      extraRtc.push({pct,date,note});
    }
    $('#rtcnote').value='';rtcForm.classList.add('hide');
    drawTimeline();
    toast('RTC tambahan ditambahkan.','ok');
  });

  $('#bcancel').addEventListener('click',()=>{box.classList.add('hide');box.innerHTML='';lastCode=null});

  $('#pf').addEventListener('submit',async e=>{
    e.preventDefault();
    const nmV=$('#fnm').value.trim();
    const expV=$('#fex').value;
    if(!nmV){$('#ferr').textContent='Nama produk wajib.';return}
    if(!expV){$('#ferr').textContent='Tanggal kedaluwarsa wajib.';return}
    const fresh=byName[nmV.toLowerCase()]||null;
    const pcode=fresh?fresh.brand.key.replace('p','')*1:(p.patternCode||0);
    const retH=fresh&&fresh.brand.ret?fresh.brand.ret:(p.returnH||0);
    const rec={
      bc,nm:nmV,patternCode:pcode,returnH:retH,
      expiry:expV,applied,extraRtc,
      scannedBy:currentUser?(currentUser.username||'unknown'):'unknown',
      scannedByName:currentUser?(currentUser.nama||'-'):'-',
      savedAt:new Date().toISOString()
    };
    const idx=state.products.findIndex(x=>x.bc===bc);
    if(idx>=0)state.products[idx]={...state.products[idx],...rec};
    else state.products.push(rec);
    saveLocal();
    await syncProduct(rec);
    toast('Produk disimpan.','ok');
    box.classList.add('hide');box.innerHTML='';lastCode=null;
    goTo('dash');
  });
  setTimeout(()=>box.scrollIntoView({behavior:'smooth',block:'start'}),80);
}

$('#mbi').addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const v=e.target.value.trim();if(!v)return;e.target.value='';
  let m=byBc[v];
  if(!m)m=byName[v.toLowerCase()];
  if(!m){const found=Object.values(byBc).find(x=>x.nm.toLowerCase().includes(v.toLowerCase()));if(found)m=found}
  if(!m){toast('Produk tidak ditemukan di master.','er');return}
  renderResult({bc:m.bc,master:m});
});

// ==================== DASHBOARD ====================
function brandOfProduct(p){
  const m=byBc[p.bc];
  if(m&&m.brand)return m.brand;
  if(p.patternCode!==undefined)return buildBrandFromPattern(p.nm,p.patternCode,p.returnH);
  return buildBrandFromPattern(p.nm,0,0);
}
function decorate(p){
  const brand=brandOfProduct(p);
  const items=buildTimeline(brand,p.expiry,p.applied,p.extraRtc);
  const today=todayISO();
  const upcoming=items.filter(i=>!i.done&&daysDiff(today,i.date)>=0);
  const next=upcoming[0]||null;
  const expired=daysDiff(today,p.expiry)<0;
  const todayEvents=items.filter(i=>i.date===today);
  return {...p,brand,items,next,expired,todayEvents,totalRtc:items.length,doneRtc:items.filter(i=>i.done).length};
}

let curFilter='all';
function renderDash(){
  const list=state.products.map(decorate);
  const today=todayISO();
  const urgent=list.filter(p=>p.next&&daysDiff(today,p.next.date)<=3).length;
  const todayN=list.filter(p=>p.todayEvents.length>0).length;
  const weekN=list.filter(p=>p.next&&daysDiff(today,p.next.date)<=7).length;
  const retN=list.filter(p=>p.brand.ret!==null&&p.brand.ret!==undefined).length;
  $('#dsum').innerHTML=`
    <div class="si d"><span class="sn">${urgent}</span><span class="sl">Urgent ≤3 hari</span></div>
    <div class="si w"><span class="sn">${todayN}</span><span class="sl">Event Hari Ini</span></div>
    <div class="si w"><span class="sn">${weekN}</span><span class="sl">≤ 7 hari</span></div>
    <div class="si p"><span class="sn">${retN}</span><span class="sl">Ada RETURN</span></div>`;
  let filtered=list;
  if(curFilter==='urgent')filtered=list.filter(p=>p.next&&daysDiff(today,p.next.date)<=3&&daysDiff(today,p.next.date)>=0);
  else if(curFilter==='today')filtered=list.filter(p=>p.todayEvents.length>0);
  else if(curFilter==='week')filtered=list.filter(p=>p.next&&daysDiff(today,p.next.date)<=7&&daysDiff(today,p.next.date)>=0);
  else if(curFilter==='ret')filtered=list.filter(p=>p.brand.ret!==null&&p.brand.ret!==undefined);
  else if(curFilter==='done')filtered=list.filter(p=>p.doneRtc>0);
  filtered.sort((a,b)=>(a.next?.date||'9999').localeCompare(b.next?.date||'9999'));
  const el=$('#plist');
  if(!filtered.length){el.innerHTML=`<div class="em"><div class="ic">📦</div><div>Belum ada produk.</div></div>`;return}
  el.innerHTML=filtered.map(p=>{
    let cls='o',stTxt='Aman';
    const hasTakeoutToday=p.todayEvents.some(e=>e.type==='takeout');
    const hasRetToday=p.todayEvents.some(e=>e.type==='ret');
    const hasRtc80EmpToday=p.todayEvents.some(e=>e.type==='rtc'&&e.emp);
    if(p.expired){cls='e';stTxt='Kedaluwarsa'}
    else if(hasTakeoutToday){cls='h';stTxt='Take Out Hari Ini'}
    else if(hasRetToday){cls='e';stTxt='Return Hari Ini'}
    else if(hasRtc80EmpToday){cls='e';stTxt='RTC 80% Karyawan'}
    else if(p.next){
      const d=daysDiff(today,p.next.date);
      if(d===0){cls='t';stTxt='Hari ini'}
      else if(d<=3){cls='e';stTxt=`${d} hari`}
      else if(d<=7){cls='w';stTxt=`${d} hari`}
      else stTxt=`${d} hari`;
    }
    const tags=[];
    if(p.next){
      if(p.next.type==='rtc')tags.push(`<span class="tg tg-p${p.next.pct}">${p.next.pct}%${p.next.emp?' (kar)':''} · H-${p.next.h}</span>`);
      else if(p.next.type==='takeout')tags.push(`<span class="tg tg-to">TAKE OUT · H-${p.next.h}</span>`);
      else if(p.next.type==='ret')tags.push(`<span class="tg tg-ret">RETURN · H-${p.next.h}</span>`);
      else if(p.next.type==='extra')tags.push(`<span class="tg tg-p80">${p.next.pct}% manual</span>`);
    }
    tags.push(`<span class="tg" style="background:var(--bg);color:var(--mt)">${stTxt}</span>`);
    if(p.totalRtc)tags.push(`<span class="tg" style="background:#ede9fe;color:#5b21b6">RTC ${p.doneRtc}/${p.totalRtc}</span>`);
    return `<div class="li ${cls}">
      <div class="lb2">
        <div class="ln">${esc(p.nm)}</div>
        <div class="lm">${esc(p.bc)} · Exp ${fmtD(p.expiry)}</div>
        <div class="lt">${tags.join('')}</div>
      </div>
      <button class="bt bs" style="width:auto;padding:6px 10px;font-size:12px" data-del="${esc(p.bc)}">🗑</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-del]').forEach(b=>{
    b.addEventListener('click',()=>{
      if(!confirm('Hapus produk ini dari daftar Anda?'))return;
      state.products=state.products.filter(x=>x.bc!==b.dataset.del);
      saveLocal();
      syncDelete(b.dataset.del);
      toast('Produk dihapus.','ok');
      renderDash();
    });
  });
}
$$('#chips .cp').forEach(c=>c.addEventListener('click',()=>{
  $$('#chips .cp').forEach(x=>x.classList.remove('active'));
  c.classList.add('active');curFilter=c.dataset.f;renderDash();
}));

// ==================== THEME ====================
const THEME_KEY='expiry-rtc-theme';
const THEMES=[
  {id:'default',icon:'⚪',nama:'Default',desc:'Tema asli aplikasi (netral)',preview:'linear-gradient(135deg,#f4f5f7 50%,#1f2937 50%)'},
  {id:'malam',icon:'🌙',nama:'Malam',desc:'Langit malam dengan bintang & bulan',preview:'linear-gradient(135deg,#0a0e27 50%,#fcd34d 50%)'},
  {id:'siang',icon:'☀️',nama:'Siang',desc:'Langit biru dengan matahari & awan',preview:'linear-gradient(135deg,#87ceeb 50%,#facc15 50%)'}
];
function applyTheme(id){
  document.body.classList.remove('theme-malam','theme-siang');
  if(id&&id!=='default')document.body.classList.add('theme-'+id);
  try{localStorage.setItem(THEME_KEY,id||'default')}catch(e){}
}
function loadTheme(){try{const t=localStorage.getItem(THEME_KEY);if(t&&t!=='default')applyTheme(t)}catch(e){}}
function renderThemePage(){
  const el=$('#tema-grid');if(!el)return;
  const cur=(function(){try{return localStorage.getItem(THEME_KEY)||'default'}catch(e){return'default'}})();
  el.innerHTML=THEMES.map(t=>{
    const active=t.id===cur;
    return `<div class="usr-item" style="cursor:pointer;${active?'border:2px solid var(--pr);background:rgba(37,99,235,.05)':''}" data-tema="${t.id}">
      <div style="width:56px;height:56px;border-radius:12px;background:${t.preview};flex-shrink:0;border:1px solid rgba(0,0,0,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3)"></div>
      <div class="usr-info">
        <div class="usr-name">${t.icon} ${t.nama}${active?' <span style="color:var(--pr);font-size:11px">✓ Aktif</span>':''}</div>
        <div class="mt" style="margin-top:4px">${t.desc}</div>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-tema]').forEach(b=>{
    b.addEventListener('click',()=>{
      const id=b.dataset.tema;
      applyTheme(id);renderThemePage();
      const t=THEMES.find(x=>x.id===id);
      toast(`Tema ${t?t.nama:id} diterapkan`,'ok');
    });
  });
}
$('#btn-open-settings').addEventListener('click',()=>goTo('set'));
$('#btn-top-setting').addEventListener('click',()=>goTo('set'));

// ==================== USER MANAGEMENT ====================
async function loadUsers(){
  if(!isAdmin())return;
  try{
    const snap=await window.fb.getDocs(window.fb.collection(window.fb.db,'users'));
    const users=[];
    snap.forEach(d=>users.push({id:d.id,...d.data()}));
    users.sort((a,b)=>(a.username||'').localeCompare(b.username||''));
    renderUsers(users);
  }catch(e){console.error('Load users error:',e);toast('Gagal memuat daftar pengguna','er')}
}
function relativeTime(iso){
  if(!iso)return 'belum pernah';
  const diff=Math.floor((Date.now()-new Date(iso).getTime())/1000);
  if(diff<60)return 'baru saja';
  if(diff<3600)return Math.floor(diff/60)+' menit lalu';
  if(diff<86400)return Math.floor(diff/3600)+' jam lalu';
  return Math.floor(diff/86400)+' hari lalu';
}
function renderUsers(users){
  $('#usr-count').textContent=users.length;
  if(currentUser){
    const initial=(currentUser.nama||currentUser.username||'?').charAt(0).toUpperCase();
    const selfBg=document.body.classList.contains('theme-malam')?'rgba(99,102,241,.15)':
                 document.body.classList.contains('theme-siang')?'rgba(2,132,199,.1)':'#eff6ff';
    $('#usr-self').style.background=selfBg;
    $('#usr-self').style.borderColor='var(--bd)';
    $('#usr-self').innerHTML=`
      <div style="display:flex;gap:12px;align-items:center">
        <div class="usr-avatar">${initial}</div>
        <div style="flex:1">
          <div class="usr-name">${esc(currentUser.nama)}</div>
          <div class="usr-meta">
            <span>@${esc(currentUser.username || currentUser.id || '-')}</span>
            <span class="role-badge role-${currentUser.role}">${currentUser.role.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <button class="bt bs" style="margin-top:12px;padding:9px;color:var(--dg);border-color:var(--dg)" id="usr-logout">🚪 Keluar</button>`;
    setTimeout(()=>{
      const lo=$('#usr-logout');
      if(lo)lo.addEventListener('click',logout);
    },0);
  }
  const el=$('#usr-list');
  if(!users.length){el.innerHTML='<div class="em" style="padding:30px 10px">Belum ada pengguna.</div>';return}
  el.innerHTML=users.map(u=>{
    const initial=(u.nama||u.username||'?').charAt(0).toUpperCase();
    const myId = currentUser && (currentUser.username || currentUser.id);
    const isSelf = currentUser && u.username === myId;
    const lastSeen=u.lastSeen||u.lastLogin;
    return `<div class="usr-item">
      <div class="usr-avatar">${initial}</div>
      <div class="usr-info">
        <div class="usr-name">${esc(u.nama||'-')}${isSelf?' <span style="color:var(--mt);font-weight:400">(Anda)</span>':''}</div>
        <div class="usr-meta">
          <span>@${esc(u.username||'-')}</span>
          <span class="role-badge role-${u.role||'staff'}">${(u.role||'staff').toUpperCase()}</span>
          <span>${relativeTime(lastSeen)}</span>
        </div>
      </div>
      <div class="usr-actions">
        ${isOwner()&&!isSelf?`<button class="usr-btn" data-role="${esc(u.username)}" title="Ubah Role">🎭</button>`:''}
        ${canEditUser(u.role||'staff')||isSelf?`<button class="usr-btn" data-reset="${esc(u.username)}" title="Reset password">🔑</button>`:''}
        ${!isSelf&&canEditUser(u.role||'staff')?`<button class="usr-btn danger" data-del="${esc(u.username)}" title="Hapus">🗑</button>`:''}
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-del]').forEach(b=>{
    b.addEventListener('click',async()=>{
      const u=b.dataset.del;
      if(!confirm(`Hapus pengguna @${u}?`))return;
      try{
        await window.fb.deleteDoc(window.fb.doc(window.fb.db,'users',u));
        toast(`Pengguna @${u} dihapus`,'ok');
        loadUsers();
      }catch(e){toast('Gagal hapus: '+e.message,'er')}
    });
  });
  el.querySelectorAll('[data-role]').forEach(b=>{
    b.addEventListener('click',()=>changeUserRole(b.dataset.role));
  });
  el.querySelectorAll('[data-reset]').forEach(b=>{
    b.addEventListener('click',async()=>{
      const u=b.dataset.reset;
      const np=prompt(`Password baru untuk @${u}:`);
      if(!np)return;
      if(np.length<6){toast('Minimal 6 karakter','er');return}
      try{
        await window.fb.setDoc(window.fb.doc(window.fb.db,'users',u),{password:np},{merge:true});
        toast(`Password @${u} direset`,'ok');
      }catch(e){toast('Gagal: '+e.message,'er')}
    });
  });
}
async function changeUserRole(username){
  if(!isOwner()){toast('Hanya owner yang bisa ubah role','er');return}
  const myId=currentUser&&(currentUser.username||currentUser.id);
  if(username===myId){toast('Tidak bisa ubah role sendiri','er');return}
  let target=null;
  try{
    const snap=await window.fb.getDoc(window.fb.doc(window.fb.db,'users',username));
    if(snap.exists())target={id:snap.id,...snap.data()};
  }catch(e){}
  if(!target){toast('User tidak ditemukan','er');return}
  const curRole=target.role||'staff';
  const input=prompt(`Ubah role untuk:\n\n${target.nama||username} (@${username})\n\nRole sekarang: ${curRole.toUpperCase()}\n\nKetik role baru:\n- staff\n- admin\n- owner`,curRole);
  if(input===null)return;
  const newRole=input.trim().toLowerCase();
  if(!['staff','admin','owner'].includes(newRole)){toast('Role harus: staff, admin, atau owner','er');return}
  if(newRole===curRole){toast('Role tidak berubah','er');return}
  if(!confirm(`Ubah role @${username}\nDari: ${curRole.toUpperCase()}\nKe: ${newRole.toUpperCase()}\n\nLanjut?`))return;
  try{
    const byUser = (currentUser && (currentUser.username || currentUser.id)) || '-';
    await window.fb.setDoc(window.fb.doc(window.fb.db,'users',username),
      {role:newRole,roleChangedAt:new Date().toISOString(),roleChangedBy:byUser},{merge:true});
    toast(`Role @${username} → ${newRole.toUpperCase()}`,'ok');
    loadUsers();
  }catch(e){toast('Gagal ubah role: '+e.message,'er')}
}

async function addUser(){
  const username=$('#usr-new-user').value.trim().toLowerCase();
  const password=$('#usr-new-pass').value;
  const nama=$('#usr-new-nama').value.trim();
  const role=$('#usr-new-role').value;
  const msg=$('#usr-add-msg');
  msg.style.color='var(--dg)';
  if(!/^[a-z0-9_]{3,20}$/.test(username)){msg.textContent='Username harus 3-20 huruf kecil/angka/underscore';return}
  if(password.length<6){msg.textContent='Password minimal 6 karakter';return}
  if(!nama){msg.textContent='Nama lengkap wajib diisi';return}
  if(role==='owner'&&!isOwner()){msg.textContent='Hanya owner yang bisa membuat akun owner';return}
  try{
    const snap=await window.fb.getDocs(window.fb.collection(window.fb.db,'users'));
    let exists=false;
    snap.forEach(d=>{if(d.id===username)exists=true});
    if(exists){msg.textContent='Username sudah dipakai';return}
    await window.fb.setDoc(window.fb.doc(window.fb.db,'users',username),
      {username,password,nama,role,createdAt:new Date().toISOString()});
    msg.style.color='var(--ok)';
    msg.textContent=`✅ Pengguna @${username} ditambahkan`;
    $('#usr-new-user').value='';
    $('#usr-new-pass').value='';
    $('#usr-new-nama').value='';
    $('#usr-new-role').value='staff';
    loadUsers();
  }catch(e){msg.textContent='Gagal: '+e.message}
}
$('#usr-add-btn').addEventListener('click',addUser);

// ==================== LOG LOGIN ====================
let logCache=[];

async function loadLoginLogs(){
  if(!isOwner())return;
  try{
    const snap=await window.fb.getDocs(window.fb.collection(window.fb.db,'login_log'));
    logCache=[];
    snap.forEach(d=>logCache.push({id:d.id,...d.data()}));
    logCache.sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')));
    $('#log-count').textContent=`Total: ${logCache.length} log`;
    renderLogList(logCache);
  }catch(e){console.error('Load logs error:',e);toast('Gagal memuat log','er')}
}

function fmtTime(iso){
  if(!iso)return '-';
  const d=new Date(iso);
  const bulan=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getDate())} ${bulan[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function detectDevice(ua){
  ua=(ua||'').toLowerCase();
  if(ua.includes('android'))return '📱 Android';
  if(ua.includes('iphone')||ua.includes('ipad'))return '📱 iOS';
  if(ua.includes('windows'))return '💻 Windows';
  if(ua.includes('mac'))return '💻 Mac';
  if(ua.includes('linux'))return '💻 Linux';
  return '❓ Unknown';
}
function renderLogList(list){
  const el=$('#log-list');
  if(!list.length){
    el.innerHTML='<div class="cd"><div class="em" style="padding:24px 10px">Belum ada log.</div></div>';
    return;
  }
  const shown=list.slice(0,200);
  el.innerHTML=`<div class="cd"><h2>Riwayat (${list.length}${list.length>200?', tampil 200':''})</h2>`+
    shown.map(l=>{
      const roleCls=l.role==='owner'?'role-owner':(l.role==='admin'?'role-admin':'role-staff');
      return `<div class="usr-item">
        <div class="usr-avatar">${esc((l.nama||l.username||'?').charAt(0).toUpperCase())}</div>
        <div class="usr-info">
          <div class="usr-name">${esc(l.nama||'-')}</div>
          <div class="usr-meta">
            <span>@${esc(l.username||'-')}</span>
            <span class="role-badge ${roleCls}">${(l.role||'staff').toUpperCase()}</span>
          </div>
          <div class="mt" style="margin-top:4px">🕒 ${fmtTime(l.timestamp)} · ${detectDevice(l.ua)}</div>
        </div>
      </div>`;
    }).join('')+'</div>';
}

function filterLogs(){
  const q=($('#log-search').value||'').trim().toLowerCase();
  if(!q){renderLogList(logCache);return}
  const filtered=logCache.filter(l=>
    String(l.username||'').toLowerCase().includes(q)||
    String(l.nama||'').toLowerCase().includes(q));
  renderLogList(filtered);
}

$('#log-search-btn').addEventListener('click',filterLogs);
$('#log-search').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();filterLogs()}
});
$('#log-refresh').addEventListener('click',loadLoginLogs);
$('#log-clear').addEventListener('click',async()=>{
  if(!isOwner()){toast('Hanya owner','er');return}
  const cutoff=Date.now()-(30*24*60*60*1000);
  if(!confirm('Hapus log lebih dari 30 hari ke belakang?'))return;
  let count=0;
  for(const l of logCache){
    const t=new Date(l.timestamp||0).getTime();
    if(t&&t<cutoff){
      try{
        await window.fb.deleteDoc(window.fb.doc(window.fb.db,'login_log',l.id));
        count++;
      }catch(e){}
    }
  }
  toast(`Dihapus ${count} log lama`,'ok');
  loadLoginLogs();
});

// ==================== MIGRASI ====================
async function migrateMasterToFirestore(){
  const msg=$('#migrate-msg');
  msg.style.color='var(--mt)';
  msg.textContent='Menghitung...';
  const M=window.MASTER;
  if(!M||!M.length){msg.style.color='var(--dg)';msg.textContent='master.js tidak ditemukan atau kosong';return}
  const total=M.length;
  try{
    const existing=await window.fb.getDocs(window.fb.collection(window.fb.db,'master'));
    if(existing.size>0){
      if(!confirm(`Sudah ada ${existing.size} produk di Firebase. Lanjut akan MENIMPA. Lanjut?`)){msg.textContent='Dibatalkan.';return}
    }
  }catch(e){}
  let done=0,error=0;
  msg.textContent=`Mengupload 0 / ${total}...`;
  const BATCH=400;
  for(let i=0;i<total;i+=BATCH){
    try{
      const batch=window.fb.writeBatch(window.fb.db);
      const slice=M.slice(i,i+BATCH);
      slice.forEach(row=>{
        const [bc,nm,pcode,retH]=row;
        if(!bc)return;
        const ref=window.fb.doc(window.fb.db,'master',String(bc));
        batch.set(ref,{bc:String(bc),nm:nm||'',patternCode:pcode||0,returnH:retH||0,
          updatedAt:new Date().toISOString(),updatedBy:currentUser?(currentUser.username||'system'):'system'});
      });
      await batch.commit();
      done+=slice.length;
      msg.textContent=`Mengupload ${done} / ${total}...`;
    }catch(e){console.error('Batch error:',e);error+=1}
  }
  if(error===0){
    msg.style.color='var(--ok)';
    msg.textContent=`✅ Selesai! ${done} produk berhasil diupload.`;
    toast(`${done} produk berhasil dimigrasi`,'ok');
  } else {
    msg.style.color='var(--dg)';
    msg.textContent=`⚠️ ${done} berhasil, ${error} batch gagal.`;
  }
}

async function exportMasterJS(){
  const msg = $('#export-master-msg');
  msg.style.color = 'var(--mt)';
  msg.textContent = 'Membaca data...';
  try{
    const snap = await window.fb.getDocs(
      window.fb.collection(window.fb.db, 'master')
    );
    const rows = [];
    snap.forEach(d => {
      const x = d.data();
      if(x.bc && x.nm){
        rows.push(`['${x.bc}','${String(x.nm).replace(/'/g,"\\'")}',${x.patternCode||0},${x.returnH||0}]`);
      }
    });
    rows.sort();
    const content = 
`// master.js — Backup dari Firestore
// Total: ${rows.length} produk
// Dibuat: ${new Date().toISOString()}

const P = {
  0: null,
  1: [7, 5, 3, 2],
  2: [30, 14, 7, 3],
  3: [14, 7, 5, 3],
  4: [10, 7, 5, 2],
  5: [3, 2, 1],
  6: [5, 3, 2, 1],
  7: [4, 3, 2, 1],
  8: [7, null, null, null],
  9: [30, null, null, null],
  10: [14, null, null, null],
  11: [3, null, null, null],
};

const MASTER = [
${rows.join(',\n')}
];

window.P = P;
window.MASTER = MASTER;
`;
    const blob = new Blob([content], {type:'text/javascript'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'master.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    msg.style.color = 'var(--ok)';
    msg.textContent = `✅ ${rows.length} produk diekspor ke master.js`;
    toast(`Export selesai: ${rows.length} produk`, 'ok');
  }catch(e){
    msg.style.color = 'var(--dg)';
    msg.textContent = 'Gagal: ' + e.message;
  }
}

$('#btn-export-master').addEventListener('click', exportMasterJS);
$('#btn-migrate').addEventListener('click',async()=>{
  if(!confirm('Mulai migrasi master.js ke Firebase? Proses 1-3 menit.'))return;
  $('#btn-migrate').disabled=true;
  $('#btn-migrate').textContent='⏳ Sedang upload...';
  await migrateMasterToFirestore();
  $('#btn-migrate').disabled=false;
  $('#btn-migrate').textContent='⬆ Migrasi Master Sekarang';
});

// ==================== MASTER PRODUK PAGE ====================
let masterCache=[];
let masterLoaded=false;

function patternLabel(code){
  const arr=window.P[code];
  if(!arr)return '(tanpa RTC)';
  const pcts=[30,50,70,80];
  const parts=[];
  for(let i=0;i<arr.length;i++){
    if(arr[i]==null)continue;
    parts.push(`${pcts[i]}%@H-${arr[i]}`);
  }
  return parts.join(' → ')||'(kosong)';
}
function fillPatternDropdown(){
  const sel=$('#mst-new-pattern');
  if(!sel||sel.options.length>0)return;
  Object.keys(window.P).forEach(k=>{
    const code=parseInt(k);
    const opt=document.createElement('option');
    opt.value=code;
    opt.textContent=`Pola ${code}: ${patternLabel(code)}`;
    sel.appendChild(opt);
  });
}
async function loadMasterFromFirestore(){
  if(masterLoaded)return masterCache;
  try{
    const snap=await window.fb.getDocs(window.fb.collection(window.fb.db,'master'));
    masterCache=[];
    snap.forEach(d=>masterCache.push({id:d.id,...d.data()}));
    masterCache.sort((a,b)=>String(a.nm||'').localeCompare(String(b.nm||'')));
    masterLoaded=true;
    console.log(`📚 Master dari Firebase: ${masterCache.length} produk`);
    return masterCache;
  }catch(e){console.error('Load master error:',e);toast('Gagal memuat master','er');return[]}
}
function renderMasterList(list,keyword){
  const el=$('#mst-results');
  if(!list.length){
    el.innerHTML='<div class="cd"><div class="em" style="padding:24px 10px">📭 Tidak ada produk cocok.</div></div>';
    return;
  }
  const shown=list.slice(0,100);
  const title=keyword
    ? `Hasil untuk "${esc(keyword)}" (${list.length}${list.length>100?', tampil 100':''})`
    : `Semua produk (${list.length}${list.length>100?', tampil 100':''})`;
  el.innerHTML=`<div class="cd"><h2>${title}</h2>`+
    shown.map(m=>{
      let patLabel;
      if(Array.isArray(m.customRtc)&&m.customRtc.length){
        const pcts=[30,50,70,80,90];
        const parts=[];
        m.customRtc.forEach((h,i)=>{if(h!=null)parts.push(`${pcts[i]}%@H-${h}`)});
        patLabel=parts.join(' → ')||'(tanpa RTC)';
      } else {
        patLabel=patternLabel(m.patternCode||0);
      }
      const retLabel=(m.returnH&&m.returnH>0)?`Return H-${m.returnH}`:'Tanpa return';
      return `<div class="usr-item" style="align-items:flex-start">
        <div class="usr-info">
          <div class="usr-name">${esc(m.nm||'-')}</div>
          <div class="usr-meta" style="margin-bottom:6px">
            <span style="font-family:monospace">${esc(m.bc)}</span>
          </div>
          <div class="mt" style="margin-bottom:2px">${patLabel}</div>
          <div class="mt">${retLabel}</div>
        </div>
        <div class="usr-actions">
          <button class="usr-btn" data-edit="${esc(m.bc)}" title="Edit RTC">✏️</button>
          <button class="usr-btn danger" data-del="${esc(m.bc)}" title="Hapus">🗑</button>
        </div>
      </div>`;
    }).join('')+'</div>';

  el.querySelectorAll('[data-edit]').forEach(b=>{
    b.addEventListener('click',()=>openMasterEdit(b.dataset.edit));
  });
  el.querySelectorAll('[data-del]').forEach(b=>{
    b.addEventListener('click',async()=>{
      const bc=b.dataset.del;
      const m=masterCache.find(x=>x.bc===bc);
      const nama=m?m.nm:bc;
      const isOwnerRole=currentUser&&currentUser.role==='owner';
      const confirmMsg=isOwnerRole
        ? `Hapus "${nama}" dari master?\n\nAnda OWNER — tanpa batasan harian.`
        : `Hapus "${nama}" dari master?\n\n⚠️ Sebagai ADMIN, hanya 1 produk per hari.`;
      if(!confirm(confirmMsg))return;
      const today=todayISO();
      try{
        if(!isOwnerRole){
          const logRef=window.fb.doc(window.fb.db,'deletion_log',today);
          const snap=await window.fb.getDoc(logRef);
          let count=0,items=[];
          if(snap.exists()){const d=snap.data();count=d.count||0;items=d.items||[]}
          if(count>=1){toast('Admin hanya bisa hapus 1 produk/hari.','er');return}
          await window.fb.setDoc(logRef,{count:count+1,items:[...items,bc],
            deletedBy:currentUser?(currentUser.username||'-'):'-',deletedAt:new Date().toISOString()},{merge:true});
        }
        await window.fb.deleteDoc(window.fb.doc(window.fb.db,'master',bc));
        masterCache=masterCache.filter(x=>x.bc!==bc);
        await refreshMasterFromFS();
        toast('Produk dihapus dari master','ok');
        doMasterSearch();
        $('#mst-count').textContent=`Total: ${masterCache.length} produk`;
      }catch(e){toast('Gagal hapus: '+e.message,'er')}
    });
  });
}
async function loadMasterPage(){
  if(!isAdmin())return;
  fillPatternDropdown();
  const list=await loadMasterFromFirestore();
  $('#mst-count').textContent=`Total: ${list.length} produk`;
  const kw=$('#mst-search').value.trim();
  if(kw)doMasterSearch();
  else $('#mst-results').innerHTML='';
}
let currentEditBc=null;
function openMasterEdit(bc){
  const m=masterCache.find(x=>x.bc===bc);
  if(!m)return;
  currentEditBc=bc;
  $('#rtc-modal-product').textContent=`${m.nm} — ${m.bc}`;
  let cr=m.customRtc;
  if(!Array.isArray(cr)){
    const pat=window.P[m.patternCode]||[];
    cr=[pat[0],pat[1],pat[2],pat[3],null];
  }
  $('#rtc-30').value=cr[0]!=null?cr[0]:'';
  $('#rtc-50').value=cr[1]!=null?cr[1]:'';
  $('#rtc-70').value=cr[2]!=null?cr[2]:'';
  $('#rtc-80').value=cr[3]!=null?cr[3]:'';
  $('#rtc-90').value=cr[4]!=null?cr[4]:'';
  $('#rtc-ret').value=m.returnH||0;
  $('#rtc-pattern').value='';
  $('#rtc-modal-msg').textContent='';
  $('#rtc-modal').classList.remove('hide');
}
function closeRtcModal(){$('#rtc-modal').classList.add('hide');currentEditBc=null}
$('#rtc-modal-close').addEventListener('click',closeRtcModal);
$('#rtc-modal-cancel').addEventListener('click',closeRtcModal);
$('#rtc-modal').addEventListener('click',e=>{if(e.target===$('#rtc-modal'))closeRtcModal()});
$('#rtc-modal-save').addEventListener('click',async()=>{
  if(!currentEditBc)return;
  const msg=$('#rtc-modal-msg');
  msg.style.color='var(--dg)';
  const patSel=$('#rtc-pattern').value;
  let update={};
  if(patSel!==''){
    update.patternCode=parseInt(patSel);
    update.customRtc=[];
  } else {
    const g=id=>{const v=$(id).value.trim();return v===''?null:parseInt(v)};
    const h30=g('#rtc-30'),h50=g('#rtc-50'),h70=g('#rtc-70'),h80=g('#rtc-80'),h90=g('#rtc-90');
    const ret=parseInt($('#rtc-ret').value)||0;
    if([h30,h50,h70,h80,h90].every(v=>v===null)){msg.textContent='Isi minimal 1 level diskon atau pilih pola standar';return}
    update.customRtc=[h30,h50,h70,h80,h90];
    update.returnH=ret;
    update.patternCode=0;
  }
  update.updatedAt=new Date().toISOString();
  update.updatedBy=currentUser?(currentUser.username||'-'):'-';
  try{
    await window.fb.setDoc(window.fb.doc(window.fb.db,'master',currentEditBc),update,{merge:true});
    const m=masterCache.find(x=>x.bc===currentEditBc);
    if(m)Object.assign(m,update);
    await refreshMasterFromFS();
    toast('RTC tersimpan. Berlaku untuk semua staf.','ok');
    closeRtcModal();
    doMasterSearch();
  }catch(e){msg.textContent='Gagal: '+e.message}
});
async function addMasterProduct(){
  const bc=$('#mst-new-bc').value.trim();
  const nm=$('#mst-new-nm').value.trim();
  const patternCode=parseInt($('#mst-new-pattern').value);
  const returnH=parseInt($('#mst-new-ret').value);
  const msg=$('#mst-add-msg');
  msg.style.color='var(--dg)';
  if(!bc){msg.textContent='Barcode wajib diisi';return}
  if(!nm){msg.textContent='Nama produk wajib diisi';return}
  if(masterCache.some(x=>x.bc===bc)){msg.textContent='Barcode sudah ada di master';return}
  try{
    await window.fb.setDoc(window.fb.doc(window.fb.db,'master',bc),
      {bc,nm,patternCode,returnH,createdAt:new Date().toISOString(),
       updatedBy:currentUser?(currentUser.username||'-'):'-'});
    masterCache.push({bc,nm,patternCode,returnH});
    masterCache.sort((a,b)=>String(a.nm||'').localeCompare(String(b.nm||'')));
    msg.style.color='var(--ok)';
    msg.textContent=`✅ ${nm} ditambahkan ke master`;
    $('#mst-new-bc').value='';
    $('#mst-new-nm').value='';
    await refreshMasterFromFS();
    $('#mst-count').textContent=`Total: ${masterCache.length} produk`;
    doMasterSearch();
  }catch(e){msg.textContent='Gagal: '+e.message}
}
$('#mst-add-btn').addEventListener('click',addMasterProduct);
function doMasterSearch(){
  const q=$('#mst-search').value.trim().toLowerCase();
  if(!q){$('#mst-results').innerHTML='';return}
  const filtered=masterCache.filter(m=>
    String(m.bc||'').toLowerCase().includes(q)||
    String(m.nm||'').toLowerCase().includes(q));
  renderMasterList(filtered,q);
}
$('#mst-search-btn').addEventListener('click',doMasterSearch);
$('#mst-search').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();doMasterSearch()}
});
$('#mst-toggle-add').addEventListener('click',()=>{
  const f=$('#mst-add-form');
  const i=$('#mst-toggle-add-icon');
  f.classList.toggle('hide');
  i.textContent=f.classList.contains('hide')?'buka ▾':'tutup ▴';
});

// ==================== GANTI PASSWORD ====================
function openChangePasswordModal(){
  $('#pw-old').value='';
  $('#pw-new').value='';
  $('#pw-new2').value='';
  $('#pw-msg').textContent='';
  $('#pw-modal').classList.remove('hide');
  setTimeout(()=>$('#pw-old').focus(),100);
}
function closeChangePasswordModal(){$('#pw-modal').classList.add('hide')}
async function changeOwnPassword(oldPass,newPass){
  if(!currentUser)return {error:'Belum login'};
  const uname=currentUser.username||currentUser.id;
  if(!uname)return {error:'Username tidak valid'};
  if(newPass.length<6)return {error:'Password baru minimal 6 karakter'};
  if(oldPass===newPass)return {error:'Password baru sama dengan lama'};
  try{
    const snap=await window.fb.getDocs(window.fb.collection(window.fb.db,'users'));
    let me=null;
    snap.forEach(d=>{if(d.id===uname)me=d.data()});
    if(!me)return {error:'Akun tidak ditemukan'};
    if(me.password!==oldPass)return {error:'Password lama salah'};
    await window.fb.setDoc(window.fb.doc(window.fb.db,'users',uname),
      {password:newPass,passwordChangedAt:new Date().toISOString()},{merge:true});
    return {ok:true};
  }catch(e){return {error:'Gagal: '+e.message}}
}
$('#pw-close').addEventListener('click',closeChangePasswordModal);
$('#pw-cancel').addEventListener('click',closeChangePasswordModal);
$('#pw-modal').addEventListener('click',e=>{if(e.target===$('#pw-modal'))closeChangePasswordModal()});
$('#pw-save').addEventListener('click',async()=>{
  const oldP=$('#pw-old').value;
  const newP=$('#pw-new').value;
  const newP2=$('#pw-new2').value;
  const msg=$('#pw-msg');
  msg.style.color='var(--dg)';
  if(!oldP){msg.textContent='Isi password lama';return}
  if(newP!==newP2){msg.textContent='Konfirmasi tidak cocok';return}
  const r=await changeOwnPassword(oldP,newP);
  if(r.error){msg.textContent=r.error;return}
  msg.style.color='var(--ok)';
  msg.textContent='✅ Password berhasil diganti';
  toast('Password diganti.','ok');
  setTimeout(closeChangePasswordModal,1200);
});
$('#login-form').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const u=$('#login-user').value.trim().toLowerCase();
  const p=$('#login-pass').value;
  const btn=$('#login-btn');
  const err=$('#login-err');
  err.textContent='';
  btn.disabled=true;
  btn.textContent='Memuat...';
  const r=await tryLogin(u,p);
  btn.disabled=false;
  btn.textContent='Masuk';
  if(r.error){err.textContent=r.error;return}
  showApp();
  await refreshMasterFromFS();
  toast(`Selamat datang, ${currentUser.nama}!`,'ok');
  goTo('scan');
});

// ==================== SETTINGS ====================
function renderSet(){
  $('#stats').innerHTML=`Master: <b>${Object.keys(byBc).length}</b> produk · Produk saya: <b>${state.products.length}</b>`;
  $('#mcount').textContent=Object.keys(byBc).length;
  $('#nEn').checked=state.settings.notif;
  const el=$('#set-user-info');
  if(el&&currentUser){
    el.innerHTML=`
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
        <div class="usr-avatar">${(currentUser.nama||'?').charAt(0).toUpperCase()}</div>
        <div style="flex:1">
          <div class="usr-name">${esc(currentUser.nama)}</div>
          <div class="usr-meta">
            <span>@${esc(currentUser.username || currentUser.id || '-')}</span>
            <span class="role-badge role-${currentUser.role}">${currentUser.role.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <button class="bt bs" id="set-chpw" style="margin-bottom:8px">🔑 Ganti Password</button>
      <button class="bt" style="background:var(--dg);color:#fff" id="set-logout">🚪 Keluar dari Akun</button>`;
    setTimeout(()=>{
      const b=$('#set-logout');
      if(b)b.addEventListener('click',logout);
      const cp=$('#set-chpw');
      if(cp)cp.addEventListener('click',openChangePasswordModal);
    },0);
  }
}
$('#bSaveS').addEventListener('click',()=>{
  state.settings.notif=$('#nEn').checked;
  saveLocal();toast('Pengaturan disimpan.','ok');
});
$('#bExp').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='expiry-rtc-backup.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Data diekspor.','ok');
});
$('#bImp').addEventListener('click',()=>$('#fileImp').click());
$('#fileImp').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const txt=await f.text();const d=JSON.parse(txt);
    if(d.products)state.products=d.products;
    if(d.settings)state.settings={...state.settings,...d.settings};
    saveLocal();toast('Data diimpor.','ok');renderSet();
  }catch(err){toast('File tidak valid.','er')}
});
$('#bRst').addEventListener('click',()=>{
  if(!confirm('Hapus semua produk yang Anda simpan?'))return;
  state.products=[];saveLocal();toast('Data direset.','ok');renderSet();
});

// ==================== NOTIFIKASI ====================
$('#bn').addEventListener('click',()=>{
  if(!state.settings.notif){toast('Notifikasi dinonaktifkan.','er');return}
  const today=todayISO();
  const list=state.products.map(decorate);
  const hariIni=[],hariH=[],urgent=[];
  list.forEach(p=>p.items.forEach(i=>{
    if(i.date===today){
      hariIni.push({p,i});
      if(i.type==='takeout'||(i.type==='rtc'&&i.emp))hariH.push({p,i});
    }
  }));
  list.forEach(p=>p.items.forEach(i=>{
    const d=daysDiff(today,i.date);
    if(d>0&&d<=3)urgent.push({p,i,d});
  }));
  let body=`📅 Tanggal: ${fmtDI(today)}\n\n`;
  body+=`━━━ A. EVENT HARI INI (${hariIni.length}) ━━━\n`;
  if(hariIni.length){
    hariIni.forEach((x,k)=>{
      let label='';
      if(x.i.type==='rtc')label=`Diskon ${x.i.pct}%${x.i.emp?' (KARYAWAN)':''}`;
      else if(x.i.type==='takeout')label='TAKE OUT (tarik dari rak)';
      else if(x.i.type==='ret')label='RETURN ke supplier';
      else if(x.i.type==='extra')label=`Diskon ${x.i.pct}% (manual)`;
      body+=`${k+1}. ${x.p.nm}\n   Barcode: ${x.p.bc}\n   Aksi: ${label}\n   Exp: ${x.p.expiry}\n`;
    });
  } else body+='(Tidak ada)\n';
  body+=`\n━━━ B. PERHATIAN HARI H (${hariH.length}) ━━━\n`;
  if(hariH.length){
    hariH.forEach((x,k)=>{
      const label=x.i.type==='takeout'?'TAKE OUT':'Diskon 80% KARYAWAN';
      body+=`${k+1}. ${x.p.nm}\n   Barcode: ${x.p.bc}\n   Aksi: ${label}\n`;
    });
  } else body+='(Tidak ada)\n';
  body+=`\n━━━ C. URGENT 3 HARI KE DEPAN (${urgent.length}) ━━━\n`;
  if(urgent.length){
    urgent.sort((a,b)=>a.d-b.d);
    urgent.forEach((x,k)=>{
      let label='';
      if(x.i.type==='rtc')label=`Diskon ${x.i.pct}%${x.i.emp?' (kar)':''}`;
      else if(x.i.type==='takeout')label='TAKE OUT';
      else if(x.i.type==='ret')label='RETURN';
      else if(x.i.type==='extra')label=`Diskon ${x.i.pct}% manual`;
      body+=`${k+1}. [${x.d} hari lagi] ${x.p.nm}\n   Aksi: ${label} · Tgl: ${x.i.date}\n`;
    });
  } else body+='(Tidak ada)\n';
  $('#mtitle').textContent='🔔 Notifikasi Harian';
  $('#mbody').textContent=body;
  $('#modal').classList.remove('hide');
});
$('#mclose').addEventListener('click',()=>$('#modal').classList.add('hide'));
$('#mok').addEventListener('click',()=>$('#modal').classList.add('hide'));
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))$('#modal').classList.add('hide')});
$('#mcopy').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('#mbody').textContent);toast('Disalin.','ok')}
  catch(e){toast('Gagal menyalin.','er')}
});

// ==================== BOOT ====================
loadTheme();
if(typeof window.P==='undefined'||typeof window.MASTER==='undefined'){
  document.body.innerHTML='<div class="pg"><div class="cd"><h2>⚠️ master.js tidak ditemukan</h2>'+
    '<p class="mt">Pastikan file <b>master.js</b> ada di folder yang sama.</p></div></div>';
} else {
  loadLocal();
  goTo('scan');
  (async()=>{
    for(let i=0;i<100&&!window.fbReady;i++){
      await new Promise(r=>setTimeout(r,100));
    }
    if(!window.fbReady){
      toast('⚠️ Firebase tidak bisa dimuat.','er');
      return;
    }
    await ensureAdminExists();
    loadSession();
    if(isLoggedIn()){
      showApp();
      await refreshMasterFromFS();
      const ok=await loadFromFirestore();
      if(ok){
        startRealtimeSync();
        if(curPage==='dash')renderDash();
        if(curPage==='set')renderSet();
      }
    } else {
      showLogin();
    }
  })();
}