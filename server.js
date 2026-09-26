import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import Busboy from 'busboy';

// Configuração embutida para evitar falha de deploy se a pasta data não for enviada.
const RADIO = {
  nome: 'Web Rádio Vem Comigo Deus',
  slogan: 'Uma palavra, um louvor e uma mensagem de fé para o seu dia.',
  timezone: 'America/Sao_Paulo'
};

const VOZES = {
  luiz: { nome: 'Pastor Luiz Felipe', voice: 'Puck', style: 'alegre, energético, otimista e comunicativo; português brasileiro natural' },
  ingrid: { nome: 'Missionária Ingrid Laura', voice: 'Sulafat', style: 'acolhedora, serena, carinhosa e próxima; português brasileiro natural' },
  bernardo: { nome: 'Pastor Bernardo Henrique', voice: 'Achird', style: 'amigável, motivador, encorajador e firme; português brasileiro natural' },
  heitor: { nome: 'Pastor Heitor Cruz', voice: 'Charon', style: 'solene, claro, profundo e pastoral; português brasileiro natural' },
  fernando: { nome: 'Pastor Fernando Baptista', voice: 'Fenrir', style: 'pentecostal forte, vibrante, enérgico e fervoroso; português brasileiro natural' },
  manuela: { nome: 'Pastora Manuela Rodrigues', voice: 'Pulcherrima', style: 'pentecostal intenso, expressivo, alegre e cheio de fé; português brasileiro natural' }
};

const PROGRAMAS = [
  { id: 'bom-dia-deus', nome: 'Bom Dia Deus', inicio: '09:00', fim: '10:00', apresentador: 'luiz' },
  { id: 'encontro-com-deus', nome: 'Encontro com Deus', inicio: '12:30', fim: '13:00', apresentador: 'ingrid' },
  { id: 'tarde-da-bencao', nome: 'Tarde da Benção', inicio: '18:00', fim: '19:00', apresentador: 'bernardo' },
  { id: 'culto-no-seu-lar', nome: 'Culto No Seu Lar', inicio: '19:00', fim: '21:00', apresentador: 'heitor' }
];

