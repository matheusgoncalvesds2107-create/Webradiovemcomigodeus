import fs from 'node:fs';

const sf='server.js';
let s=fs.readFileSync(sf,'utf8');

// ===== SERVIDOR: uma única linha do tempo da rádio =====
if(!s.includes('function radioLiveSongAt(')){
  const anchor='function currentProgram() { return scheduleState().current; }';
  if(!s.includes(anchor)) throw new Error('currentProgram não encontrado.');

  const helper=String.raw`

function radioEstimatedSongSeconds(item){
  const bytes=Math.max(1,Number(item?.bytes)||0);
  // A biblioteca enviada para a rádio está em ~96 kbps.
  // Se bytes não estiver disponível, usa 4 minutos.
  return bytes ? Math.max(30,Math.round((bytes*8)/96000)) : 240;
}

function radioHashNumber(text){
  const b=crypto.createHash('sha1').update(String(text||'')).digest();
  return b.readUInt32BE(0);
}

function radioLiveSongAt(items,elapsedSeconds,seed='radio'){
  if(!items.length) return null;
  const start=radioHashNumber(seed)%items.length;
  const cycle=items.reduce((sum,x)=>sum+radioEstimatedSongSeconds(x),0);
  let t=Math.max(0,Number(elapsedSeconds)||0);
  if(cycle>0) t=t%cycle;

  for(let n=0;n<items.length;n++){
    const idx=(start+n)%items.length;
    const item=items[idx];
    const dur=radioEstimatedSongSeconds(item);
    if(t<dur){
      return {
        type:'song',
        title:item.name||'Louvor',
        url:'/uploaded-radio/'+encodeURIComponent(item.id),
        seekTo:Math.max(0,Math.floor(t)),
        durationSeconds:dur
      };
    }
    t-=dur;
  }

  const item=items[start];
  return {
    type:'song',
    title:item.name||'Louvor',
    url:'/uploaded-radio/'+encodeURIComponent(item.id),
    seekTo:0,
    durationSeconds:radioEstimatedSongSeconds(item)
  };
}

function radioScheduledElapsed(cur,st){
  if(!cur) return 0;
  const time=String(st.now.time||'00:00');
  const [hh,mm]=time.split(':').map(Number);
  const nowSec=hh*3600+mm*60;
  const [sh,sm]=String(cur.inicio).split(':').map(Number);
  const startSec=sh*3600+sm*60;
  let e=nowSec-startSec;
  if(e<0) e+=86400;
  return e;
}

function radioProgramDurationSeconds(cur){
  if(!cur) return 0;
  const a=mins(cur.inicio), b=mins(cur.fim);
  return (b>a?b-a:1440-a+b)*60;
}

function radioLiveNow(){
  const st=scheduleState();
  const forced=readForcedOnAir();
  const cur=forcedProgram() || st.current;
  const items=readSignalLibrary().filter(x=>x?.id && x?.path && fs.existsSync(x.path));

  let elapsed=0;
  let total=86400;
  let key='louvores|'+st.now.date;

  if(forced && cur){
    elapsed=Math.max(0,Math.floor((Date.now()-new Date(forced.startedAt).getTime())/1000));
    total=Math.max(1,Number(forced.durationSeconds)||radioProgramDurationSeconds(cur)||3600);
    key='manual|'+programId(cur)+'|'+forced.startedAt;
  }else if(cur){
    elapsed=radioScheduledElapsed(cur,st);
    total=Math.max(1,radioProgramDurationSeconds(cur));
    key=st.now.date+'|'+programId(cur);
  }else{
    const [hh,mm]=String(st.now.time||'00:00').split(':').map(Number);
    elapsed=hh*3600+mm*60;
  }

  if(!cur){
    const song=radioLiveSongAt(items,elapsed,key);
    return {key,program:null,elapsedSeconds:elapsed,durationSeconds:total,track:song};
  }

  let blocks=null;
  try{ blocks=ensureRadioSpeechBlocks(cur); }catch{}

  const opening=blocks?.files?.opening;
  const word=blocks?.files?.word;
  const faith=blocks?.files?.faith;

  const openingDur=opening ? Math.max(1,Math.ceil(wavDurationSeconds(opening))) : 0;
  const wordDur=word ? Math.max(1,Math.ceil(wavDurationSeconds(word))) : 0;
  const faithDur=faith ? Math.max(1,Math.ceil(wavDurationSeconds(faith))) : 0;

  const wordAt=Math.max(openingDur+1,Math.floor(total*0.25));
  const faithAt=Math.max(wordAt+wordDur+1,Math.floor(total*0.72));
  const pid=programId(cur);
  const base='/api/program/block?pid='+encodeURIComponent(pid)+'&date='+encodeURIComponent(st.now.date)+'&name=';

  if(opening && elapsed<openingDur){
    return {key,program:cur.nome,elapsedSeconds:elapsed,durationSeconds:total,
      track:{type:'speech',title:cur.nome+' • Abertura',url:base+'opening',seekTo:elapsed,durationSeconds:openingDur}};
  }

  if(word && elapsed>=wordAt && elapsed<wordAt+wordDur){
    return {key,program:cur.nome,elapsedSeconds:elapsed,durationSeconds:total,
      track:{type:'speech',title:cur.nome+' • Palavra do Dia',url:base+'word',seekTo:elapsed-wordAt,durationSeconds:wordDur}};
  }

  if(faith && elapsed>=faithAt && elapsed<faithAt+faithDur){
    return {key,program:cur.nome,elapsedSeconds:elapsed,durationSeconds:total,
      track:{type:'speech',title:cur.nome+' • Mensagem de Fé',url:base+'faith',seekTo:elapsed-faithAt,durationSeconds:faithDur}};
  }

  let musicElapsed;
  let phase;
  if(elapsed<wordAt){
    musicElapsed=Math.max(0,elapsed-openingDur);
    phase='antes-palavra';
  }else if(elapsed<faithAt){
    musicElapsed=Math.max(0,elapsed-(wordAt+wordDur));
    phase='antes-fe';
  }else{
    musicElapsed=Math.max(0,elapsed-(faithAt+faithDur));
    phase='final';
  }

  const song=radioLiveSongAt(items,musicElapsed,key+'|'+phase);
  if(song) song.title=cur.nome+' • '+song.title;
  return {key,program:cur.nome,elapsedSeconds:elapsed,durationSeconds:total,track:song};
}
`;

  s=s.replace(anchor,anchor+helper);
}

