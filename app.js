const CFG=window.SI_CONFIG||{};let DB={premises:[],summary:{},analytics:{},imports:[]},map=null,markerLayer=null,heatLayer=null,currentMapMode='pins',pendingImport=null;const $=id=>document.getElementById(id),fmt=n=>Number(n||0).toLocaleString('en-MY'),pct=(n,d)=>d?Math.round(n/d*100):0,apiUrl=()=>CFG.API_URL,esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));function toast(m){const t=$('toast');t.textContent=m;t.style.whiteSpace='pre-line';t.style.maxWidth='460px';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),Math.max(2500,String(m).length*45))}
function jsonp(action,params={}){return new Promise((resolve,reject)=>{if(!apiUrl()||apiUrl().includes('PASTE_'))return reject(new Error('API_URL belum ditetapkan dalam config.js'));const cb='si_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script'),q=new URLSearchParams({action,callback:cb,...params});const timer=setTimeout(()=>{cleanup();reject(new Error('API timeout'))},30000);function cleanup(){clearTimeout(timer);delete window[cb];s.remove()}window[cb]=d=>{cleanup();d&&d.ok===false?reject(new Error(d.error||'API error')):resolve(d)};s.onerror=()=>{cleanup();reject(new Error('Tidak dapat hubungi API'))};s.src=apiUrl()+'?'+q;document.body.appendChild(s)})}
function initNav(){document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+b.dataset.view).classList.add('active');$('filters').style.display=['dashboard','analytics','map','premises'].includes(b.dataset.view)?'grid':'none';$('pageTitle').textContent={dashboard:'Dashboard Pemantauan Premis',analytics:'Advanced Analytics',map:'Map Intelligence',premises:'Senarai Premis',import:'Import Data FoSIM',history:'Import History'}[b.dataset.view];if(b.dataset.view==='history')renderImportHistory();if(b.dataset.view==='map')setTimeout(()=>initFullMap(),80)})}
function initMap(){map=L.map('map',{preferCanvas:true}).setView([4.2,102.2],6);const g=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:'Tiles © Esri'}),s=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}),sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'});g.addTo(map);L.control.layers({'Peta Ringkas':g,'Peta Jalan':s,'Satelit':sat}).addTo(map);markerLayer=L.layerGroup().addTo(map)}
let fullMap=null;function initFullMap(){if(fullMap){fullMap.invalidateSize();return}fullMap=L.map('mapFull').setView([4.2,102.2],6);L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:'Tiles © Esri'}).addTo(fullMap);filteredPremises().forEach(p=>addMarker(fullMap,p));fitMap(fullMap,filteredPremises())}function statusColor(s){return s==='CURRENT'?'#0da35a':s==='DUE'?'#e6a00a':s==='OVERDUE'?'#e93a4c':'#7259d6'}function addMarker(target,p){if(!Number.isFinite(+p.latitude)||!Number.isFinite(+p.longitude))return;L.circleMarker([+p.latitude,+p.longitude],{radius:6,color:'#fff',weight:2,fillColor:statusColor(p.status),fillOpacity:.95}).bindPopup(`<b>${esc(p.premiseName)}</b><br><small>${esc(p.premiseId)} • ${esc(p.district)}</small><br><small>${esc(p.status)} • Risk ${p.riskScore||0}</small>`).addTo(target)}function fitMap(target,rows){const pts=rows.filter(p=>Number.isFinite(+p.latitude)&&Number.isFinite(+p.longitude)).map(p=>[+p.latitude,+p.longitude]);if(pts.length)target.fitBounds(L.latLngBounds(pts).pad(.08))}
function filters(){return{year:$('yearFilter').value,state:$('stateFilter').value,district:$('districtFilter').value,type:$('typeFilter').value,grade:$('gradeFilter').value,q:$('searchBox').value.trim().toLowerCase()}}function filteredPremises(){const f=filters();return(DB.premises||[]).filter(p=>{if(f.state!=='ALL'&&p.state!==f.state)return false;if(f.district!=='ALL'&&p.district!==f.district)return false;if(f.grade!=='ALL'&&p.lastGrade!==f.grade)return false;if(f.q&&!(`${p.premiseName} ${p.premiseId} ${p.address}`.toLowerCase().includes(f.q)))return false;return true})}function fillSelect(id,vals,label){const s=$(id),old=s.value;s.innerHTML=`<option value="ALL">${label}</option>`;[...new Set(vals.filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;s.appendChild(o)});if([...s.options].some(o=>o.value===old))s.value=old}function populateFilters(){fillSelect('stateFilter',(DB.premises||[]).map(x=>x.state),'Semua Negeri');fillSelect('districtFilter',(DB.premises||[]).map(x=>x.district),'Semua Daerah');fillSelect('yearFilter',DB.analytics?.years||[],'Semua Tahun');fillSelect('typeFilter',(DB.analytics?.inspectionTypes||[]).map(x=>x.name),'Semua Jenis Pemeriksaan')}
function renderMap(){markerLayer.clearLayers();if(heatLayer){map.removeLayer(heatLayer);heatLayer=null}const rows=filteredPremises().filter(p=>Number.isFinite(+p.latitude)&&Number.isFinite(+p.longitude));if(currentMapMode==='heat'&&L.heatLayer)heatLayer=L.heatLayer(rows.map(p=>[+p.latitude,+p.longitude,Math.max(.15,(p.riskScore||0)/100)]),{radius:32,blur:27,minOpacity:.25,maxZoom:12,gradient:{.15:'#24c56a',.45:'#ffd33d',.72:'#ff8234',1:'#e92542'}}).addTo(map);else rows.filter(p=>currentMapMode!=='high'||(p.riskScore||0)>=65).forEach(p=>addMarker(markerLayer,p));fitMap(map,rows)}
function renderDashboard(){const s=DB.summary||{},rows=filteredPremises(),total=rows.length||s.premises||0,ins=rows.filter(p=>p.inspectionCount>0).length,nev=rows.filter(p=>p.status==='NEVER').length,ov=rows.filter(p=>p.status==='OVERDUE').length;$('kPremises').textContent=fmt(total);$('kInspected').textContent=fmt(ins);$('kInspectedPct').textContent=pct(ins,total)+'% coverage';$('kNever').textContent=fmt(nev);$('kNeverPct').textContent=pct(nev,total)+'% premis';$('kOverdue').textContent=fmt(ov);$('kClosure').textContent=fmt(s.closures||0);$('kNotice').textContent=fmt(s.notice32b||0);const pri=[...rows].sort((a,b)=>(b.riskScore||0)-(a.riskScore||0)).slice(0,12);$('priorityCount').textContent=rows.filter(p=>(p.riskScore||0)>=65).length;$('priorityList').innerHTML=pri.map(p=>`<div class="priority"><div class="risk" style="background:${statusColor(p.status)}">${p.riskScore||0}</div><div><b>${esc(p.premiseName)}</b><small>${esc(p.premiseId)} • ${esc(p.district)}<br>${esc(p.status)} • ${p.inspectionAgeDays??'-'} hari</small></div></div>`).join('');renderTypeBars();renderGrade();renderPremises();renderAnalytics();renderMap()}
function renderTypeBars(){const a=DB.analytics?.inspectionTypes||[],m=Math.max(1,...a.map(x=>x.count));$('typeBars').innerHTML=a.slice(0,10).map(x=>`<div class="barrow"><div class="barlabel"><span>${esc(x.name)}</span><b>${fmt(x.count)}</b></div><div class="track"><div class="fill" style="width:${x.count/m*100}%"></div></div></div>`).join('')}function renderGrade(){const g=DB.analytics?.grades||{A:0,B:0,C:0,U:0},t=Math.max(1,g.A+g.B+g.C+g.U),a=[['A',g.A,'#0da35a'],['B',g.B,'#e6a00a'],['C',g.C,'#e93a4c'],['Tiada',g.U,'#9aa8b8']];$('gradeBar').innerHTML=a.map(x=>`<span style="width:${x[1]/t*100}%;background:${x[2]}">${x[1]?pct(x[1],t)+'%':''}</span>`).join('');$('gradeLegend').innerHTML=a.map(x=>`<div><b style="color:${x[2]}">${x[0]}</b><br>${fmt(x[1])}</div>`).join('')}function renderAnalytics(){const a=DB.analytics||{},b=a.ageBuckets||[];$('ageBuckets').innerHTML=b.map(x=>`<div class="barrow"><div class="barlabel"><span>${esc(x.label)}</span><b>${fmt(x.count)}</b></div><div class="track"><div class="fill" style="width:${x.pct||0}%"></div></div></div>`).join('');$('districtTable').querySelector('tbody').innerHTML=(a.districts||[]).map(x=>`<tr><td>${esc(x.district)}</td><td>${fmt(x.premises)}</td><td>${fmt(x.inspected)}</td><td>${x.coverage||0}%</td><td>${fmt(x.overdue)}</td><td>${fmt(x.closures)}</td></tr>`).join('')}function renderPremises(){const r=filteredPremises();$('premiseCount').textContent=fmt(r.length)+' premis';$('premiseTable').querySelector('tbody').innerHTML=r.slice(0,500).map(p=>`<tr><td>${esc(p.premiseId)}</td><td>${esc(p.premiseName)}</td><td>${esc(p.district)}</td><td>${esc(p.category)}</td><td>${esc(p.lastInspectionDate||'-')}</td><td>${esc(p.lastGrade||'-')}</td><td>${esc(p.status||'-')}</td></tr>`).join('')}function renderImportHistory(){$('importTable').querySelector('tbody').innerHTML=(DB.imports||[]).map(x=>`<tr><td>${esc(x.timestamp)}</td><td>${esc(x.fileName)}</td><td>${fmt(x.rows)}</td><td>${fmt(x.accepted)}</td><td>${fmt(x.duplicates)}</td><td>${esc(x.status)}</td></tr>`).join('')}
async function loadDashboard(){try{$('apiState').textContent='loading';const d=await jsonp('dashboard',{thresholdDays:CFG.DEFAULT_THRESHOLD_DAYS||365});DB=d.data||d;$('apiState').textContent='online';populateFilters();renderDashboard();renderImportHistory()}catch(e){$('apiState').textContent='offline';toast(e.message);console.error(e)}}
/* ===== KMM101 parser (robust header detection) ===== */
const squash=v=>String(v??"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const H={
  NEGERI:"Nama Negeri",DAERAH:"Nama Daerah",
  TARIKHPEMERIKSAAN:"Tarikh Pemeriksaan",JENISPEMERIKSAAN:"Jenis Pemeriksaan",
  NAMAPREMIS:"Nama Premis",NOPENDAFTARANPREMISFOSIM:"No. Pendaftaran Premis-FoSIM",
  NOPENDAFTARANPREMIS:"No. Pendaftaran Premis-FoSIM",
  NAMANEGERI:"Nama Negeri",NAMADAERAH:"Nama Daerah",
  NAMAPEGAWAIYANGMENJALANKANPEMERIKSAAN:"Nama Pegawai yang Menjalankan Pemeriksaan",
  JAWATANPKPPPKPPTM:"Jawatan (PKP/PPKP/PTM)",NAMASYARIKAT:"Nama Syarikat",ALAMATSYARIKAT:"Alamat Syarikat",
  NAMAPEMILIKPREMIS:"Nama Pemilik Premis",ALAMATPREMIS:"Alamat Premis",
  KATEGORIPREMISP0P4:"Kategori Premis (P0-P4)",KATEGORIPREMIS:"Kategori Premis (P0-P4)",
  SUBKATEGORIPREMIS:"Sub Kategori Premis",JENISBORANGPEMERIKSAAN:"Jenis Borang Pemeriksaan",
  STATUSPENDAFTARANMENGIKUTPPKM2009:"Status Pendaftaran Mengikut PPKM 2009",
  MARKAHPENILAIANTAHAPKEBERSIHANPREMIS:"Markah Penilaian tahap kebersihan premis (%)",
  GRED:"Gred",ARAHANPENUTUPAN:"Arahan Penutupan",SEBABPENUTUPAN:"Sebab Penutupan",
  PENGELUARANNOTISSEKSYEN32B:"Pengeluaran Notis Seksyen 32B",BULAN:"Bulan"
};
const HKEYS=Object.keys(H).sort((a,b)=>b.length-a.length);
const ANCHORS=["Nama Negeri","Nama Daerah","Tarikh Pemeriksaan","Jenis Pemeriksaan","Nama Premis","No. Pendaftaran Premis-FoSIM","Markah Penilaian tahap kebersihan premis (%)","Gred"];
const REQUIRED_DISPLAY=["Nama Negeri","Nama Daerah","Tarikh Pemeriksaan","Jenis Pemeriksaan","Nama Premis","No. Pendaftaran Premis-FoSIM"];