const LOUVORES = [
  {
    id: 'deus-vai-na-frente', titulo: 'Deus Vai na Frente', estilo: 'sertanejo gospel',
    direcao: 'Sertanejo gospel brasileiro original, violão e viola, bateria leve, baixo, refrão forte e congregacional, voz original sem imitar artista conhecido, 92 BPM, esperançoso.',
    letra: `[Verse 1]\nQuando a estrada fica escura\nE o coração quer parar\nEu lembro que Deus vai na frente\nPreparando o meu lugar\n\nPode o vento levantar\nPode a luta aparecer\nQuem caminha com o Senhor\nSempre encontra força pra vencer\n\n[Chorus]\nDeus vai na frente, eu vou pela fé\nMesmo sem ver, eu continuo de pé\nSe a porta fechou, Ele abre outra então\nDeus vai na frente segurando a minha mão\n\nDeus vai na frente, eu não vou temer\nO que hoje eu choro amanhã vou entender\nNa estrada da vida eu tenho direção\nDeus vai na frente segurando a minha mão\n\n[Bridge]\nSe eu cair, Ele levanta\nSe eu chorar, vem me consolar\nMeu futuro está nas mãos\nDaquele que nunca vai me abandonar`
  },
  {
    id: 'festa-no-ceu', titulo: 'Festa no Céu', estilo: 'forró gospel avivado',
    direcao: 'Forró gospel brasileiro original e avivado, sanfona, zabumba e triângulo, baixo alegre, palmas discretas, voz original, 132 BPM, clima de celebração.',
    letra: `[Verse 1]\nPode bater palma, pode celebrar\nHoje tem alegria neste lugar\nQuem chegou cansado vai se renovar\nPorque a presença de Deus já está no ar\n\n[Pre-Chorus]\nSe o coração estava abatido\nHoje vai sair fortalecido\nQuando o povo começa a louvar\nA tristeza não consegue ficar\n\n[Chorus]\nTem festa no céu, tem festa aqui\nEu sinto a presença de Deus sobre mim\nBate a palma, dá glória e vem celebrar\nJesus está vivo e veio nos renovar\n\nTem festa no céu, pode agradecer\nO Deus do impossível tem todo poder\nHoje é dia de cantar e sorrir\nCom Jesus no caminho eu não vou desistir`
  },
  {
    id: 'so-quero-tua-presenca', titulo: 'Só Quero Tua Presença', estilo: 'adoração',
    direcao: 'Adoração cristã brasileira original, piano íntimo, pads suaves, violão, crescimento gradual, voz emotiva original, 68 BPM, reverente e profunda.',
    letra: `[Verse 1]\nQuando tudo se cala\nE eu fico diante de Ti\nNão preciso de palavras\nTu conheces tudo em mim\n\nEu não venho pelas bênçãos\nNem somente pra pedir\nHoje eu quero apenas\nTeu amor sentir\n\n[Chorus]\nSó quero Tua presença\nSó quero Te adorar\nEsquecer de mim por um momento\nE aos Teus pés ficar\n\nSó quero Tua presença\nMeu coração Te entregar\nQue tudo em mim seja silêncio\nPara ouvir Tua voz falar\n\n[Bridge]\nFica comigo, Senhor\nFica comigo\nNão quero caminhar\nSem Tua presença comigo`
  },
  {
    id: 'o-fogo-vai-descer', titulo: 'O Fogo Vai Descer', estilo: 'avivado pentecostal',
    direcao: 'Gospel pentecostal brasileiro original, órgão, bateria intensa, metais discretos, baixo pulsante, coro congregacional original, 118 BPM, fervoroso e crescente.',
    letra: `[Verse 1]\nA igreja está reunida\nE a fé começou a crescer\nTem oração subindo ao céu\nAlgo grande vai acontecer\n\nQuem chegou sem esperança\nHoje vai voltar a sonhar\nQuando Deus entra na batalha\nNinguém consegue impedir Seu agir\n\n[Chorus]\nO fogo vai descer\nA igreja vai cantar\nQuem estava abatido\nVai se levantar\n\nO fogo vai descer\nA fé vai incendiar\nQuando Deus manda a vitória\nNinguém pode segurar\n\n[Bridge]\nTem renovo chegando\nTem resposta chegando\nTem esperança voltando\nDeus está trabalhando`
  },
  {
    id: 'minha-casa-pertence-a-deus', titulo: 'Minha Casa Pertence a Deus', estilo: 'sertanejo gospel / adoração',
    direcao: 'Sertanejo gospel brasileiro original com atmosfera de adoração, violão, viola, piano e bateria suave, voz original, 82 BPM, familiar e emocionante.',
    letra: `[Verse 1]\nSobre esta casa eu faço uma oração\nQue nunca falte amor e comunhão\nQue em cada quarto exista Tua paz\nE o medo não volte nunca mais\n\nProtege os filhos, guarda o coração\nDá sabedoria e direção\nQue mesmo em dias de dificuldade\nNossa família permaneça na verdade\n\n[Chorus]\nMinha casa pertence a Deus\nMinha família está nas mãos de Deus\nPode a tempestade aparecer\nNós vamos juntos permanecer\n\nMinha casa pertence ao Senhor\nAqui vai morar a fé e o amor\nEnquanto houver vida neste lar\nO nome de Jesus vamos exaltar`
  }
];

const TEMAS = [
  { tema: 'Deus abre caminhos', texto: 'Êxodo 14:13-16' },
  { tema: 'Não desista no meio da luta', texto: 'Isaías 40:31' },
  { tema: 'A paz em meio à tempestade', texto: 'Marcos 4:35-41' },
  { tema: 'A oração que fortalece', texto: 'Filipenses 4:6-7' },
  { tema: 'Deus cuida da sua casa', texto: 'Josué 24:15' },
  { tema: 'Esperança para recomeçar', texto: 'Lamentações 3:22-23' },
  { tema: 'A fé que continua caminhando', texto: 'Hebreus 11:1' },
  { tema: 'Descanso para o coração', texto: 'Mateus 11:28' }
];

const FALLBACKS = {
  palavra: [
    'Mesmo quando você não consegue enxergar a saída, continue firme. Deus trabalha também nos períodos de silêncio. Ore, faça o que está ao seu alcance e caminhe com fé um passo de cada vez.',
    'A Palavra nos convida a trocar a ansiedade pela oração. Entregue a Deus aquilo que pesa no coração e permita que a esperança seja renovada hoje.',
    'Não permita que uma dificuldade de hoje apague tudo o que Deus já fez em sua caminhada. Há momentos em que a fé é simplesmente continuar obedecendo e confiando.'
  ],
  oracao: [
    'Senhor Deus, visita cada pessoa que nos acompanha agora. Fortalece quem está cansado, consola quem está chorando, dá sabedoria a quem precisa decidir e coloca paz dentro de cada lar. Em nome de Jesus, amém.',
    'Pai, entregamos este momento em Tuas mãos. Guarda nossas famílias, renova nossa fé e ensina-nos a caminhar com amor, humildade e esperança. Que a Tua paz permaneça conosco. Amém.'
  ],
  fe: [
    'Mensagem de fé: o dia pode ter sido difícil, mas ele não define o seu amanhã. Continue orando, continue fazendo o bem e não abandone a esperança.',
    'Mensagem de fé: você não precisa ter todas as respostas hoje. Dê o próximo passo com confiança e coloque diante de Deus aquilo que você ainda não consegue resolver.'
  ]
};


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash';
const MUSIC_MODEL = process.env.GEMINI_MUSIC_MODEL || 'lyria-3.5';

