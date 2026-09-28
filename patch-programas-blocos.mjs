import fs from 'node:fs';
import path from 'node:path';

const sf='server.js';
let s=fs.readFileSync(sf,'utf8');

if(!s.includes('function ensureRadioSpeechBlocks(')){
  const anchor="function spokenScript(programData){";
  const pos=s.indexOf(anchor);
  if(pos<0) throw new Error('spokenScript não encontrado');

  const helper=String.raw`
function parseWavForRadioBlocks(file){
  const b=fs.readFileSync(file);
  if(b.length<44 || b.toString('ascii',0,4)!=='RIFF' || b.toString('ascii',8,12)!=='WAVE') throw new Error('WAV inválido');
  let p=12, fmt=null, dataStart=0, dataSize=0;
  while(p+8<=b.length){
    const id=b.toString('ascii',p,p+4), size=b.readUInt32LE(p+4), start=p+8;
    if(id==='fmt ') fmt=b.subarray(start,start+size);
    if(id==='data'){ dataStart=start; dataSize=Math.min(size,b.length-start); break; }
    p=start+size+(size%2);
  }
  if(!fmt || !dataStart || !dataSize) throw new Error('WAV sem fmt/data');
  const audioFormat=fmt.readUInt16LE(0), channels=fmt.readUInt16LE(2), sampleRate=fmt.readUInt32LE(4);
  const bits=fmt.readUInt16LE(14);
  if(audioFormat!==1 || bits!==16) throw new Error('WAV precisa ser PCM 16-bit');
  return {b,fmt,dataStart,dataSize,channels,sampleRate,bits,frameBytes:channels*2};
}

function radioWavFromPcm(fmt,pcm){
  const fmtPad=fmt.length%2, dataPad=pcm.length%2;
  const total=12+8+fmt.length+fmtPad+8+pcm.length+dataPad;
  const out=Buffer.alloc(total); let p=0;
  out.write('RIFF',p); p+=4; out.writeUInt32LE(total-8,p); p+=4; out.write('WAVE',p); p+=4;
  out.write('fmt ',p); p+=4; out.writeUInt32LE(fmt.length,p); p+=4; fmt.copy(out,p); p+=fmt.length;
  if(fmtPad) out[p++]=0;
  out.write('data',p); p+=4; out.writeUInt32LE(pcm.length,p); p+=4; pcm.copy(out,p); p+=pcm.length;
  if(dataPad) out[p]=0;
  return out;
}

function radioSpeechWords(q){
  return Math.max(1,String((q.label||'')+' '+(q.text||'')).trim().split(/\s+/).length);
}

function nearestQuietFrame(wav,targetFrame,windowSeconds=5){
  const {b,dataStart,dataSize,channels,sampleRate,frameBytes}=wav;
  const totalFrames=Math.floor(dataSize/frameBytes);
  const radius=Math.floor(sampleRate*windowSeconds);
  const from=Math.max(0,targetFrame-radius), to=Math.min(totalFrames-1,targetFrame+radius);
  const step=Math.max(1,Math.floor(sampleRate*0.025));
  let best=Math.max(0,Math.min(totalFrames-1,targetFrame)), bestScore=Infinity;
  for(let f=from;f<=to;f+=step){
    let score=0, n=0;
    const end=Math.min(to,f+step);
    for(let k=f;k<end;k+=Math.max(1,Math.floor(step/8))){
      const base=dataStart+k*frameBytes;
      for(let c=0;c<channels;c++){ score+=Math.abs(b.readInt16LE(base+c*2)); n++; }
    }
    score=n?score/n:Infinity;
    if(score<bestScore){bestScore=score;best=f;}
  }
  return best;
}

function ensureRadioSpeechBlocks(program){
  const date=nowParts().date, id=programId(program), manifest=readManifest(date);
  const item=manifest.programs?.[id];
  if(!item?.audio || !fs.existsSync(item.audio)) throw new Error('Programa ainda não preparado hoje.');
  const pdata=loadProgramCache(date,program) || buildFallbackProgram(program);
  const speech=(pdata.queue||[]).filter(q=>q.type==='speech');
  if(speech.length<3) throw new Error('Programa sem blocos de fala suficientes.');

  const wanted=[
    {key:'opening', match:'Abertura'},
    {key:'word', match:'Palavra'},
    {key:'faith', match:'Mensagem de Fé'}
  ];
  const dir=path.join(TTS_CACHE_DIR,'blocks-'+date+'-'+id);
  fs.mkdirSync(dir,{recursive:true});
  const wav=parseWavForRadioBlocks(item.audio);
  const totalFrames=Math.floor(wav.dataSize/wav.frameBytes);
  const weights=speech.map(radioSpeechWords);
  const sum=weights.reduce((a,b)=>a+b,0);
  const boundaries=[0]; let acc=0;
  for(let i=0;i<speech.length-1;i++){
    acc+=weights[i];
    boundaries.push(nearestQuietFrame(wav,Math.floor(totalFrames*(acc/sum)),4));
  }
  boundaries.push(totalFrames);

  const files={};
  for(const w of wanted){
    const idx=speech.findIndex(q=>q.label===w.match);
    if(idx<0) continue;
    const out=path.join(dir,w.key+'.wav');
    if(!fs.existsSync(out)){
      const a=Math.max(0,boundaries[idx]), z=Math.max(a+1,boundaries[idx+1]);
      const pcm=wav.b.subarray(wav.dataStart+a*wav.frameBytes,wav.dataStart+z*wav.frameBytes);
      fs.writeFileSync(out,radioWavFromPcm(wav.fmt,pcm));
    }
    files[w.key]=out;
  }
  return {date,id,showName:item.nome||program.nome,host:item.host||'',files};
}

`;
  s=s.slice(0,pos)+helper+s.slice(pos);
}

