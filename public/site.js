const currentProgram = document.getElementById('currentProgram');
const currentHost = document.getElementById('currentHost');

function fallbackByClock(){
  const parts = new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const h=Number(parts.find(x=>x.type==='hour')?.value||0), m=Number(parts.find(x=>x.type==='minute')?.value||0), n=h*60+m;
  const p=[
    [540,600,'Bom Dia Deus','Pastor Luiz Felipe'],
    [750,780,'Encontro com Deus','Missionária Ingrid Laura'],
    [1080,1140,'Tarde da Benção','Pastor Bernardo Henrique'],
    [1140,1260,'Culto No Seu Lar','Pastor Heitor Cruz']
  ].find(([a,b])=>n>=a&&n<b);
  return p?{name:p[2],host:p[3]}:{name:'Louvores que Edificam',host:'Programação automática 24h'};
}

async function refreshProgram(){
  try{
    const r=await fetch('/api/status',{cache:'no-store'}); const j=await r.json();
    if(!j.ok) throw new Error('status');
    if(j.current){
      currentProgram.textContent=j.current.nome||'Programação ao vivo';
      const voice=j.voices?.[j.current.apresentador];
      currentHost.textContent=voice?.nome||'Web Rádio Vem Comigo Deus';
    }else{
      currentProgram.textContent='Louvores que Edificam';
      currentHost.textContent=j.next?`Até ${j.next.nome} às ${j.next.inicio}`:'Programação automática 24h';
    }
  }catch{
    const f=fallbackByClock(); currentProgram.textContent=f.name; currentHost.textContent=f.host;
  }
}
refreshProgram(); setInterval(refreshProgram,15000);