// Limites conservadores: a conta gratuita mostrou 10 TTS/dia.
// O painel usa no máximo 4 TTS/dia (1 por programa) e deixa margem de segurança.
const MAX_TTS_DAY = Number(process.env.MAX_TTS_DAY || 4);
const MAX_TEXT_DAY = Number(process.env.MAX_TEXT_DAY || 4);
const MAX_MUSIC_DAY = Number(process.env.MAX_MUSIC_DAY || 1);
const ALLOW_ADHOC_TTS = process.env.ALLOW_ADHOC_TTS === 'true';

const STORAGE_ROOT = process.env.RADIO_STORAGE_DIR || path.join(__dirname, 'cache');
const CACHE_DIR = STORAGE_ROOT;
const TTS_CACHE_DIR = path.join(CACHE_DIR, 'tts');
const MUSIC_CACHE_DIR = path.join(CACHE_DIR, 'music');
const CONTENT_CACHE_DIR = path.join(CACHE_DIR, 'content');
const STATE_DIR = path.join(CACHE_DIR, 'state');
for (const d of [TTS_CACHE_DIR, MUSIC_CACHE_DIR, CONTENT_CACHE_DIR, STATE_DIR]) fs.mkdirSync(d, { recursive: true });

// ===== Transmissão Icecast / SHOUTcast =====
const SIGNAL_DIR = path.join(CACHE_DIR, 'signal');
const SIGNAL_UPLOAD_DIR = path.join(SIGNAL_DIR, 'uploads');
const SIGNAL_PLAYLIST = path.join(SIGNAL_DIR, 'playlist.ffconcat');
const SIGNAL_LIBRARY = path.join(SIGNAL_DIR, 'library.json');
for (const d of [SIGNAL_DIR, SIGNAL_UPLOAD_DIR]) fs.mkdirSync(d, { recursive: true });

let signalProcess = null;
let signalStartedAt = null;
let signalLastExit = null;
let signalLog = [];
let signalConfig = {
  host: process.env.ICECAST_HOST || '',
  port: process.env.ICECAST_PORT || '8000',
  mount: process.env.ICECAST_MOUNT || '/stream',
  user: process.env.ICECAST_USER || 'source',
  password: process.env.ICECAST_PASSWORD || '',
  name: process.env.ICECAST_NAME || RADIO.nome,
  bitrate: process.env.ICECAST_BITRATE || '96k'
};
const ADMIN_TOKEN = process.env.RADIO_ADMIN_TOKEN || '';

