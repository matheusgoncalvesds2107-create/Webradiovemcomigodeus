import fs from 'node:fs';

const file='server.js';
let s=fs.readFileSync(file,'utf8');

// ffmpeg-static: converte WAV das falas e MP3 dos louvores
// para um único sinal MP3 contínuo enviado ao Caster.
if(!s.includes("import { spawn } from 'node:child_process';")){
  s=s.replace(
    "import Busboy from 'busboy';",
    "import Busboy from 'busboy';\nimport { spawn } from 'node:child_process';\nimport ffmpegPath from 'ffmpeg-static';"
  );
}

// Inclui o encerramento falado entre os blocos do programa.
s=s.replace(
`  const wanted=[
    {key:'opening', match:'Abertura'},
    {key:'word', match:'Palavra'},
    {key:'faith', match:'Mensagem de Fé'}
  ];`,
`  const wanted=[
    {key:'opening', match:'Abertura'},
    {key:'word', match:'Palavra'},
    {key:'faith', match:'Mensagem de Fé'},
    {key:'outro', match:'Encerramento'}
  ];`
);

const a=s.indexOf('async function writeFileRealtime(');
const b=s.indexOf('\nasync function uploadSignalAudio(',a);
if(a<0 || b<0) throw new Error('Bloco antigo do transmissor não encontrado.');

