import fs from 'node:fs';

const sf='server.js';
let s=fs.readFileSync(sf,'utf8');

// Endpoint com a posição "de relógio" da rádio.
// Isso permite que quem abrir a rádio depois entre no ponto atual da programação.
if(!s.includes("u.pathname === '/api/radio-position'")){
  const anchor="    if (u.pathname === '/api/status') {";
  if(!s.includes(anchor)) throw new Error('/api/status não encontrado para aplicar posição da rádio.');

  const add=String.raw`    if (u.pathname === '/api/radio-position') {
      const st=scheduleState();
      const forced=readForcedOnAir();
      const cur=forcedProgram() || st.current;

      let elapsedSeconds=0;
      let durationSeconds=0;
      let key='louvores-'+st.now.date;

      if(forced && cur){
        elapsedSeconds=Math.max(0,Math.floor((Date.now()-new Date(forced.startedAt).getTime())/1000));
        durationSeconds=Math.max(1,Number(forced.durationSeconds)||3600);
        key='manual|'+forced.id+'|'+forced.startedAt;
      } else if(cur){
        const [hh,mm,ss]=String(st.now.full).split(' ')[1].split(':').map(Number);
        const nowSec=hh*3600+mm*60+(ss||0);
        const [sh,sm]=String(cur.inicio).split(':').map(Number);
        const [eh,em]=String(cur.fim).split(':').map(Number);
        const startSec=sh*3600+sm*60;
        const endSec=eh*3600+em*60;
        elapsedSeconds=nowSec-startSec;
        if(elapsedSeconds<0) elapsedSeconds+=86400;
        durationSeconds=endSec>startSec ? endSec-startSec : 86400-startSec+endSec;
        key=st.now.date+'|'+programId(cur);
      } else {
        const [hh,mm,ss]=String(st.now.full).split(' ')[1].split(':').map(Number);
        elapsedSeconds=hh*3600+mm*60+(ss||0);
        durationSeconds=86400;
      }

      elapsedSeconds=Math.max(0,Math.min(elapsedSeconds,Math.max(0,durationSeconds-1)));

      return json(res,200,{
        ok:true,
        key,
        programId:cur?programId(cur):null,
        programName:cur?.nome||null,
        elapsedSeconds,
        durationSeconds,
        progress:durationSeconds?elapsedSeconds/durationSeconds:0
      });
    }

`;
  s=s.replace(anchor,add+anchor);
}

fs.writeFileSync(sf,s);
console.log('Servidor: posição contínua da rádio aplicada.');

const af='public/app.js';
let a=fs.readFileSync(af,'utf8');

// Estado extra para o primeiro áudio depois que o ouvinte entra/reabre.
if(!a.includes('let radioClockPosition=null;')){
  a=a.replace(
    "let radioProgramState={key:'',stage:'opening',songs:0,blocks:null};",
    "let radioProgramState={key:'',stage:'opening',songs:0,blocks:null};\nlet radioClockPosition=null;\nlet radioClockAppliedKey='';\nlet radioSeekPending=0;"
  );
}

// Carrega a posição real do relógio da rádio e coloca o player no trecho correspondente.
if(!a.includes('async function syncRadioClockPosition()')){
  const marker="function programDurationMinutes(){";
  const helper=String.raw`
async function syncRadioClockPosition(){
  try{
    radioClockPosition=await getJSON('/api/radio-position');
  }catch{
    radioClockPosition=null;
  }
}

function applyRadioClockPosition(){
  const p=radioClockPosition;
  if(!p || !uploadedSongs.length || radioClockAppliedKey===p.key) return;

  const elapsed=Math.max(0,Number(p.elapsedSeconds)||0);
  const duration=Math.max(1,Number(p.durationSeconds)||3600);

  // Média operacional de 4 minutos por louvor para escolher a faixa da linha do tempo.
  const slotSeconds=240;
  songIndex=Math.floor(elapsed/slotSeconds)%uploadedSongs.length;
  radioSeekPending=elapsed%slotSeconds;

  if(currentStatus?.current){
    const wordAt=duration*0.25;
    const faithAt=duration*0.72;
    const speechWindow=150;

    if(elapsed<speechWindow){
      radioProgramState.stage='opening';
      radioProgramState.songs=0;
      // bloco de abertura começa no início; não tenta avançar dentro da fala
      radioSeekPending=0;
    }else if(elapsed<wordAt){
      radioProgramState.stage='music-before-word';
      radioProgramState.songs=Math.max(1,Math.floor(elapsed/slotSeconds));
    }else if(elapsed<wordAt+speechWindow){
      radioProgramState.stage='music-before-word';
      radioProgramState.songs=Math.max(1,Math.round((duration/60*0.25)/4));
      radioSeekPending=0;
    }else if(elapsed<faithAt){
      radioProgramState.stage='music-before-faith';
      radioProgramState.songs=Math.max(1,Math.floor(elapsed/slotSeconds));
    }else if(elapsed<faithAt+speechWindow){
      radioProgramState.stage='music-before-faith';
      radioProgramState.songs=Math.max(2,Math.round((duration/60*0.72)/4));
      radioSeekPending=0;
    }else{
      radioProgramState.stage='final-music';
      radioProgramState.songs=Math.max(2,Math.floor(elapsed/slotSeconds));
    }
  }

  radioClockAppliedKey=p.key;
}

`;
  if(!a.includes(marker)) throw new Error('programDurationMinutes não encontrado no player.');
  a=a.replace(marker,helper+marker);
}