function isAdmin(req){ return Boolean(ADMIN_TOKEN) && req.headers['x-admin-token'] === ADMIN_TOKEN; }
function requireAdmin(req,res){
  if (!ADMIN_TOKEN) { json(res,503,{ok:false,error:'Configure RADIO_ADMIN_TOKEN no Render antes de controlar o sinal.'}); return false; }
  if (!isAdmin(req)) { json(res,401,{ok:false,error:'Senha do painel inválida.'}); return false; }
  return true;
}
function readBody(req, max=1024*1024){
  return new Promise((resolve,reject)=>{
    let size=0, chunks=[];
    req.on('data',c=>{ size+=c.length; if(size>max){reject(new Error('Requisição grande demais')); req.destroy();} else chunks.push(c); });
    req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error',reject);
  });
}
function readSignalLibrary(){ try{return JSON.parse(fs.readFileSync(SIGNAL_LIBRARY,'utf8'));}catch{return [];} }
function writeSignalLibrary(items){ fs.writeFileSync(SIGNAL_LIBRARY, JSON.stringify(items,null,2)); }
function publicSignalConfig(){ return {host:signalConfig.host,port:signalConfig.port,mount:signalConfig.mount,user:signalConfig.user,name:signalConfig.name,bitrate:signalConfig.bitrate,passwordConfigured:Boolean(signalConfig.password),envConfigured:Boolean(process.env.ICECAST_HOST && process.env.ICECAST_PASSWORD)}; }
function signalRunning(){ return Boolean(signalProcess && signalProcess.exitCode === null && !signalProcess.killed); }
function signalStatus(){ return {running:signalRunning(),startedAt:signalStartedAt,lastExit:signalLastExit,config:publicSignalConfig(),libraryCount:readSignalLibrary().length,log:signalLog.slice(-16)}; }
function pushSignalLog(line){ line=String(line||'').trim(); if(!line) return; signalLog.push(line); if(signalLog.length>80) signalLog=signalLog.slice(-80); }
function normalizeMount(m){ if(!m) return '/stream'; return m.startsWith('/')?m:`/${m}`; }
function writeFfconcat(items){
  const lines=['ffconcat version 1.0'];
  for(const x of items){ const p=path.resolve(x.path).replace(/'/g,"'\\''"); lines.push(`file '${p}'`); }
  fs.writeFileSync(SIGNAL_PLAYLIST, lines.join('\n')+'\n');
}
function stopSignal(){
  if(signalProcess && signalProcess.exitCode===null){
    try{signalProcess.kill('SIGTERM')}catch{}
    const p=signalProcess;
    setTimeout(()=>{try{if(p.exitCode===null)p.kill('SIGKILL')}catch{}},2500);
  }
  signalProcess=null; signalStartedAt=null;
}
function startSignal(){
  const items=readSignalLibrary().filter(x=>x.path && fs.existsSync(x.path));
  if(!items.length) throw new Error('Envie pelo menos uma música para a biblioteca do sinal.');
  const c=signalConfig;
  if(!c.host || !c.port || !c.mount || !c.password) throw new Error('Configure host, porta, mount e senha do Icecast.');
  if(!ffmpegPath) throw new Error('FFmpeg não está disponível neste servidor.');
  stopSignal();
  writeFfconcat(items);
  const authUser=encodeURIComponent(c.user||'source');
  const authPass=encodeURIComponent(c.password);
  const mount=normalizeMount(c.mount).split('/').map((x,i)=>i===0?'':encodeURIComponent(x)).join('/');
  const out=`icecast://${authUser}:${authPass}@${c.host}:${c.port}${mount}`;
  const args=['-hide_banner','-loglevel','warning','-re','-stream_loop','-1','-f','concat','-safe','0','-i',SIGNAL_PLAYLIST,'-vn','-ac','2','-ar','44100','-c:a','libmp3lame','-b:a',c.bitrate||'96k','-content_type','audio/mpeg','-ice_name',c.name||RADIO.nome,'-f','mp3',out];
  signalLog=[]; pushSignalLog(`Iniciando encoder com ${items.length} arquivo(s).`);
  const proc=spawn(ffmpegPath,args,{stdio:['ignore','ignore','pipe']});
  signalProcess=proc; signalStartedAt=new Date().toISOString(); signalLastExit=null;
  proc.stderr.on('data',d=>String(d).split(/\r?\n/).forEach(pushSignalLog));
  proc.on('error',e=>pushSignalLog(`Erro do encoder: ${e.message}`));
  proc.on('exit',(code,signal)=>{ signalLastExit={code,signal,at:new Date().toISOString()}; pushSignalLog(`Encoder encerrado (code=${code}, signal=${signal||'-'}).`); if(signalProcess===proc) signalProcess=null; });
  return signalStatus();
}
async function uploadSignalAudio(req){
  return new Promise((resolve,reject)=>{
    const bb=Busboy({headers:req.headers,limits:{files:60,fileSize:40*1024*1024}});
    const previous=readSignalLibrary(); const added=[]; const pending=[]; let seq=0;
    bb.on('file',(field,file,info)=>{
      const original=info.filename||`audio-${Date.now()}.mp3`; const ext=path.extname(original).toLowerCase();
      if(!['.mp3','.wav','.m4a','.aac','.ogg','.flac'].includes(ext)){ file.resume(); return; }
      const safe=`${Date.now()}-${seq++}-${crypto.randomBytes(3).toString('hex')}${ext}`; const dest=path.join(SIGNAL_UPLOAD_DIR,safe);
      const ws=fs.createWriteStream(dest); let bytes=0; file.on('data',c=>bytes+=c.length); file.pipe(ws);
      pending.push(new Promise((res,rej)=>{ws.on('close',()=>{added.push({id:safe,name:original,path:dest,bytes,addedAt:new Date().toISOString()});res();});ws.on('error',rej);}));
    });
    bb.on('error',reject);
    bb.on('finish',async()=>{try{await Promise.all(pending);const items=[...previous,...added];writeSignalLibrary(items);resolve({added,items});}catch(e){reject(e)}});
    req.pipe(bb);
  });
}


const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

function nowParts() {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: RADIO.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).reduce((a,p) => (a[p.type]=p.value,a), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, full: `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}` };
}
function mins(hm){ const [h,m]=hm.split(':').map(Number); return h*60+m; }
function scheduleState() {
  const now = nowParts();
  const minute = mins(now.time);
  const currentIndex = PROGRAMAS.findIndex(p => minute >= mins(p.inicio) && minute < mins(p.fim));
  const current = currentIndex >= 0 ? PROGRAMAS[currentIndex] : null;
  const future = PROGRAMAS.find(p => mins(p.inicio) > minute);
  const next = future || PROGRAMAS[0];
  let untilNext = mins(next.inicio) - minute;
  if (!future || untilNext <= 0) untilNext += 24 * 60;
  return {
    now,
    minute,
    currentIndex,
    current,
    next,
    untilNext,
    filler: current ? null : {
      id: 'louvores-que-edificam',
      nome: 'Louvores que Edificam',
      descricao: 'Rotação automática de louvores até o próximo programa'
    },
    mode: current ? 'programa' : 'louvores'
  };
}
function currentProgram() { return scheduleState().current; }
function nextProgram() { return scheduleState().next; }
function pick(arr, seed='') {
  const h = crypto.createHash('sha1').update(seed || String(Date.now())).digest().readUInt32BE(0);
  return arr[h % arr.length];
}
function hash(s){ return crypto.createHash('sha1').update(s).digest('hex'); }
function programId(p){ return p?.id || String(p?.nome || 'automatico').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

function budgetPath(date=nowParts().date){ return path.join(STATE_DIR, `quota-${date}.json`); }
function readBudget(date=nowParts().date){
  try { return { date, tts:0, text:0, music:0, ...JSON.parse(fs.readFileSync(budgetPath(date),'utf8')) }; }
  catch { return { date, tts:0, text:0, music:0 }; }
}
function writeBudget(b){ fs.writeFileSync(budgetPath(b.date), JSON.stringify(b,null,2)); }
function reserve(kind, max, date=nowParts().date){
  const b=readBudget(date);
  if ((b[kind]||0) >= max) throw new Error(`Limite de segurança diário atingido para ${kind}: ${b[kind]}/${max}. O motor não fará mais chamadas hoje.`);
  b[kind]=(b[kind]||0)+1; writeBudget(b); return b;
}
function quotaSummary(){
  const b=readBudget();
  return { ...b, limits:{ tts:MAX_TTS_DAY, text:MAX_TEXT_DAY, music:MAX_MUSIC_DAY }, remaining:{ tts:Math.max(0,MAX_TTS_DAY-b.tts), text:Math.max(0,MAX_TEXT_DAY-b.text), music:Math.max(0,MAX_MUSIC_DAY-b.music) } };
}

function buildFallbackProgram(program) {
  const now = nowParts();
  const voiceKey = program?.apresentador || (Number(now.time.slice(0,2)) < 12 ? 'luiz' : Number(now.time.slice(0,2)) < 18 ? 'ingrid' : 'heitor');
  const host = VOZES[voiceKey];
  const showName = program?.nome || 'Louvores que Edificam';
  const seed = `${now.date}-${showName}`;
  const tema = pick(TEMAS, seed);
  const song1 = pick(LOUVORES, seed+'a');
  const song2 = pick(LOUVORES.filter(x => x.id !== song1.id), seed+'b');
  const intro = `A paz do Senhor! Você está na ${RADIO.nome}. Está começando ${showName}. Eu sou ${host.nome}. Teremos louvores, Palavra de Deus, oração e, no final, uma mensagem de fé. Fique conosco.`;
  const word = `Nossa palavra de hoje tem como tema: ${tema.tema}, com base em ${tema.texto}. ${pick(FALLBACKS.palavra, seed+'p')}`;
  const prayer = pick(FALLBACKS.oracao, seed+'o');
  const faith = pick(FALLBACKS.fe, seed+'f');
  const outro = `Você ouviu ${showName}, na ${RADIO.nome}. Que Deus abençoe você e sua família. Continue conosco.`;
  return { showName, hostKey: voiceKey, host, tema, queue: [
    {type:'speech', label:'Abertura', text:intro, voiceKey},
    {type:'song', label:song1.titulo, songId:song1.id},
    {type:'speech', label:'Palavra', text:word, voiceKey},
    {type:'song', label:song2.titulo, songId:song2.id},
    {type:'speech', label:'Oração', text:prayer, voiceKey},
    {type:'speech', label:'Mensagem de Fé', text:faith, voiceKey},
    {type:'speech', label:'Encerramento', text:outro, voiceKey}
  ]};
}

function programCachePath(date, p){ return path.join(CONTENT_CACHE_DIR, `${date}-${programId(p)}.json`); }
function loadProgramCache(date,p){ try{return JSON.parse(fs.readFileSync(programCachePath(date,p),'utf8'));}catch{return null;} }
function saveProgramCache(date,p,data){ fs.writeFileSync(programCachePath(date,p), JSON.stringify(data,null,2)); }

async function generateProgram(program, allowAI=false) {
  const date=nowParts().date;
  const cached=loadProgramCache(date,program);
  if (cached) return cached;
  const base = buildFallbackProgram(program);
  if (!allowAI || !ai) return base;
  const prompt = `Crie conteúdo ORIGINAL em português brasileiro para a rádio cristã ${RADIO.nome}, programa ${base.showName}, apresentado por ${base.host.nome}. Tema bíblico: ${base.tema.tema}; texto-base: ${base.tema.texto}. Produza JSON estrito com chaves palavra, oracao, fe. palavra: uma minipregação de 500 a 800 palavras com introdução, 3 pontos, aplicação e conclusão, sem inventar citações bíblicas. oracao: 120 a 180 palavras. fe: mensagem final de 90 a 140 palavras. Tom: ${base.host.style}. Não mencione que é IA.`;
  reserve('text', MAX_TEXT_DAY, date);
  try {
    const r = await ai.models.generateContent({ model: TEXT_MODEL, contents: prompt, config: { responseMimeType: 'application/json' } });
    const parsed = JSON.parse(r.text || '{}');
    const map = { 'Palavra': parsed.palavra, 'Oração': parsed.oracao, 'Mensagem de Fé': parsed.fe };
    base.queue = base.queue.map(q => map[q.label] ? {...q, text: map[q.label]} : q);
    saveProgramCache(date,program,base);
  } catch (e) {
    console.error('text generation fallback:', e.message);
    // Salva o fallback para impedir tentativas repetidas no mesmo dia.
    saveProgramCache(date,program,base);
  }
  return base;
}

async function tts(text, voiceKey, {countQuota=true}={}) {
  const v = VOZES[voiceKey] || VOZES.luiz;
  const key = hash(`${TTS_MODEL}|${v.voice}|${v.style}|${text}`);
  const out = path.join(TTS_CACHE_DIR, `${key}.wav`);
  if (fs.existsSync(out)) return out;
  if (!ai) throw new Error('GEMINI_API_KEY não configurada');
  if (countQuota) reserve('tts', MAX_TTS_DAY);
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ role:'user', parts:[{ text, speech_metadata:{ style:v.style } }] }],
    config: { responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ voice:v.voice } } }
  });
  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error('TTS não retornou áudio');
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  return out;
}