const novo=String.raw`
function txEstimatedSongSeconds(item){
  const bytes=Math.max(1,Number(item?.bytes)||0);
  return bytes ? Math.max(30,Math.round((bytes*8)/96000)) : 240;
}

function txNowSeconds(){
  const t=String(nowParts().full.split(' ')[1]||'00:00:00');
  const [h,m,s='0']=t.split(':').map(Number);
  return h*3600+m*60+(s||0);
}

function txProgramElapsed(program){
  const nowSec=txNowSeconds();
  const [sh,sm]=String(program.inicio).split(':').map(Number);
  let e=nowSec-(sh*3600+sm*60);
  if(e<0)e+=86400;
  return Math.max(0,e);
}

function txProgramDuration(program){
  const a=mins(program.inicio), b=mins(program.fim);
  return (b>a?b-a:1440-a+b)*60;
}

function txSongAt(items,elapsed,seed){
  if(!items.length) return null;
  const h=crypto.createHash('sha1').update(String(seed||'radio')).digest().readUInt32BE(0);
  const start=h%items.length;
  const cycle=items.reduce((n,x)=>n+txEstimatedSongSeconds(x),0);
  let t=Math.max(0,Number(elapsed)||0);
  if(cycle>0)t%=cycle;

  for(let n=0;n<items.length;n++){
    const idx=(start+n)%items.length;
    const item=items[idx];
    const dur=txEstimatedSongSeconds(item);
    if(t<dur)return {item,seek:t,remaining:Math.max(1,dur-t)};
    t-=dur;
  }

  const item=items[start];
  return {item,seek:0,remaining:txEstimatedSongSeconds(item)};
}

function txSpeechInfo(program){
  try{
    const x=ensureRadioSpeechBlocks(program);
    return x?.files||{};
  }catch(e){
    return {};
  }
}

function txWavSeconds(file){
  try{return Math.max(1,Math.ceil(wavDurationSeconds(file)));}catch{return 1;}
}

function txCurrentSegment(items){
  const st=scheduleState();
  const program=st.current;

  // Fora dos programas: somente louvores.
  if(!program){
    const song=txSongAt(items,txNowSeconds(),'louvores|'+st.now.date);
    if(!song)return null;
    return {
      file:song.item.path,
      seek:song.seek,
      maxSeconds:song.remaining,
      label:'Louvores que Edificam • '+(song.item.name||'Louvor')
    };
  }

  const elapsed=txProgramElapsed(program);
  const total=txProgramDuration(program);
  const files=txSpeechInfo(program);

  const opening=files.opening;
  const word=files.word;
  const faith=files.faith;
  const outro=files.outro;

  const openingDur=opening?txWavSeconds(opening):0;
  const wordDur=word?txWavSeconds(word):0;
  const faithDur=faith?txWavSeconds(faith):0;
  const outroDur=outro?txWavSeconds(outro):0;

  // Estrutura:
  // abertura -> louvores -> Palavra -> louvores -> Mensagem de Fé
  // -> louvores -> encerramento -> próxima programação
  const wordAt=Math.max(openingDur+1,Math.floor(total*0.25));
  const faithAt=Math.max(wordAt+wordDur+1,Math.floor(total*0.72));
  const outroAt=outro
    ? Math.max(faithAt+faithDur+1,total-outroDur-60)
    : total+1;

  if(opening && elapsed<openingDur){
    return {
      file:opening,
      seek:elapsed,
      maxSeconds:openingDur-elapsed,
      label:program.nome+' • Abertura'
    };
  }

  if(word && elapsed>=wordAt && elapsed<wordAt+wordDur){
    return {
      file:word,
      seek:elapsed-wordAt,
      maxSeconds:(wordAt+wordDur)-elapsed,
      label:program.nome+' • Palavra do Dia'
    };
  }

  if(faith && elapsed>=faithAt && elapsed<faithAt+faithDur){
    return {
      file:faith,
      seek:elapsed-faithAt,
      maxSeconds:(faithAt+faithDur)-elapsed,
      label:program.nome+' • Mensagem de Fé'
    };
  }

  if(outro && elapsed>=outroAt && elapsed<outroAt+outroDur){
    return {
      file:outro,
      seek:elapsed-outroAt,
      maxSeconds:(outroAt+outroDur)-elapsed,
      label:program.nome+' • Encerramento'
    };
  }

  let phaseStart=0, phaseEnd=total, phase='inicio';

  if(elapsed<wordAt){
    phaseStart=openingDur;
    phaseEnd=wordAt;
    phase='antes-palavra';
  }else if(elapsed<faithAt){
    phaseStart=wordAt+wordDur;
    phaseEnd=faithAt;
    phase='antes-fe';
  }else if(elapsed<outroAt){
    phaseStart=faithAt+faithDur;
    phaseEnd=outroAt;
    phase='antes-encerramento';
  }else{
    phaseStart=outroAt+outroDur;
    phaseEnd=total;
    phase='final';
  }

  const song=txSongAt(
    items,
    Math.max(0,elapsed-phaseStart),
    st.now.date+'|'+program.id+'|'+phase
  );

  if(!song)return null;

  return {
    file:song.item.path,
    seek:song.seek,
    maxSeconds:Math.min(song.remaining,Math.max(1,phaseEnd-elapsed)),
    label:program.nome+' • '+(song.item.name||'Louvor')
  };
}

async function txPipeFileRealtime(seg,req,bitrate){
  return new Promise((resolve,reject)=>{
    const args=['-hide_banner','-loglevel','error','-re'];

    if(Number(seg.seek)>0){
      args.push('-ss',String(Math.max(0,Number(seg.seek))));
    }

    args.push('-i',seg.file);

    if(Number(seg.maxSeconds)>0){
      args.push('-t',String(Math.max(1,Math.ceil(Number(seg.maxSeconds)))));
    }

    args.push(
      '-vn',
      '-ac','2',
      '-ar','44100',
      '-c:a','libmp3lame',
      '-b:a',String(bitrate||'96k'),
      '-f','mp3',
      'pipe:1'
    );

    const p=spawn(ffmpegPath,args,{stdio:['ignore','pipe','pipe']});
    let stderr='';

    p.stderr.on('data',c=>{
      stderr+=c.toString();
      if(stderr.length>3000)stderr=stderr.slice(-3000);
    });

    p.stdout.on('data',chunk=>{
      if(!signalActive || signalStopRequested){
        try{p.kill('SIGKILL')}catch{}
        return;
      }
      if(!req.write(chunk))p.stdout.pause();
    });

    req.on('drain',()=>{
      try{p.stdout.resume()}catch{}
    });

    p.on('error',reject);

    p.on('close',code=>{
      if(signalStopRequested || !signalActive)return resolve();
      if(code===0 || code===255)return resolve();
      reject(new Error(
        'FFmpeg encerrou com código '+code+
        (stderr?' • '+stderr.trim():'')
      ));
    });
  });
}

async function runProgrammedSignal(items,c){
  const useTls=
    String(c.port)==='443' ||
    String(c.protocol||'').toLowerCase()==='https';

  const transport=useTls?https:http;
  const mount=normalizeMount(c.mount);
  const auth=Buffer.from((c.user||'source')+':'+c.password).toString('base64');

  const options={
    hostname:c.host,
    port:Number(c.port)||8000,
    path:mount,
    method:'PUT',
    headers:{
      'Authorization':'Basic '+auth,
      'Content-Type':'audio/mpeg',
      'User-Agent':'WebRadioVemComigoDeus/1.6',
      'Ice-Name':c.name||RADIO.nome,
      'Ice-Public':'0',
      'Transfer-Encoding':'chunked',
      'Connection':'keep-alive'
    }
  };

  const req=transport.request(options);
  signalRequest=req;

  req.on('response',res=>{
    pushSignalLog('Servidor de rádio respondeu HTTP '+res.statusCode+'.');
    res.on('data',()=>{});
  });

  let requestError=null;
  req.on('error',e=>{requestError=e;});

  while(signalActive && !signalStopRequested){
    if(requestError)throw requestError;

    const seg=txCurrentSegment(items);

    if(!seg?.file || !fs.existsSync(seg.file)){
      await sleep(2000);
      continue;
    }

    pushSignalLog('No ar: '+seg.label);
    await txPipeFileRealtime(seg,req,c.bitrate||'96k');
  }

  try{req.end()}catch{}
}

function startSignal(){
  const items=readSignalLibrary().filter(
    x=>x.path &&
       fs.existsSync(x.path) &&
       path.extname(x.path).toLowerCase()==='.mp3'
  );

  if(!items.length){
    throw new Error('Envie pelo menos uma música MP3 para a biblioteca do sinal.');
  }

  const c=signalConfig;

  if(!c.host || !c.port || !c.mount || !c.password){
    throw new Error('Configure host, porta, mount e senha do servidor da rádio.');
  }

  stopSignal();
  signalLog=[];
  signalStopRequested=false;
  signalActive=true;
  signalStartedAt=new Date().toISOString();
  signalLastExit=null;

  pushSignalLog(
    'Transmissor 1.6 iniciado: programação + apresentadores + louvores + encerramento.'
  );

  runProgrammedSignal(items,c).catch(err=>{
    pushSignalLog('Erro do sinal: '+err.message);
    signalLastExit={
      code:'PROGRAMMED_STREAM_ERROR',
      signal:null,
      at:new Date().toISOString(),
      message:err.message
    };
    signalActive=false;
    try{signalRequest?.destroy()}catch{}
    signalRequest=null;
  });

  return signalStatus();
}
`;

s=s.slice(0,a)+novo+s.slice(b);

fs.writeFileSync(file,s);
console.log('Transmissor 1.6 aplicado: programas agora entram no sinal do Caster.');