// Padan tepat dahulu; jika tiada, padan "mengandungi" (cth. "Nama Premis *", "1. Nama Negeri")
function canonicalHeaderName(h){
  const s=squash(h);
  if(!s) return "";
  if(H[s]) return H[s];
  for(const k of HKEYS){ if(k.length>=8 && s.length<=k.length+20 && s.includes(k)) return H[k]; }
  return String(h??"").replace(/\s+/g," ").trim();
}
function headerScore(row){
  const found=new Set((row||[]).map(canonicalHeaderName));
  return ANCHORS.filter(a=>found.has(a)).length;
}
function detectHeader(matrix){
  let best={row:-1,score:0};
  const limit=Math.min(100,matrix.length);
  for(let r=0;r<limit;r++){
    const sc=headerScore(matrix[r]||[]);
    if(sc>best.score) best={row:r,score:sc};
  }
  return best.score>=3?best:{row:-1,score:best.score,nearest:best.row};
}
function cellToValue(v){
  if(v instanceof Date && !isNaN(v)){
    // +12 jam supaya ralat saat/zon masa SheetJS tidak menukar hari
    const d=new Date(v.getTime()+12*3600*1000);
    return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
  }
  return v==null?"":String(v).replace(/ /g," ").trim();
}

function readWorkbook(file){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:"array",cellDates:true,cellText:true,dateNF:"yyyy-mm-dd"});
        let best=null; const seen=[];
        wb.SheetNames.forEach(sheetName=>{
          const ws=wb.Sheets[sheetName];
          if(!ws||!ws["!ref"]) return;
          const matrix=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,dateNF:"yyyy-mm-dd",defval:"",blankrows:false});
          const d=detectHeader(matrix);
          const first=(matrix[d.row>=0?d.row:Math.max(0,d.nearest??0)]||[]).map(cellToValue).filter(Boolean).slice(0,8);
          seen.push(`[${sheetName}] ${matrix.length} baris, padanan ${d.score}/8${first.length?" -> "+first.join(" | "):""}`);
          if(d.row<0) return;
          if(!best||d.score>best.score) best={sheetName,matrix,hr:d.row,score:d.score};
        });
        if(!best){
          throw new Error("Format KMM101 tidak dikenali. Header tidak dijumpai.\n"+(seen.join("\n")||"Fail kosong.")+"\nPastikan fail ialah laporan KMM101 FoSIM asal (ada lajur Nama Negeri, Nama Daerah, Tarikh Pemeriksaan, ...).");
        }
        // Hanya simpan lajur yang dikenali (KMM101 ada ~56 lajur; backend cuma guna ~22)
        const KEEP=new Set(Object.values(H)),seenH=new Set();
        const headers=(best.matrix[best.hr]||[]).map(h=>{const c=canonicalHeaderName(h);if(!KEEP.has(c)||seenH.has(c))return "";seenH.add(c);return c});
        const live=headers.filter(Boolean);
        const all=best.matrix.slice(best.hr+1).filter(r=>(r||[]).some(v=>cellToValue(v)!==""))
          .map(r=>{const o={};headers.forEach((h,i)=>{if(h)o[h]=cellToValue(r[i])});return o});
        // Baris tanpa tarikh / No. FoSIM (baris sambungan atau footer) akan ditolak backend; langkau di sini
        const rows=all.filter(o=>o["Tarikh Pemeriksaan"]&&o["No. Pendaftaran Premis-FoSIM"]);
        const missing=REQUIRED_DISPLAY.filter(h=>!live.includes(h));
        resolve({sheet:best.sheetName,headers:live,rows,skipped:all.length-rows.length,headerRow:best.hr+1,score:best.score,missing});
      }catch(err){reject(err)}
    };
    fr.onerror=()=>reject(new Error("Fail Excel tidak dapat dibaca."));
    fr.readAsArrayBuffer(file);
  });
}