function spokenScript(programData){
  return programData.queue.filter(q=>q.type==='speech').map(q=>`${q.label}. ${q.text}`).join('\n\n');
}
function manifestPath(date=nowParts().date){ return path.join(CONTENT_CACHE_DIR, `daily-${date}.json`); }
function readManifest(date=nowParts().date){ try{return JSON.parse(fs.readFileSync(manifestPath(date),'utf8'));}catch{return {date,programs:{}};} }
function writeManifest(m){ fs.writeFileSync(manifestPath(m.date), JSON.stringify(m,null,2)); }

async function prepareDay(){
  const date=nowParts().date;
  const manifest=readManifest(date);
  const results=[];
  for (const p of PROGRAMAS) {
    const id=programId(p);
    if (manifest.programs[id]?.audio && fs.existsSync(manifest.programs[id].audio)) {
      results.push({id,nome:p.nome,status:'cached'}); continue;
    }
    const pdata=await generateProgram(p,true);
    const audio=await tts(spokenScript(pdata), pdata.hostKey, {countQuota:true});
    manifest.programs[id]={ nome:p.nome, host:pdata.host.nome, voiceKey:pdata.hostKey, audio, createdAt:new Date().toISOString() };
    writeManifest(manifest);
    results.push({id,nome:p.nome,status:'generated'});
  }
  return {date,results,quota:quotaSummary()};
}