if(!s.includes("u.pathname === '/api/radio/live'")){
  const anchor="    if (u.pathname === '/api/status') {";
  if(!s.includes(anchor)) throw new Error('/api/status não encontrado.');
  const route=String.raw`    if (u.pathname === '/api/radio/live') {
      const live=radioLiveNow();
      if(!live.track) return json(res,404,{ok:false,error:'Nenhum áudio disponível na biblioteca.'});
      return json(res,200,{ok:true,...live});
    }

`;
  s=s.replace(anchor,route+anchor);
}

fs.writeFileSync(sf,s);
console.log('Servidor: linha do tempo única da rádio aplicada.');

// ===== PLAYER PÚBLICO: sempre entra no ponto atual =====
const af='public/app.js';
let a=fs.readFileSync(af,'utf8');

const start=a.indexOf('async function chooseNextTrack() {');
const end=a.indexOf('\nasync function playNext()',start);
if(start<0 || end<0) throw new Error('chooseNextTrack/playNext não encontrados.');

const liveChoose=String.raw`async function chooseNextTrack() {
  await refreshStatus();
  try{
    const live=await getJSON('/api/radio/live?_='+Date.now());
    if(live?.track?.url){
      return {
        title:live.track.title||'Web Rádio Vem Comigo Deus',
        url:live.track.url,
        seekTo:Number(live.track.seekTo)||0,
        liveKey:live.key||''
      };
    }
  }catch{}

  if (!uploadedSongs.length) await loadUploadedSongs();
  if (uploadedSongs.length) {
    const track=uploadedSongs[0];
    return {...track,seekTo:0};
  }
  return null;
}
`;

a=a.slice(0,start)+liveChoose+a.slice(end);

// Troca playNext por uma versão que aplica o ponto atual antes de tocar.
const ps=a.indexOf('async function playNext() {');
const pe=a.indexOf("\n$('#power').onclick",ps);
if(ps<0 || pe<0) throw new Error('playNext público não encontrado.');

const livePlay=String.raw`async function playNext() {
  const track = await chooseNextTrack();

  if (!track) {
    $('#statusText').textContent = 'Nenhum áudio disponível agora.';
    return;
  }

  audio.src = track.url;
  if ($('#nowTitle')) $('#nowTitle').textContent = track.title || 'Web Rádio Vem Comigo Deus';
  $('#statusText').textContent = 'Entrando ao vivo...';

  try {
    const seek=Math.max(0,Number(track.seekTo)||0);
    if(seek>0){
      await new Promise(resolve=>{
        let done=false;
        const finish=()=>{if(done)return;done=true;resolve();};
        audio.addEventListener('loadedmetadata',finish,{once:true});
        setTimeout(finish,1800);
      });
      if(Number.isFinite(audio.duration) && audio.duration>2){
        try{ audio.currentTime=Math.min(seek,Math.max(0,audio.duration-1)); }catch{}
      }
    }

    await audio.play();
    started = true;
    $('#power').textContent = '📻 RÁDIO LIGADA';
    $('#play').textContent = '⏸';
    $('#statusText').textContent = 'AO VIVO';
  } catch {
    $('#statusText').textContent = 'Não foi possível tocar este áudio.';
  }
}
`;

a=a.slice(0,ps)+livePlay+a.slice(pe);

// O botão grande não avança a programação quando já está tocando.
a=a.replace(
  "$('#power').onclick = playNext;",
  `$('#power').onclick = async () => {
  if(started && audio.src && !audio.paused) return;
  if(started && audio.src && audio.paused){
    try{ await audio.play(); return; }catch{}
  }
  await playNext();
};`
);

// Força o navegador/PWA a buscar esta versão nova.
fs.writeFileSync(af,a);

const ix='public/index.html';
let h=fs.readFileSync(ix,'utf8');
h=h.replace(/\/app\.js\?v=[^"]+/,'/app.js?v=live-3');
fs.writeFileSync(ix,h);

console.log('Player: entra no ponto atual e não reinicia ao clicar.');