if(!s.includes("u.pathname === '/api/program/blocks'")){
  const anchor="    if (u.pathname === '/api/status') {";
  const add=String.raw`    if (u.pathname === '/api/program/blocks') {
      const cur=forcedProgram() || currentProgram();
      if(!cur) return json(res,404,{ok:false,error:'Nenhum programa no ar.'});
      const x=ensureRadioSpeechBlocks(cur);
      return json(res,200,{ok:true,showName:x.showName,host:x.host,blocks:{
        opening:'/api/program/block?name=opening',
        word:'/api/program/block?name=word',
        faith:'/api/program/block?name=faith'
      }});
    }
    if (u.pathname === '/api/program/block') {
      const cur=forcedProgram() || currentProgram();
      if(!cur){res.writeHead(404);return res.end('Nenhum programa no ar');}
      const name=String(u.searchParams.get('name')||'');
      const x=ensureRadioSpeechBlocks(cur);
      const f=x.files[name];
      if(!f){res.writeHead(404);return res.end('Bloco não encontrado');}
      return serveFile(res,f,'audio/wav');
    }

`;
  if(!s.includes(anchor)) throw new Error('/api/status não encontrado');
  s=s.replace(anchor,add+anchor);
}

fs.writeFileSync(sf,s);
console.log('Servidor: blocos automáticos de fala aplicados.');

const af='public/app.js';
let a=fs.readFileSync(af,'utf8');

const start=a.indexOf('async function getProgramAudio() {');
const end=a.indexOf('\nasync function playNext()', start);
if(start<0 || end<0) throw new Error('Funções do player não encontradas');

const replacement=String.raw`let radioProgramState={key:'',stage:'opening',songs:0,blocks:null};

function programDurationMinutes(){
  const p=currentStatus?.current;
  if(!p?.inicio||!p?.fim) return 60;
  const hm=x=>{const [h,m]=x.split(':').map(Number);return h*60+m};
  const ini=hm(p.inicio), fim=hm(p.fim);
  return fim>ini ? fim-ini : 1440-ini+fim;
}

function resetProgramStateIfNeeded(){
  if(!currentStatus?.current){radioProgramState={key:'',stage:'opening',songs:0,blocks:null};return;}
  const forced=currentStatus.forcedOnAir;
  const key=forced?.startedAt || ((currentStatus.now?.date||'')+'|'+(currentStatus.current.id||currentStatus.current.nome||''));
  if(radioProgramState.key!==key) radioProgramState={key,stage:'opening',songs:0,blocks:null};
}

async function loadProgramBlocks(){
  if(radioProgramState.blocks) return radioProgramState.blocks;
  try{
    const d=await getJSON('/api/program/blocks');
    radioProgramState.blocks=d.blocks||null;
  }catch{radioProgramState.blocks=null}
  return radioProgramState.blocks;
}

async function chooseNextTrack() {
  await refreshStatus();
  resetProgramStateIfNeeded();

  if (!uploadedSongs.length) await loadUploadedSongs();

  if(currentStatus?.current){
    const blocks=await loadProgramBlocks();
    const mins=programDurationMinutes();
    const wordAt=Math.max(1,Math.round((mins*0.25)/4));
    const faithAt=Math.max(wordAt+1,Math.round((mins*0.72)/4));

    if(radioProgramState.stage==='opening' && blocks?.opening){
      radioProgramState.stage='music-before-word';
      return {title:(currentStatus.current.nome||'Programa')+' • Abertura',url:blocks.opening};
    }

    if(radioProgramState.stage==='music-before-word' && radioProgramState.songs>=wordAt && blocks?.word){
      radioProgramState.stage='music-before-faith';
      return {title:(currentStatus.current.nome||'Programa')+' • Palavra do Dia',url:blocks.word};
    }

    if(radioProgramState.stage==='music-before-faith' && radioProgramState.songs>=faithAt && blocks?.faith){
      radioProgramState.stage='final-music';
      return {title:(currentStatus.current.nome||'Programa')+' • Mensagem de Fé',url:blocks.faith};
    }

    if(uploadedSongs.length){
      const track=uploadedSongs[songIndex % uploadedSongs.length];
      songIndex=(songIndex+1)%uploadedSongs.length;
      radioProgramState.songs++;
      return {...track,title:(currentStatus.current.nome||'Programa')+' • '+track.title};
    }
  }

  if (uploadedSongs.length) {
    const track = uploadedSongs[songIndex % uploadedSongs.length];
    songIndex = (songIndex + 1) % uploadedSongs.length;
    return track;
  }

  return null;
}
`;

a = a.slice(0,start) + replacement + a.slice(end);
fs.writeFileSync(af,a);
console.log('Player: abertura + louvores + Palavra + louvores + Fé aplicados.');