async function music(songId, allowGenerate=false) {
  const song = LOUVORES.find(s => s.id === songId);
  if (!song) throw new Error('Louvor não encontrado');
  const key = hash(`${MUSIC_MODEL}|${song.direcao}|${song.letra}`);
  const out = path.join(MUSIC_CACHE_DIR, `${key}.mp3`);
  if (fs.existsSync(out)) return out;
  if (!allowGenerate) throw new Error('Louvor ainda não foi preparado. Gere pelo painel administrativo.');
  if (!ai) throw new Error('GEMINI_API_KEY não configurada');
  const q = quotaSummary();
  if (q.music >= MAX_MUSIC_DAY) throw new Error(`Limite econômico de música atingido hoje (${q.music}/${MAX_MUSIC_DAY}). Tente amanhã ou aumente MUSIC_DAILY_LIMIT no Render.`);
  const prompt = `Crie uma música cristã ORIGINAL em português brasileiro, sem imitar artista ou música existente. ${song.direcao}\n\nUse exatamente esta letra original como base:\n${song.letra}`;
  const interaction = await ai.interactions.create({ model: MUSIC_MODEL, input: prompt });
  const data = interaction.outputAudio?.data || interaction.output_audio?.data;
  if (!data) throw new Error('Lyria não retornou áudio. Verifique se o modelo está liberado na sua conta/região.');
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  reserve('music', MAX_MUSIC_DAY); // só conta depois que o MP3 foi salvo com sucesso
  return out;
}


