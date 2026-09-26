const $ = s => document.querySelector(s);
const tabs = [...document.querySelectorAll('.tab')];
function showTab(id){
  tabs.forEach(t=>t.classList.toggle('active',t.id===id));
  document.querySelectorAll('.nav[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
}
document.querySelectorAll('.nav[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
document.querySelectorAll('[data-tab-jump]').forEach(b=>b.onclick=()=>showTab(b.dataset.tabJump));
async function getJSON(url){const r=await fetch(url);const j=await r.json();if(!r.ok)throw new Error(j.error||'Erro');return j}

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
    $('#resultText').textContent=`${song.titulo}\nEstilo: ${song.estilo}\n\nGerando o áudio... isso pode levar um pouco.`;
    const audio=$('#resultAudio');
    audio.src=`/api/music/${encodeURIComponent(song.id)}?generate=1&t=${Date.now()}`;
    audio.style.display='block';
    audio.onerror=()=>{ $('#resultStatus').textContent='Não foi possível gerar o áudio'; $('#resultText').textContent += '\n\nVeja o log do Render. A conta/modelo de música pode não estar liberado.'; };
    audio.oncanplay=()=>{ $('#resultStatus').textContent='Louvor pronto para ouvir'; };
    audio.load();
  }catch(e){ $('#resultStatus').textContent='Erro ao preparar louvor'; $('#resultText').textContent=e.message; }
  finally{ setBusy(btn,false); }
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
bind('#quickOnAir', ()=>{ resultBox('Colocar no ar','A transmissão contínua ainda precisa ser ligada ao servidor Icecast.'); $('#resultText').textContent='O painel já gera o conteúdo. O próximo passo é conectar a saída automática ao sinal da rádio.'; });
if($('#closeResult')) $('#closeResult').onclick=()=>$('#resultPanel').style.display='none';

async function load(){
  try{
    const [s,songs] = await Promise.all([getJSON('/api/status'),getJSON('/api/songs')]);
    const cur=s.current;
    $('#currentShow').textContent=cur?.nome||'Louvores que Edificam 24h';
    $('#currentHost').textContent=cur?`Com ${s.voices[cur.apresentador].nome}`:`Próximo programa: ${s.next.nome} às ${s.next.inicio}`;
    $('#clock').textContent=s.now.full+' • Brasília';
    $('#apiState').textContent=s.configured?`IA: conectada • Voz ${s.quota.tts}/${s.quota.limits.tts} hoje`:'IA: chave não configurada';
    if($('#quotaNote')) $('#quotaNote').textContent=`Modo econômico ativo • preparados ${s.prepared}/4 programas • TTS ${s.quota.tts}/${s.quota.limits.tts} • Texto ${s.quota.text}/${s.quota.limits.text} • Música ${s.quota.music}/${s.quota.limits.music}`;
    $('#statCurrent').textContent=cur?.nome||'Automação 24h';
    $('#statNext').textContent=`${s.next.inicio} • ${s.next.nome}`;
    $('#statSongs').textContent=`${songs.songs.length} originais`;
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
load();setInterval(load,60000);
