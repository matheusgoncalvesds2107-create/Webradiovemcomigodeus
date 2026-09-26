const $=s=>document.querySelector(s); const audio=$('#audio');
let program=null;
async function getJSON(url){const r=await fetch(url); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Erro'); return j}
async function refresh(){
  const s=await getJSON('/api/status');
  $('#show').textContent=s.current?.nome||'Louvores que Edificam 24h';
  const key=s.current?.apresentador; $('#host').textContent=key ? `Com ${s.voices[key].nome}` : `Próximo: ${s.next.nome} às ${s.next.inicio}`;
  $('#clock').textContent=`${s.now.full} • Horário de Brasília`;
  $('#apiWarning').classList.toggle('hidden',s.configured);
  const songs=await getJSON('/api/songs'); $('#songs').innerHTML=songs.songs.map(x=>`<article class="song"><small>${x.estilo.toUpperCase()}</small><h4>${x.titulo}</h4><p>Louvor original da rádio.</p><button data-song="${x.id}" data-title="${x.titulo}">Ouvir se já estiver preparado</button></article>`).join('');
  document.querySelectorAll('[data-song]').forEach(b=>b.onclick=()=>playSong(b.dataset.song,b.dataset.title));
}
async function loadProgram(){program=await getJSON('/api/program');}
async function playPrepared(){
  if(!program) await loadProgram();
  if(!program.preparedAudio){ $('#statusText').textContent='O áudio de hoje ainda não foi preparado. No painel, use “Preparar programação de hoje”.'; return; }
  $('#kind').textContent='PROGRAMAÇÃO AUTOMÁTICA'; $('#nowTitle').textContent=program.showName; $('#statusText').textContent=`Voz: ${program.host.nome} • áudio preparado sem gastar cota agora`;
  audio.src=program.preparedAudio; try{await audio.play();$('#play').textContent='⏸'}catch(e){$('#statusText').textContent='Clique em play para continuar.'}
}
async function playSong(id,title){
  $('#nowTitle').textContent=title;$('#kind').textContent='LOUVOR ORIGINAL';audio.src=`/api/music/${encodeURIComponent(id)}`;
  try{await audio.play();$('#play').textContent='⏸'}catch(e){$('#statusText').textContent='Esse louvor ainda não foi preparado no painel.'}
}
$('#power').onclick=async()=>{$('#power').textContent='📻 RÁDIO LIGADA';await loadProgram();playPrepared()};
$('#play').onclick=()=>{if(!audio.src){$('#power').click();return} if(audio.paused){audio.play();$('#play').textContent='⏸'}else{audio.pause();$('#play').textContent='▶'}};
$('#next').onclick=()=>{$('#statusText').textContent='A reprodução automática por blocos será ligada junto ao sinal 24h.'};
$('#prev').onclick=()=>{$('#statusText').textContent='A reprodução automática por blocos será ligada junto ao sinal 24h.'};
audio.onerror=()=>{$('#statusText').textContent='Áudio indisponível ou ainda não preparado.'};
refresh(); setInterval(refresh,60000);