// Toda vez que for escolher a próxima faixa, sincroniza o relógio antes.
const chooseAnchor=`async function chooseNextTrack() {
  await refreshStatus();
  resetProgramStateIfNeeded();

  if (!uploadedSongs.length) await loadUploadedSongs();`;

const chooseNew=`async function chooseNextTrack() {
  await refreshStatus();
  resetProgramStateIfNeeded();

  if (!uploadedSongs.length) await loadUploadedSongs();
  await syncRadioClockPosition();
  applyRadioClockPosition();`;

if(a.includes(chooseAnchor)) a=a.replace(chooseAnchor,chooseNew);

// Marca o primeiro louvor após abrir/reabrir com a posição interna aproximada.
a=a.replace(
`      const track=uploadedSongs[songIndex % uploadedSongs.length];
      songIndex=(songIndex+1)%uploadedSongs.length;
      radioProgramState.songs++;
      return {...track,title:(currentStatus.current.nome||'Programa')+' • '+track.title};`,
`      const track=uploadedSongs[songIndex % uploadedSongs.length];
      songIndex=(songIndex+1)%uploadedSongs.length;
      radioProgramState.songs++;
      const seekTo=radioSeekPending; radioSeekPending=0;
      return {...track,seekTo,title:(currentStatus.current.nome||'Programa')+' • '+track.title};`
);

a=a.replace(
`    const track = uploadedSongs[songIndex % uploadedSongs.length];
    songIndex = (songIndex + 1) % uploadedSongs.length;
    return track;`,
`    const track = uploadedSongs[songIndex % uploadedSongs.length];
    songIndex = (songIndex + 1) % uploadedSongs.length;
    const seekTo=radioSeekPending; radioSeekPending=0;
    return {...track,seekTo};`
);

// No primeiro louvor, entra também dentro da música em vez de sempre começar no 0:00.
const oldPlay=`  audio.src = track.url;
  if ($('#nowTitle') && (!currentStatus || !currentStatus.current)) {
    $('#nowTitle').textContent = track.title;
  }
  $('#statusText').textContent = 'Carregando...';

  try {
    await audio.play();`;

const newPlay=`  audio.src = track.url;
  if ($('#nowTitle') && (!currentStatus || !currentStatus.current)) {
    $('#nowTitle').textContent = track.title;
  }
  $('#statusText').textContent = 'Carregando...';

  try {
    if(Number(track.seekTo)>0){
      await new Promise(resolve=>{
        let done=false;
        const finish=()=>{if(done)return;done=true;resolve();};
        audio.addEventListener('loadedmetadata',finish,{once:true});
        setTimeout(finish,1800);
      });
      if(Number.isFinite(audio.duration) && audio.duration>8){
        const pos=Math.min(Math.max(0,Number(track.seekTo)%audio.duration),Math.max(0,audio.duration-2));
        try{audio.currentTime=pos;}catch{}
      }
    }
    await audio.play();`;

if(a.includes(oldPlay)) a=a.replace(oldPlay,newPlay);

fs.writeFileSync(af,a);
console.log('Player: retorno no ponto atual da programação aplicado.');