/* ===== Progress tracker ===== */
const STEPS=[['read','Baca fail Excel'],['header','Kesan header KMM101'],['clean','Bersih & pilih lajur'],['begin','Sambung ke Google Sheets'],['upload','Upload data ke staging'],['final','Deduplicate & simpan ke History'],['refresh','Refresh dashboard']];
let stepState={},runTimer=null,runStart=0;
function pipeInit(){stepState={};STEPS.forEach(([k])=>stepState[k]={s:'pending',d:'',pct:null});pipeRender();$('importLog').innerHTML='';$('pipeTimer').textContent=''}
function setStep(k,s,d,pct){const o=stepState[k]||{};stepState[k]={s,d:d===undefined?(o.d||''):d,pct:pct===undefined?(s==='active'?o.pct:null):pct};pipeRender()}
function pipeRender(){const ic={pending:'○',active:'◔',done:'✓',error:'✗'};$('pipeline').innerHTML=STEPS.map(([k,l],i)=>{const x=stepState[k]||{s:'pending',d:'',pct:null};return`<div class="pstep ${x.s}"><span class="pic">${ic[x.s]}</span><div><b>${i+1}. ${l}</b>${x.d?`<small>${esc(x.d)}</small>`:''}${x.pct!=null?`<div class="pbar"><i style="width:${x.pct}%"></i></div>`:''}</div></div>`}).join('')}
function logLine(m,cls){const L=$('importLog'),t=new Date().toLocaleTimeString('en-GB');L.insertAdjacentHTML('beforeend',`<div class="${cls||''}">[${t}] ${esc(m)}</div>`);L.scrollTop=L.scrollHeight}
function startClock(){runStart=Date.now();clearInterval(runTimer);runTimer=setInterval(()=>{$('pipeTimer').textContent='⏱ '+fmtSec((Date.now()-runStart)/1000)},500)}
function stopClock(){clearInterval(runTimer)}
function fmtSec(s){s=Math.round(s);return s>=60?Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s':s+'s'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ===== Hantar data ke Apps Script ===== */
function postForm(action,payload,ms){ms=ms||60000;return new Promise((res,rej)=>{const token='si_'+Date.now()+'_'+Math.random().toString(36).slice(2);payload._token=token;const h=e=>{if(e.data?.source!=='SmartInspectionAPI'||e.data?.token!==token)return;clearTimeout(tm);window.removeEventListener('message',h);e.data.ok?res(e.data):rej(new Error(e.data.error||'Import gagal'))};window.addEventListener('message',h);const tm=setTimeout(()=>{window.removeEventListener('message',h);rej(new Error('Tiada respons daripada Apps Script dalam '+Math.round(ms/1000)+' saat. Semak: API_URL (hujung /exec), deployment "Anyone", dan Code.gs versi terbaru sudah di-deploy.'))},ms);$('siUploadForm').action=apiUrl();$('formAction').value=action;$('formPayload').value=JSON.stringify(payload);$('siUploadForm').submit()})}
async function postRetry(action,payload,ms,label){let last;for(let a=1;a<=3;a++){try{return await postForm(action,Object.assign({},payload),ms)}catch(e){last=e;logLine(`${label} gagal (percubaan ${a}/3): ${e.message}`,'err');if(a<3)await sleep(1500*a)}}throw last}

async function processImport(){
  if(!pendingImport)return;
  if(!apiUrl()||apiUrl().includes('PASTE_')){toast('API_URL belum ditetapkan dalam config.js');return}
  const{file,parsed}=pendingImport,chunk=CFG.IMPORT_CHUNK_SIZE||750,id='IMP-'+Date.now(),total=parsed.rows.length,n=Math.ceil(total/chunk),btn=$('processImportBtn');
  btn.disabled=true;btn.textContent='Sedang proses…';$('importResult').classList.add('hidden');
  ['begin','upload','final','refresh'].forEach(k=>setStep(k,'pending',''));startClock();
  let cur='begin';
  try{
    setStep('begin','active','Menghubungi Apps Script…');logLine('Mula import '+id+' • '+fmt(total)+' baris • '+n+' chunk');
    await postRetry('beginImport',{importId:id,fileName:file.name,totalRows:total,headers:parsed.headers},60000,'Sambungan');
    setStep('begin','done','ID '+id);logLine('Sambungan OK, sheet staging sedia','ok');
    cur='upload';const tu=Date.now();
    for(let i=0,c=1;i<total;i+=chunk,c++){
      const end=Math.min(i+chunk,total),pct=Math.round(i/total*100);
      let eta='';if(c>1){const per=(Date.now()-tu)/(c-1);eta=' • baki ≈ '+fmtSec(per*(n-c+1)/1000)}
      setStep('upload','active',`Chunk ${c}/${n} • ${fmt(i)} → ${fmt(end)} / ${fmt(total)} baris (${pct}%)${eta}`,pct);
      const r=await postRetry('importChunk',{importId:id,offset:i,rows:parsed.rows.slice(i,end)},90000,'Chunk '+c);
      logLine(`Chunk ${c}/${n} diterima: ${fmt(r.accepted)} baris diterima`);
    }
    setStep('upload','done',`${fmt(total)} baris dalam ${n} chunk (${fmtSec((Date.now()-tu)/1000)})`,100);
    cur='final';const tf=Date.now();
    logLine('Semua chunk dihantar. Menjalankan dedup & simpan (boleh ambil 1–5 minit; JANGAN tutup tab)…');
    const tick=setInterval(()=>setStep('final','active','Menyemak duplicate & menulis ke INSPECTION_HISTORY… '+fmtSec((Date.now()-tf)/1000)+' berlalu (jangan tutup tab)'),1000);
    let done;try{done=await postForm('finalizeImport',{importId:id},600000)}finally{clearInterval(tick)}
    setStep('final','done',`Accepted ${fmt(done.accepted)} • Duplicate ${fmt(done.duplicates)} • Rejected ${fmt(done.rejected)} (${fmtSec((Date.now()-tf)/1000)})`);
    logLine(`Siap simpan: ${fmt(done.accepted)} baru, ${fmt(done.duplicates)} duplicate, ${fmt(done.rejected)} ditolak`,'ok');
    cur='refresh';setStep('refresh','active','Memuat semula data dashboard…');
    $('importResult').classList.remove('hidden');
    $('importResult').innerHTML=`<div class="cardhead"><h3>✅ Import selesai: ${esc(file.name)}</h3></div><div style="padding:14px">Processed ${fmt(done.rows)} • Accepted ${fmt(done.accepted)} • Duplicate ${fmt(done.duplicates)} • Rejected ${fmt(done.rejected)} • Masa ${fmtSec((Date.now()-runStart)/1000)}</div>`;
    await loadDashboard();
    if($('apiState').textContent==='online'){setStep('refresh','done',`${fmt((DB.premises||[]).length)} premis dalam dashboard`);logLine('Dashboard dikemas kini. SELESAI.','ok')}
    else{setStep('refresh','error','Import berjaya, tetapi dashboard gagal dimuat semula. Tekan ↻ Refresh.');logLine('Dashboard gagal dimuat semula (data import sudah selamat disimpan).','err')}
  }catch(e){
    setStep(cur,'error',e.message);logLine('GAGAL pada langkah "'+(STEPS.find(x=>x[0]===cur)||[])[1]+'": '+e.message,'err');toast(e.message);
    if(cur==='upload'||cur==='final')logLine('Data staging tidak ditulis ke History jika finalize tidak selesai. Boleh cuba semula (duplicate akan ditapis automatik).','err');
  }finally{stopClock();$('pipeTimer').textContent='⏱ '+fmtSec((Date.now()-runStart)/1000);btn.disabled=false;btn.textContent='Process Import'}
}
function initImport(){const i=$('fileInput'),d=$('dropzone');pipeInit();$('selectFileBtn').onclick=()=>i.click();i.onchange=()=>handleFile(i.files[0]);['dragenter','dragover'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.add('drag')}));['dragleave','drop'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.remove('drag')}));d.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));$('processImportBtn').onclick=processImport}
async function handleFile(file){
  if(!file)return;pendingImport=null;pipeInit();$('processImportBtn').classList.add('hidden');$('importResult').classList.add('hidden');
  const mb=(file.size/1048576).toFixed(1);startClock();
  setStep('read','active',`Membaca ${file.name} (${mb} MB)… fail besar boleh ambil 15–60 saat, halaman mungkin kelihatan beku seketika`);logLine('Membaca '+file.name+' ('+mb+' MB)');await sleep(80);
  try{
    const p=await readWorkbook(file),missing=p.missing;
    setStep('read','done',`${p.sheet} • ${fmtSec((Date.now()-runStart)/1000)}`);
    setStep('header','done',`Header di baris ${p.headerRow} • padanan ${p.score}/8`+(missing.length?' • TIADA: '+missing.join(', '):''));
    if(missing.length){setStep('header','error','Lajur wajib tiada: '+missing.join(', '));logLine('Lajur wajib tiada: '+missing.join(', '),'err')}
    else{setStep('clean','done',`${fmt(p.rows.length)} baris sah • ${fmt(p.skipped)} dilangkau (tiada tarikh/No. FoSIM) • ${p.headers.length} lajur digunakan`);logLine(`Fail sedia: ${fmt(p.rows.length)} baris sah. Tekan "Process Import".`,'ok')}
    pendingImport={file,parsed:p};
    $('filePreview').classList.remove('hidden');
    $('filePreview').innerHTML=`<b>${esc(file.name)}</b><br>Sheet: ${esc(p.sheet)} • header baris ${p.headerRow}<br>${fmt(p.rows.length)} rows sah${p.skipped?' ('+fmt(p.skipped)+' baris dilangkau: tiada tarikh/No. FoSIM)':''} • ${p.headers.length} lajur digunakan • ${missing.length?'Lajur wajib tiada: '+esc(missing.join(', ')):'✓ KMM101 recognised'}`;
    $('processImportBtn').classList.toggle('hidden',!!missing.length);
  }catch(e){
    const hdr=String(e.message).startsWith('Format KMM101');
    if(hdr){setStep('read','done','Fail berjaya dibaca');setStep('header','error','Header KMM101 tidak dijumpai')}else setStep('read','error',e.message);
    logLine(e.message,'err');toast(e.message);
  }finally{stopClock()}
}
function initEvents(){initNav();initImport();$('refreshBtn').onclick=loadDashboard;['stateFilter','districtFilter','gradeFilter','yearFilter','typeFilter'].forEach(id=>$(id).onchange=renderDashboard);$('searchBox').oninput=renderDashboard;document.querySelectorAll('[data-mapmode]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-mapmode]').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentMapMode=b.dataset.mapmode;renderMap()})}window.addEventListener('load',()=>{initEvents();initMap();loadDashboard()});
console.info('SmartInspection app.js PATCH v4 (progress tracker)');
