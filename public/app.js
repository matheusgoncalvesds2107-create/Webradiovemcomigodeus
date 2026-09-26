const $=s=>document.querySelector(s); const audio=$('#audio');
let queue=[], index=0, running=false, program=null;
async function getJSON(url){const r=await fetch(url); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Erro'); return j}
async function refresh(){
  const s=await getJSON('/api/status');
  $('#show').textContent=s.current?.nome||'Louvores que Edificam 24h';
  const key=s.current?.apresentador; $('#host').textContent=key ? `Com ${s.voices[key].nome}` : `Próximo: ${s.next.nome} às ${s.next.inicio}`;
  $('#clock').textContent=`${s.now.full} • Horário de Brasília`;
  $('#apiWarning').classList.toggle('hidden',s.configured);
  const songs=await getJSON('/api/songs'); $('#songs').innerHTML=songs.songs.map(x=>`<article class="song"><small>${x.estilo.toUpperCase()}</small><h4>${x.titulo}</h4><p>Louvor original da rádio.</p><button data-song="${x.id}" data-title="${x.titulo}">Ouvir</button></article>`).join('');
  document.querySelectorAll('[data-song]').forEach(b=>b.onclick=()=>playSong(b.dataset.song,b.dataset.title));
}
async function loadProgram(){program=await getJSON('/api/program');queue=program.queue;index=0;}
async function playItem(i){
  if(!queue.length) await loadProgram(); index=(i+queue.length)%queue.length; const item=queue[index];
  $('#kind').textContent=item.type==='song'?'LOUVOR ORIGINAL':'PROGRAMAÇÃO AUTOMÁTICA'; $('#nowTitle').textContent=item.label; $('#statusText').textContent=item.type==='song'?'Gerando/tocando louvor da rádio…':`Voz: ${program.host.nome}`;
  audio.pause(); audio.removeAttribute('src');
  if(item.type==='song') audio.src=`/api/music/${encodeURIComponent(item.songId)}`;
  else audio.src=`/api/tts?voice=${encodeURIComponent(item.voiceKey)}&text=${encodeURIComponent(item.text)}`;
  try{await audio.play(); $('#play').textContent='⏸';}catch(e){$('#statusText').textContent=e.message.includes('GEMINI')?'Configure a GEMINI_API_KEY no servidor.':'Clique em play para continuar.'}
}
async function playSong(id,title){running=true;$('#nowTitle').textContent=title;$('#kind').textContent='LOUVOR ORIGINAL';audio.src=`/api/music/${encodeURIComponent(id)}`;try{await audio.play();$('#play').textContent='⏸'}catch(e){$('#statusText').textContent='Não foi possível gerar o áudio: '+e.message}}
$('#power').onclick=async()=>{running=true;$('#power').textContent='📻 RÁDIO LIGADA';await loadProgram();playItem(0)};
$('#play').onclick=()=>{if(!audio.src){$('#power').click();return} if(audio.paused){audio.play();$('#play').textContent='⏸'}else{audio.pause();$('#play').textContent='▶'}};
$('#next').onclick=()=>playItem(index+1); $('#prev').onclick=()=>playItem(index-1);
audio.onended=()=>{if(running)playItem(index+1)}; audio.onerror=async()=>{try{const r=await fetch(audio.src);const j=await r.json();$('#statusText').textContent=j.error||'Erro ao gerar áudio'}catch{$('#statusText').textContent='Erro ao carregar áudio'}};
refresh(); setInterval(refresh,60000);