function listPreparedAssets(){
  const assets=[];
  try {
    for (const f of fs.readdirSync(TTS_CACHE_DIR)) {
      if (f.endsWith('.wav')) assets.push({type:'speech', title:'Mensagem preparada', url:`/api/cache/tts/${encodeURIComponent(f)}`});
    }
  } catch {}
  try {
    for (const f of fs.readdirSync(MUSIC_CACHE_DIR)) {
      if (f.endsWith('.mp3')) assets.push({type:'song', title:'Louvor original', url:`/api/cache/music/${encodeURIComponent(f)}`});
    }
  } catch {}
  try {
    for (const f of fs.readdirSync(CONTENT_CACHE_DIR)) {
      if (!f.startsWith('daily-') || !f.endsWith('.json')) continue;
      const m=JSON.parse(fs.readFileSync(path.join(CONTENT_CACHE_DIR,f),'utf8'));
      for (const [id,item] of Object.entries(m.programs||{})) {
        if (item?.audio && fs.existsSync(item.audio)) assets.push({type:'program', title:item.nome||id, host:item.host||'', url:`/api/daily-audio/${encodeURIComponent(id)}?date=${m.date}`});
      }
    }
  } catch {}
  const seen=new Set();
  return assets.filter(a=>!seen.has(a.url) && seen.add(a.url));
}

function rotationQueue(){
  const cur=currentProgram();
  const assets=listPreparedAssets();
  if (!assets.length) return [];
  const programs=assets.filter(a=>a.type==='program');
  const songs=assets.filter(a=>a.type==='song');
  const speech=assets.filter(a=>a.type==='speech');
  const q=[];
  if (cur) {
    const hit=programs.find(a=>a.title===cur.nome);
    if (hit) q.push(hit);
  }
  // Intercala música e palavra para preencher as 24h sem silêncio.
  const max=Math.max(songs.length,speech.length,programs.length,1);
  for(let i=0;i<max*3;i++){
    if (songs.length) q.push(songs[i%songs.length]);
    if (speech.length) q.push(speech[i%speech.length]);
    if (programs.length) q.push(programs[i%programs.length]);
  }
  const seenFirst=new Set();
  return q.filter((a,i)=> i<3 || !seenFirst.has(a.url) && seenFirst.add(a.url));
}

