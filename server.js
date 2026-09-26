import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { RADIO, PROGRAMAS, VOZES } from './data/config.js';
import { LOUVORES, TEMAS, FALLBACKS } from './data/content.js';

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

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

function nowParts() {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: RADIO.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date()).reduce((a,p) => (a[p.type]=p.value,a), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, full: `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}` };
}
function mins(hm){ const [h,m]=hm.split(':').map(Number); return h*60+m; }
function currentProgram() {
  const { time } = nowParts(); const m = mins(time);
  return PROGRAMAS.find(p => m >= mins(p.inicio) && m < mins(p.fim)) || null;
}
function nextProgram() {
  const { time } = nowParts(); const m = mins(time);
  return PROGRAMAS.find(p => mins(p.inicio) > m) || PROGRAMAS[0];
}
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
  reserve('music', MAX_MUSIC_DAY);
  const prompt = `Crie uma música cristã ORIGINAL em português brasileiro, sem imitar artista ou música existente. ${song.direcao}\n\nUse exatamente esta letra original como base:\n${song.letra}`;
  const interaction = await ai.interactions.create({ model: MUSIC_MODEL, input: prompt });
  const data = interaction.outputAudio?.data || interaction.output_audio?.data;
  if (!data) throw new Error('Lyria não retornou áudio. Verifique se o modelo está liberado na sua conta/região.');
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
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
  res.writeHead(200, { 'content-type': mime, 'cache-control': 'public, max-age=86400' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req,res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    if (u.pathname === '/api/status') {
      const cur = currentProgram(), next = nextProgram();
      const manifest=readManifest();
      return json(res,200,{ ok:true, radio:RADIO, now:nowParts(), current:cur, next, voices:VOZES, configured:Boolean(apiKey), quota:quotaSummary(), prepared:Object.keys(manifest.programs||{}).length });
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
