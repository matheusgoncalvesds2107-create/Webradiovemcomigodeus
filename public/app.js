const $=s=>document.querySelector(s);
const audio=$('#audio');
const STREAM='/radio-stream';
async function getJSON(url){const r=await fetch(url,{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Erro');return j}
async function refresh(){
  try{
    const s=await getJSON('/api/status');
    $('#show').textContent=s.current?.nome||'Louvores que Edificam 24h';
    const key=s.current?.apresentador;
    $('#host').textContent=key?`Com ${s.voices[key].nome}`:`Próximo: ${s.next.nome} às ${s.next.inicio}`;
    $('#clock').textContent=`${s.now.full} • Horário de Brasília`;
  }catch{
    $('#show').textContent='Louvores que Edificam 24h';
    $('#host').textContent='Web Rádio Vem Comigo Deus';
  }
}
async function startRadio(){
  $('#statusText').textContent='Conectando ao sinal...';
  audio.src=STREAM+'?t='+Date.now();
  try{
    await audio.play();
    $('#power').textContent='📻 RÁDIO LIGADA';
    $('#play').textContent='⏸';
    $('#statusText').textContent='AO VIVO';
  }catch(e){
    $('#statusText').textContent='Não foi possível iniciar o sinal.';
  }
}
$('#power').onclick=startRadio;
$('#play').onclick=()=>{if(!audio.src){startRadio();return}if(audio.paused){audio.play();$('#play').textContent='⏸'}else{audio.pause();$('#play').textContent='▶'}};
$('#next').onclick=()=>{audio.src=STREAM+'?t='+Date.now();audio.play();};
$('#prev').onclick=()=>{audio.src=STREAM+'?t='+Date.now();audio.play();};
audio.addEventListener('playing',()=>{$('#statusText').textContent='AO VIVO';$('#play').textContent='⏸';});
audio.addEventListener('pause',()=>{$('#play').textContent='▶';});
audio.onerror=()=>{$('#statusText').textContent='Sinal indisponível.';};
refresh();setInterval(refresh,15000);