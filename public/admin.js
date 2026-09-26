const $ = s => document.querySelector(s);
const tabs = [...document.querySelectorAll('.tab')];
function showTab(id){
  tabs.forEach(t=>t.classList.toggle('active',t.id===id));
  document.querySelectorAll('.nav[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
}
document.querySelectorAll('.nav[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
document.querySelectorAll('[data-tab-jump]').forEach(b=>b.onclick=()=>showTab(b.dataset.tabJump));
async function getJSON(url){const r=await fetch(url);const j=await r.json();if(!r.ok)throw new Error(j.error||'Erro');return j}
const prettyVoice = key => ({luiz:'Puck',ingrid:'Sulafat',bernardo:'Achird',heitor:'Charon'}[key]||key);
async function load(){
  try{
    const [s,songs] = await Promise.all([getJSON('/api/status'),getJSON('/api/songs')]);
    const cur=s.current;
    $('#currentShow').textContent=cur?.nome||'Louvores que Edificam 24h';
    $('#currentHost').textContent=cur?`Com ${s.voices[cur.apresentador].nome}`:`Próximo programa: ${s.next.nome} às ${s.next.inicio}`;
    $('#clock').textContent=s.now.full+' • Brasília';
    $('#apiState').textContent=s.configured?'IA: conectada':'IA: chave não configurada';
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
