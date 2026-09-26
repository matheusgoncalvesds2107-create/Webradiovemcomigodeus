const $=s=>document.querySelector(s); const audio=$('#audio');
let rotation=[], idx=0;
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
async function loadRotation(){ const r=await getJSON('/api/rotation'); rotation=r.queue||[]; return rotation; }
async function playAt(i){
  if(!rotation.length) await loadRotation();
  if(!rotation.length){ $('#statusText').textContent='A biblioteca ainda está vazia. Prepare a programação de hoje no painel e gere alguns louvores.'; return; }
  idx=(i+rotation.length)%rotation.length; const item=rotation[idx];
  $('#kind').textContent=item.type==='song'?'LOUVOR ORIGINAL':item.type==='program'?'PROGRAMAÇÃO AUTOMÁTICA':'MENSAGEM / ORAÇÃO';
  $('#nowTitle').textContent=item.title||'Web Rádio Vem Comigo Deus';
  $('#statusText').textContent=item.host?`Com ${item.host}`:'Rotação automática 24h • áudio salvo na biblioteca';
  audio.src=item.url; try{await audio.play();$('#play').textContent='⏸'}catch(e){$('#statusText').textContent='Clique em play para começar a rádio.'}
}
async function playSong(id,title){ $('#nowTitle').textContent=title;$('#kind').textContent='LOUVOR ORIGINAL';audio.src=`/api/music/${encodeURIComponent(id)}`; try{await audio.play();$('#play').textContent='⏸'}catch(e){$('#statusText').textContent='Esse louvor ainda não foi preparado no painel.'} }
$('#power').onclick=async()=>{$('#power').textContent='📻 RÁDIO LIGADA';await loadRotation();playAt(0)};
$('#play').onclick=()=>{if(!audio.src){$('#power').click();return} if(audio.paused){audio.play();$('#play').textContent='⏸'}else{audio.pause();$('#play').textContent='▶'}};
$('#next').onclick=()=>playAt(idx+1); $('#prev').onclick=()=>playAt(idx-1);
audio.addEventListener('ended',()=>playAt(idx+1));
audio.onerror=()=>{ $('#statusText').textContent='Áudio indisponível. Pulando para o próximo...'; setTimeout(()=>playAt(idx+1),1200); };
refresh(); setInterval(refresh,60000);
