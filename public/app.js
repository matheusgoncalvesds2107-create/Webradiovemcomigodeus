const show=document.getElementById('show');
const host=document.getElementById('host');
const clock=document.getElementById('clock');

function fallbackByClock(){
  const parts=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date());
  const val=t=>parts.find(x=>x.type===t)?.value||'00';
  const h=Number(val('hour')),m=Number(val('minute')),n=h*60+m;
  const p=[
    [540,600,'Bom Dia Deus','Pastor Luiz Felipe'],
    [750,780,'Encontro com Deus','Missionária Ingrid Laura'],
    [1080,1140,'Tarde da Benção','Pastor Bernardo Henrique'],
    [1140,1260,'Culto No Seu Lar','Pastor Heitor Cruz']
  ].find(([a,b])=>n>=a&&n<b);
  return {program:p?p[2]:'Louvores que Edificam',host:p?p[3]:'Programação 24h',time:`${val('hour')}:${val('minute')}:${val('second')}`};
}

async function refresh(){
  try{
    const r=await fetch('/api/status',{cache:'no-store'});
    const j=await r.json();
    if(!j.ok)throw 0;
    if(j.current){
      show.textContent=j.current.nome;
      host.textContent=j.voices?.[j.current.apresentador]?.nome||'Web Rádio Vem Comigo Deus';
    }else{
      show.textContent='Louvores que Edificam';
      host.textContent=j.next?`Próximo: ${j.next.nome} às ${j.next.inicio}`:'Programação 24h';
    }
    clock.textContent=`${j.now?.full||''} • Horário de Brasília`;
  }catch{
    const f=fallbackByClock();
    show.textContent=f.program;
    host.textContent=f.host;
    clock.textContent=`${f.time} • Horário de Brasília`;
  }
}

const radioAudio=document.getElementById('radioAudio');
const radioPlay=document.getElementById('radioPlay');
const radioState=document.getElementById('radioState');
const radioVolume=document.getElementById('radioVolume');

radioAudio.volume=Number(radioVolume.value);

radioVolume.addEventListener('input',()=>{
  radioAudio.volume=Number(radioVolume.value);
});

function setUi(playing){
  radioPlay.textContent=playing?'⏸':'▶';
  radioState.textContent=playing?'AO VIVO — Web Rádio Vem Comigo Deus':'Toque no play para ouvir a programação.';
}

radioPlay.addEventListener('click',async()=>{
  if(!radioAudio.paused){
    radioAudio.pause();
    setUi(false);
    return;
  }
  try{
    radioState.textContent='Conectando ao sinal ao vivo...';
    radioAudio.src='/radio-stream?t='+Date.now();
    await radioAudio.play();
    setUi(true);
  }catch(e){
    radioState.textContent='Não foi possível conectar ao sinal.';
    setUi(false);
  }
});

radioAudio.addEventListener('playing',()=>setUi(true));
radioAudio.addEventListener('pause',()=>setUi(false));
radioAudio.addEventListener('error',()=>{
  radioState.textContent='Sinal indisponível no momento.';
  setUi(false);
});

refresh();
setInterval(refresh,15000);