function serveFile(res, file, mime) {
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  const ext = path.extname(file).toLowerCase();
  const dynamicAsset = ['.html', '.js', '.css'].includes(ext);
  res.writeHead(200, {
    'content-type': mime,
    'cache-control': dynamicAsset ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400'
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req,res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    if (u.pathname === '/api/signal/status') return json(res,200,{ok:true,...signalStatus()});
    if (u.pathname === '/api/signal/config' && req.method === 'POST') {
      if(!requireAdmin(req,res)) return;
      const body=JSON.parse((await readBody(req))||'{}');
      signalConfig={...signalConfig,...body,mount:normalizeMount(body.mount??signalConfig.mount)};
      return json(res,200,{ok:true,config:publicSignalConfig()});
    }
    if (u.pathname === '/api/signal/upload' && req.method === 'POST') {
      if(!requireAdmin(req,res)) return;
      const result=await uploadSignalAudio(req);
      return json(res,200,{ok:true,added:result.added.map(({path,...x})=>x),count:result.items.length});
    }
    if (u.pathname === '/api/signal/library') {
      const items=readSignalLibrary().map(({path,...x})=>x); return json(res,200,{ok:true,items,count:items.length});
    }
    if (u.pathname === '/api/signal/start' && req.method === 'POST') {
      if(!requireAdmin(req,res)) return;
      const st=startSignal(); return json(res,200,{ok:true,...st});
    }
    if (u.pathname === '/api/signal/stop' && req.method === 'POST') {
      if(!requireAdmin(req,res)) return; stopSignal(); return json(res,200,{ok:true,...signalStatus()});
    }
    if (u.pathname === '/api/signal/clear' && req.method === 'POST') {
      if(!requireAdmin(req,res)) return; stopSignal(); for(const x of readSignalLibrary()){try{if(x.path)fs.unlinkSync(x.path)}catch{}} writeSignalLibrary([]); return json(res,200,{ok:true,count:0});
    }

    if (u.pathname === '/api/status') {
      const state = scheduleState();
      const manifest=readManifest();
      return json(res,200,{
        ok:true,
        radio:RADIO,
        now:state.now,
        current:state.current,
        currentIndex:state.currentIndex,
        next:state.next,
        untilNext:state.untilNext,
        filler:state.filler,
        mode:state.mode,
        voices:VOZES,
        configured:Boolean(apiKey),
        quota:quotaSummary(),
        prepared:Object.keys(manifest.programs||{}).length
      });
    }
    if (u.pathname === '/api/quota') return json(res,200,{ok:true,quota:quotaSummary()});
    if (u.pathname === '/api/library') return json(res,200,{ok:true,assets:listPreparedAssets(),count:listPreparedAssets().length});
    if (u.pathname === '/api/rotation') return json(res,200,{ok:true,queue:rotationQueue(),current:currentProgram(),next:nextProgram()});
    if (u.pathname.startsWith('/api/cache/tts/')) { const f=path.basename(decodeURIComponent(u.pathname.split('/').pop())); return serveFile(res,path.join(TTS_CACHE_DIR,f),'audio/wav'); }
    if (u.pathname.startsWith('/api/cache/music/')) { const f=path.basename(decodeURIComponent(u.pathname.split('/').pop())); return serveFile(res,path.join(MUSIC_CACHE_DIR,f),'audio/mpeg'); }
    if (u.pathname === '/api/prepare-day') {
      if (!ai) return json(res,400,{ok:false,error:'GEMINI_API_KEY não configurada'});
      const result=await prepareDay();
      return json(res,200,{ok:true,...result});
    }
    if (u.pathname === '/api/program') {
      const cur = currentProgram();
      const data=await generateProgram(cur,false); // nunca gasta IA ao abrir site
      const manifest=readManifest(); const id=programId(cur);
      const prepared=manifest.programs?.[id];
      return json(res,200,{ ok:true, ...data, preparedAudio: prepared ? `/api/daily-audio/${encodeURIComponent(id)}?date=${manifest.date}` : null });
    }
    if (u.pathname.startsWith('/api/daily-audio/')) {
      const id=decodeURIComponent(u.pathname.split('/').pop());
      const date=u.searchParams.get('date') || nowParts().date;
      const m=readManifest(date); const item=m.programs?.[id];
      if (!item?.audio) return json(res,404,{ok:false,error:'Áudio do programa ainda não foi preparado.'});
      return serveFile(res,item.audio,'audio/wav');
    }
    if (u.pathname === '/api/songs') return json(res,200,{ok:true,songs:LOUVORES.map(({letra,...s})=>s)});
    if (u.pathname === '/api/jingle') {
      const cur = currentProgram();
      const showName = cur?.nome || 'Louvores que Edificam';
      const host = VOZES[cur?.apresentador || 'luiz'];
      const text = `Você está ouvindo a ${RADIO.nome}. Agora, ${showName}${cur ? `, com ${host.nome}` : ''}. Louvores, Palavra de Deus, oração e uma mensagem de fé para o seu coração.`;
      return json(res,200,{ok:true,program:showName,text,cached:true});
    }
    if (u.pathname === '/api/tts') {
      const text = u.searchParams.get('text') || ''; const voice = u.searchParams.get('voice') || 'luiz';
      if (!text || text.length > 12000) return json(res,400,{ok:false,error:'Texto ausente ou grande demais'});
      const v=VOZES[voice]||VOZES.luiz; const key=hash(`${TTS_MODEL}|${v.voice}|${v.style}|${text}`); const cached=path.join(TTS_CACHE_DIR,`${key}.wav`);
      if (!fs.existsSync(cached) && !ALLOW_ADHOC_TTS) return json(res,429,{ok:false,error:'Geração avulsa de voz está desativada para economizar a cota. Use “Preparar programação de hoje” no painel.'});
      const file = await tts(text, voice, {countQuota:!fs.existsSync(cached)}); return serveFile(res,file,'audio/wav');
    }
    if (u.pathname === '/api/prepare-song') {
      const id=u.searchParams.get('id')||'';
      if (!id) return json(res,400,{ok:false,error:'ID do louvor ausente'});
      const file=await music(id,true);
      const song=LOUVORES.find(s=>s.id===id);
      return json(res,200,{ok:true,id,title:song?.titulo||id,url:`/api/music/${encodeURIComponent(id)}`,quota:quotaSummary()});
    }
    if (u.pathname.startsWith('/api/music/')) {
      const id = decodeURIComponent(u.pathname.split('/').pop());
      const allow=u.searchParams.get('generate')==='1';
      const file = await music(id,allow); return serveFile(res,file,'audio/mpeg');
    }
    const rel = u.pathname === '/' ? '/index.html' : u.pathname;
    const safe = path.normalize(rel).replace(/^\.\.(\/|\\|$)/,'');
    const file = path.join(__dirname,'public',safe);
    const ext=path.extname(file); const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[ext]||'application/octet-stream';
    return serveFile(res,file,mime);
  } catch(e){ console.error(e); return json(res,500,{ok:false,error:e.message}); }
});
server.listen(PORT,()=>console.log(`${RADIO.nome} em http://localhost:${PORT}`));
