const $ = s => document.querySelector(s);
const tabs = [...document.querySelectorAll('.tab')];
function showTab(id){
  tabs.forEach(t=>t.classList.toggle('active',t.id===id));
  document.querySelectorAll('.nav[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
}
document.querySelectorAll('.nav[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
document.querySelectorAll('[data-tab-jump]').forEach(b=>b.onclick=()=>showTab(b.dataset.tabJump));
async function getJSON(url){const sep=url.includes('?')?'&':'?';const r=await fetch(`${url}${sep}_=${Date.now()}`,{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Erro');return j}

function resultBox(title, status=''){
  const p=$('#resultPanel');
  if(!p) return;
  p.style.display='block';
  $('#resultTitle').textContent=title;
  $('#resultStatus').textContent=status;
  $('#resultText').textContent='';
  $('#resultAudio').style.display='none';
  $('#resultAudio').removeAttribute('src');
  p.scrollIntoView({behavior:'smooth',block:'start'});
}
function setBusy(btn,busy,label){
  if(!btn) return;
  if(busy){ btn.dataset.old=btn.textContent; btn.disabled=true; btn.textContent=label||'Gerando...'; }
  else { btn.disabled=false; btn.textContent=btn.dataset.old||btn.textContent; }
}
async function generateText(kind, btn){
  setBusy(btn,true,'Gerando...');
  resultBox(kind==='sermon'?'Pregação':'Oração','Conectando ao motor de IA...');
  try{
    const data=await getJSON('/api/program');
    const wanted=kind==='sermon'?'Palavra':'Oração';
    const item=(data.queue||[]).find(x=>x.label===wanted);
    if(!item?.text) throw new Error('O motor não retornou o conteúdo esperado.');
    $('#resultStatus').textContent=`${data.showName} • ${data.host?.nome||''}`;
    $('#resultText').textContent=item.text;
  }catch(e){
    $('#resultStatus').textContent='Erro ao gerar';
    $('#resultText').textContent=e.message;
  }finally{ setBusy(btn,false); }
}
async function generateJingle(btn){
  setBusy(btn,true,'Gerando...');
  resultBox('Vinheta','Gerando chamada da rádio...');
  try{
    const data=await getJSON('/api/jingle');
    $('#resultStatus').textContent=data.program||'Web Rádio Vem Comigo Deus';
    $('#resultText').textContent=data.text;
  }catch(e){ $('#resultStatus').textContent='Erro ao gerar'; $('#resultText').textContent=e.message; }
  finally{ setBusy(btn,false); }
}
async function generateSong(btn){
  setBusy(btn,true,'Preparando...');
  resultBox('Louvor original','Escolhendo um louvor original da biblioteca...');
  try{
    const data=await getJSON('/api/songs');
    if(!data.songs?.length) throw new Error('Nenhum louvor encontrado.');
    const song=data.songs[Math.floor(Math.random()*data.songs.length)];
    $('#resultText').textContent=`${song.titulo}
Estilo: ${song.estilo}

Gerando o MP3 no servidor... Aguarde até terminar.`;
    $('#resultStatus').textContent='Gerando louvor com IA...';
    const prepared=await getJSON(`/api/prepare-song?id=${encodeURIComponent(song.id)}&t=${Date.now()}`);
    const audio=$('#resultAudio');
    audio.src=prepared.url+`?t=${Date.now()}`;
    audio.style.display='block';
    $('#resultStatus').textContent='Louvor pronto para ouvir';
    $('#resultText').textContent=`${song.titulo}
Estilo: ${song.estilo}

MP3 gerado e salvo na biblioteca. Ouvir novamente não gera outra chamada.`;
    audio.load();
    try{ await audio.play(); }catch{}
    await load();
  }catch(e){
    $('#resultStatus').textContent='Não foi possível gerar o louvor';
    $('#resultText').textContent=e.message;
  }finally{ setBusy(btn,false); }
}


async function prepareToday(btn){
  setBusy(btn,true,'Preparando...');
  resultBox('Programação de hoje','Gerando apenas o necessário: no máximo 4 vozes hoje.');
  try{
    const data=await getJSON('/api/prepare-day');
    const rows=(data.results||[]).map(x=>`${x.nome}: ${x.status==='cached'?'já estava pronto':'gerado agora'}`).join('\n');
    const q=data.quota;
    $('#resultStatus').textContent='Programação preparada e guardada no cache';
    $('#resultText').textContent=`${rows}\n\nUso de hoje\nVoz TTS: ${q.tts}/${q.limits.tts}\nTexto: ${q.text}/${q.limits.text}\nMúsica: ${q.music}/${q.limits.music}\n\nAbrir o site ou ouvir novamente não gasta nova chamada enquanto os arquivos continuarem no cache.`;
    await load();
  }catch(e){ $('#resultStatus').textContent='Não foi possível preparar tudo'; $('#resultText').textContent=e.message; }
  finally{ setBusy(btn,false); }
}

function bind(id,fn){ const b=$(id); if(b) b.addEventListener('click',()=>fn(b)); }
bind('#quickPrepare', prepareToday);
bind('#genSermon', b=>generateText('sermon',b));
bind('#genPrayer', b=>generateText('prayer',b));
bind('#genSong', generateSong);
bind('#genJingle', generateJingle);
bind('#quickSermon', b=>{showTab('conteudo');generateText('sermon',$('#genSermon'));});
bind('#quickPrayer', b=>{showTab('conteudo');generateText('prayer',$('#genPrayer'));});
bind('#quickSong', b=>{showTab('conteudo');generateSong($('#genSong'));});
bind('#quickJingle', b=>{showTab('conteudo');generateJingle($('#genJingle'));});
bind('#quickLibrary', ()=>showTab('biblioteca'));
bind('#quickOnAir', ()=>showTab('sinal'));
if($('#closeResult')) $('#closeResult').onclick=()=>$('#resultPanel').style.display='none';

async function load(){
  try{
    const [s,songs] = await Promise.all([getJSON('/api/status'),getJSON('/api/songs')]);
    const cur=s.current;
    $('#currentShow').textContent=cur?.nome||(s.filler?.nome||'Louvores que Edificam');
    if(cur){
      $('#currentHost').textContent=`Com ${s.voices[cur.apresentador].nome} • ${cur.inicio}–${cur.fim}`;
    }else{
      const h=Math.floor((s.untilNext||0)/60), m=(s.untilNext||0)%60;
      const falta=h>0?`${h}h${String(m).padStart(2,'0')}`:`${m} min`;
      $('#currentHost').textContent=`Rotação automática de louvores • Próximo: ${s.next.nome} às ${s.next.inicio} • falta ${falta}`;
    }
    $('#clock').textContent=s.now.full+' • Brasília';
    const lib=await getJSON('/api/library');
    $('#apiState').textContent=s.configured?`IA: conectada • Voz ${s.quota.tts}/${s.quota.limits.tts} hoje • Biblioteca ${lib.count} áudios`:'IA: chave não configurada';
    if($('#quotaNote')) $('#quotaNote').textContent=`Modo econômico ativo • preparados ${s.prepared}/4 programas • TTS ${s.quota.tts}/${s.quota.limits.tts} • Texto ${s.quota.text}/${s.quota.limits.text} • Música ${s.quota.music}/${s.quota.limits.music}`;
    $('#statCurrent').textContent=cur?.nome||(s.filler?.nome||'Louvores que Edificam');
    $('#statNext').textContent=`${s.next.inicio} • ${s.next.nome}`;
    $('#statSongs').textContent=`${songs.songs.length} originais • biblioteca ${lib.count}`;
    const schedule = [
      ['09:00–10:00','Bom Dia Deus','Pastor Luiz Felipe','Puck'],
      ['12:30–13:00','Encontro com Deus','Missionária Ingrid Laura','Sulafat'],
      ['18:00–19:00','Tarde da Benção','Pastor Bernardo Henrique','Achird'],
      ['19:00–21:00','Culto No Seu Lar','Pastor Heitor Cruz','Charon']
    ];
    $('#scheduleMini').innerHTML=schedule.map(x=>`<div class="schedule-row"><b>${x[0].split('–')[0]}</b><div><strong>${x[1]}</strong><span> • ${x[2]}</span></div><span>${x[0]}</span></div>`).join('');
    $('#programGrid').innerHTML=schedule.map(x=>`<article class="program-card"><div class="time">${x[0]}</div><div><h3>${x[1]}</h3><p>${x[2]}</p></div><span class="voice">Voz ${x[3]}</span></article>`).join('');
    $('#songLibrary').innerHTML=songs.songs.map(x=>`<article class="library-item"><small>${x.estilo.toUpperCase()}</small><h3>${x.titulo}</h3><p>Louvor original da Web Rádio Vem Comigo Deus.</p></article>`).join('');
  }catch(e){
    $('#currentShow').textContent='Painel em modo local';
    $('#currentHost').textContent='Inicie o servidor Node para carregar o status da automação.';
    $('#apiState').textContent='Servidor desconectado';
  }
}
load();setInterval(load,15000);


// ===== Biblioteca local do celular (teste sem upload) =====
const localState = { items: [], index: -1, shuffle: false, running: false };
function fmtSize(n){ if(n<1024*1024) return `${Math.max(1,Math.round(n/1024))} KB`; return `${(n/1024/1024).toFixed(1)} MB`; }
function localRender(){
  const box=$('#localFiles'), count=$('#localCount');
  if(!box||!count) return;
  count.textContent=`${localState.items.length} arquivo${localState.items.length===1?'':'s'}`;
  count.className='badge '+(localState.items.length?'ready':'pending');
  if(!localState.items.length){ box.innerHTML='<p class="muted">Sua seleção local aparecerá aqui.</p>'; return; }
  box.innerHTML=localState.items.map((x,i)=>`<div class="local-file ${i===localState.index?'active':''}" data-local-index="${i}"><span class="kind">${x.kind==='pregacao'?'🎙️':'🎵'}</span><div class="info"><strong title="${x.name.replace(/"/g,'&quot;')}">${x.name}</strong><small>${x.kind==='pregacao'?'Pregação rápida':'Louvor'} • ${fmtSize(x.file.size)}</small></div></div>`).join('');
  box.querySelectorAll('[data-local-index]').forEach(el=>el.onclick=()=>localPlay(Number(el.dataset.localIndex),true));
}
function addLocalFiles(list,kind){
  const existing=new Set(localState.items.map(x=>`${x.name}|${x.file.size}|${x.file.lastModified}`));
  [...list].filter(f=>f.type.startsWith('audio/')||/\.mp3$/i.test(f.name)).forEach(file=>{
    const key=`${file.name}|${file.size}|${file.lastModified}`;
    if(existing.has(key)) return;
    localState.items.push({file,name:file.name,kind,url:URL.createObjectURL(file)}); existing.add(key);
  });
  localRender();
}
function localPickNext(step=1){
  const n=localState.items.length; if(!n) return -1;
  if(localState.shuffle && n>1){ let j; do{j=Math.floor(Math.random()*n)}while(j===localState.index); return j; }
  if(localState.index<0) return 0;
  return (localState.index+step+n)%n;
}
async function localPlay(index,fromUser=false){
  if(index<0||index>=localState.items.length) return;
  const audio=$('#localAudio'), item=localState.items[index];
  localState.index=index; localState.running=true;
  audio.src=item.url; audio.load();
  $('#localNow').textContent=item.name;
  $('#localMeta').textContent=`${item.kind==='pregacao'?'Pregação rápida':'Louvor'} • arquivo local do celular`;
  $('#localStart').textContent='⏸️ Pausar rotação';
  localRender();
  try{ await audio.play(); }catch(e){ if(fromUser) $('#localMeta').textContent='O navegador bloqueou o play. Toque no botão ▶ do player.'; }
}
function localStop(){ const a=$('#localAudio'); if(a) a.pause(); localState.running=false; const b=$('#localStart'); if(b) b.textContent='▶️ Iniciar rotação'; }
function localClear(){
  localStop(); localState.items.forEach(x=>URL.revokeObjectURL(x.url)); localState.items=[]; localState.index=-1;
  const a=$('#localAudio'); if(a){a.removeAttribute('src');a.load()}
  if($('#localNow')) $('#localNow').textContent='Nenhum arquivo selecionado';
  if($('#localMeta')) $('#localMeta').textContent='Adicione os MP3 e depois toque em Iniciar rotação.';
  localRender();
}
const mp=$('#musicPicker'), sp=$('#sermonPicker');
if($('#addLocalMusic')) $('#addLocalMusic').onclick=()=>mp.click();
if($('#addLocalSermons')) $('#addLocalSermons').onclick=()=>sp.click();
if(mp) mp.onchange=()=>{addLocalFiles(mp.files,'musica');mp.value=''};
if(sp) sp.onchange=()=>{addLocalFiles(sp.files,'pregacao');sp.value=''};
if($('#clearLocal')) $('#clearLocal').onclick=()=>{if(confirm('Limpar a seleção local deste painel?')) localClear()};
if($('#localStart')) $('#localStart').onclick=()=>{
  const a=$('#localAudio');
  if(!localState.items.length){ alert('Primeiro toque em “Adicionar músicas do celular”.'); return; }
  if(localState.running&&!a.paused){ localStop(); return; }
  if(localState.index<0) localPlay(0,true); else { localState.running=true; a.play().catch(()=>{}); $('#localStart').textContent='⏸️ Pausar rotação'; }
};
if($('#localNext')) $('#localNext').onclick=()=>localPlay(localPickNext(1),true);
if($('#localPrev')) $('#localPrev').onclick=()=>{const old=localState.shuffle;localState.shuffle=false;const i=localPickNext(-1);localState.shuffle=old;localPlay(i,true)};
if($('#localShuffle')) $('#localShuffle').onclick=(e)=>{localState.shuffle=!localState.shuffle;e.currentTarget.textContent=localState.shuffle?'🔀 Mistura ligada':'🔀 Misturar';e.currentTarget.classList.toggle('primary',localState.shuffle)};
if($('#localAudio')){
  $('#localAudio').onended=()=>{ if(localState.running&&localState.items.length) localPlay(localPickNext(1)); };
  $('#localAudio').onerror=()=>{ if(localState.running&&localState.items.length>1) setTimeout(()=>localPlay(localPickNext(1)),800); };
  $('#localAudio').onpause=()=>{ if(!$('#localAudio').ended && localState.running && $('#localAudio').currentTime>0){} };
}
localRender();



// ===== Upload de músicas para a automação =====
const libraryUpload = { files: [] };

function libraryAdminHeaders(){
  const typed = ($('#libraryAdminToken')?.value || '').trim();
  const saved = localStorage.getItem('radioAdminToken') || '';
  const token = typed || saved;
  return {'x-admin-token': token};
}

function renderLibraryUploadPick(){
  const box = $('#libraryMusicSelected');
  if(!box) return;
  if(!libraryUpload.files.length){
    box.innerHTML='<p class="muted">Nenhuma música selecionada.</p>';
    return;
  }
  box.innerHTML=libraryUpload.files.map((f,i)=>`
    <div class="signal-file-pick">
      <span><b>${String(i+1).padStart(2,'0')}.</b> 🎵 ${f.name}</span>
      <small>${fmtSize(f.size)}</small>
    </div>
  `).join('');
}

async function refreshLibraryUploadCount(){
  try{
    const d = await getJSON('/api/signal/status');
    const n = d.libraryCount || 0;
    if($('#libraryUploadState')){
      $('#libraryUploadState').textContent = `${n} música${n===1?'':'s'} na biblioteca`;
      $('#libraryUploadState').className = 'badge ' + (n ? 'ready' : 'pending');
    }
  }catch(e){
    if($('#libraryUploadState')){
      $('#libraryUploadState').textContent = 'Sem status';
      $('#libraryUploadState').className = 'badge pending';
    }
  }
}

if($('#libraryAdminToken')){
  $('#libraryAdminToken').value = localStorage.getItem('radioAdminToken') || '';
  $('#libraryAdminToken').addEventListener('change',()=>{
    const value=$('#libraryAdminToken').value.trim();
    if(value) localStorage.setItem('radioAdminToken',value);
  });
}

if($('#pickLibraryMusic')) $('#pickLibraryMusic').onclick=()=>$('#libraryMusicPicker').click();

if($('#libraryMusicPicker')) $('#libraryMusicPicker').onchange=()=>{
  libraryUpload.files=[...$('#libraryMusicPicker').files].filter(f=>/\.mp3$/i.test(f.name));
  renderLibraryUploadPick();
  if($('#libraryUploadState')){
    $('#libraryUploadState').textContent=`${libraryUpload.files.length} selecionada${libraryUpload.files.length===1?'':'s'}`;
  }
};

if($('#uploadLibraryMusic')) $('#uploadLibraryMusic').onclick=async()=>{
  if(!libraryUpload.files.length){
    alert('Escolha as músicas MP3 primeiro.');
    return;
  }
  const token=(libraryAdminHeaders()['x-admin-token']||'').trim();
  if(!token){
    alert('Digite a senha do painel.');
    return;
  }

  localStorage.setItem('radioAdminToken',token);
  const btn=$('#uploadLibraryMusic');
  setBusy(btn,true,'Enviando...');
  $('#libraryUploadState').textContent='Enviando...';

  try{
    const fd=new FormData();
    libraryUpload.files.forEach(f=>fd.append('audio',f,f.name));

    const r=await fetch('/api/signal/upload',{
      method:'POST',
      headers:libraryAdminHeaders(),
      body:fd
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||`HTTP ${r.status}`);

    libraryUpload.files=[];
    $('#libraryMusicPicker').value='';
    renderLibraryUploadPick();

    $('#libraryUploadState').textContent=`Pronto • ${d.count||0} músicas`;
    $('#libraryUploadState').className='badge ready';

    await loadSignalStatus();
    await load();
  }catch(e){
    $('#libraryUploadState').textContent='Erro no envio';
    $('#libraryUploadState').className='badge pending';
    alert(e.message);
  }finally{
    setBusy(btn,false);
  }
};

if($('#refreshLibraryMusic')) $('#refreshLibraryMusic').onclick=refreshLibraryUploadCount;

renderLibraryUploadPick();
refreshLibraryUploadCount();


// ===== Sinal real Icecast / FFmpeg =====
const signalUi={files:[]};
function adminHeaders(){const t=localStorage.getItem('radioAdminToken')||'';return {'x-admin-token':t};}
async function postJSON(url,body={}){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...adminHeaders()},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;}
function sizeLabel(n){return n<1024*1024?`${Math.round(n/1024)} KB`:`${(n/1024/1024).toFixed(1)} MB`;}
function renderSignalPick(){const box=$('#signalSelected');if(!box)return;if(!signalUi.files.length){box.innerHTML='<p class="muted">Nenhum arquivo selecionado para envio.</p>';return;}box.innerHTML=signalUi.files.map(f=>`<div class="signal-file-pick"><span>🎵 ${f.name}</span><small>${sizeLabel(f.size)}</small></div>`).join('');}
async function loadSignalStatus(){try{const d=await getJSON('/api/signal/status');const b=$('#signalBadge');if(b){b.textContent=d.running?'AO VIVO':'OFFLINE';b.className='badge '+(d.running?'ready':'pending')}if($('#signalFiles'))$('#signalFiles').textContent=`${d.libraryCount||0} arquivos`;const c=d.config||{};if($('#iceHost')&&!$('#iceHost').value)$('#iceHost').value=c.host||'';if($('#icePort')&&!$('#icePort').value)$('#icePort').value=c.port||'8000';if($('#iceMount')&&!$('#iceMount').value)$('#iceMount').value=c.mount||'/stream';if($('#iceUser')&&!$('#iceUser').value)$('#iceUser').value=c.user||'source';if($('#signalLog'))$('#signalLog').textContent=(d.log&&d.log.length?d.log.join('\n'):`Status: ${d.running?'encoder transmitindo':'encoder parado'}\nBiblioteca no servidor: ${d.libraryCount||0} arquivo(s).`);}catch(e){if($('#signalLog'))$('#signalLog').textContent=e.message;}}
if($('#adminToken'))$('#adminToken').value=localStorage.getItem('radioAdminToken')||'';
if($('#saveAdminToken'))$('#saveAdminToken').onclick=()=>{localStorage.setItem('radioAdminToken',$('#adminToken').value.trim());alert('Senha do painel salva somente neste navegador.');};
if($('#pickSignalFiles'))$('#pickSignalFiles').onclick=()=>$('#signalPicker').click();
if($('#signalPicker'))$('#signalPicker').onchange=()=>{signalUi.files=[...$('#signalPicker').files];renderSignalPick();$('#uploadState').textContent=`${signalUi.files.length} selecionadas`;};
if($('#saveSignalConfig'))$('#saveSignalConfig').onclick=async()=>{try{const body={host:$('#iceHost').value.trim(),port:$('#icePort').value.trim(),mount:$('#iceMount').value.trim(),user:$('#iceUser').value.trim()||'source'};const pw=$('#icePassword').value;if(pw)body.password=pw;await postJSON('/api/signal/config',body);$('#icePassword').value='';alert('Configuração do sinal salva para esta execução do servidor.');await loadSignalStatus();}catch(e){alert(e.message)}};
if($('#uploadSignalFiles'))$('#uploadSignalFiles').onclick=async()=>{if(!signalUi.files.length){alert('Escolha as músicas primeiro.');return}const btn=$('#uploadSignalFiles');setBusy(btn,true,'Enviando...');$('#uploadState').textContent='Enviando';try{const fd=new FormData();signalUi.files.forEach(f=>fd.append('audio',f,f.name));const r=await fetch('/api/signal/upload',{method:'POST',headers:adminHeaders(),body:fd});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);$('#uploadState').textContent=`Servidor: ${d.count} arquivos`;signalUi.files=[];$('#signalPicker').value='';renderSignalPick();await loadSignalStatus();}catch(e){$('#uploadState').textContent='Erro';alert(e.message)}finally{setBusy(btn,false)}};
if($('#startSignal'))$('#startSignal').onclick=async()=>{const b=$('#startSignal');setBusy(b,true,'Conectando...');try{await postJSON('/api/signal/start');await new Promise(r=>setTimeout(r,1200));await loadSignalStatus();}catch(e){alert(e.message);await loadSignalStatus()}finally{setBusy(b,false)}};
if($('#stopSignal'))$('#stopSignal').onclick=async()=>{try{await postJSON('/api/signal/stop');await loadSignalStatus()}catch(e){alert(e.message)}};
if($('#clearSignalFiles'))$('#clearSignalFiles').onclick=async()=>{if(!confirm('Apagar todos os áudios enviados ao servidor?'))return;try{await postJSON('/api/signal/clear');await loadSignalStatus()}catch(e){alert(e.message)}};
if($('#refreshSignal'))$('#refreshSignal').onclick=loadSignalStatus;
loadSignalStatus();setInterval(loadSignalStatus,10000);
