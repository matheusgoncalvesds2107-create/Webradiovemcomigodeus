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

// O Render/Git não preserva pastas vazias. Crie o cache em toda inicialização.
const TTS_CACHE_DIR = path.join(__dirname, 'cache', 'tts');
const MUSIC_CACHE_DIR = path.join(__dirname, 'cache', 'music');
fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
fs.mkdirSync(MUSIC_CACHE_DIR, { recursive: true });

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

async function generateProgram(program) {
  const base = buildFallbackProgram(program);
  if (!ai) return base;
  const prompt = `Crie conteúdo ORIGINAL em português brasileiro para a rádio cristã ${RADIO.nome}, programa ${base.showName}, apresentado por ${base.host.nome}. Tema bíblico: ${base.tema.tema}; texto-base: ${base.tema.texto}. Produza JSON estrito com chaves palavra, oracao, fe. palavra: uma minipregação de 500 a 800 palavras com introdução, 3 pontos, aplicação e conclusão, sem inventar citações bíblicas. oracao: 120 a 180 palavras. fe: mensagem final de 90 a 140 palavras. Tom: ${base.host.style}. Não mencione que é IA.`;
  try {
    const r = await ai.models.generateContent({ model: TEXT_MODEL, contents: prompt, config: { responseMimeType: 'application/json' } });
    const parsed = JSON.parse(r.text || '{}');
    const map = { 'Palavra': parsed.palavra, 'Oração': parsed.oracao, 'Mensagem de Fé': parsed.fe };
    base.queue = base.queue.map(q => map[q.label] ? {...q, text: map[q.label]} : q);
  } catch (e) { console.error('text generation fallback:', e.message); }
  return base;
}

async function tts(text, voiceKey) {
  const v = VOZES[voiceKey] || VOZES.luiz;
  const key = hash(`${TTS_MODEL}|${v.voice}|${v.style}|${text}`);
  const out = path.join(TTS_CACHE_DIR, `${key}.wav`);
  if (fs.existsSync(out)) return out;
  if (!ai) throw new Error('GEMINI_API_KEY não configurada');
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

async function music(songId) {
  const song = LOUVORES.find(s => s.id === songId);
  if (!song) throw new Error('Louvor não encontrado');
  const key = hash(`${MUSIC_MODEL}|${song.direcao}|${song.letra}`);
  const out = path.join(MUSIC_CACHE_DIR, `${key}.mp3`);
  if (fs.existsSync(out)) return out;
  if (!ai) throw new Error('GEMINI_API_KEY não configurada');
  const prompt = `Crie uma música cristã ORIGINAL em português brasileiro, sem imitar artista ou música existente. ${song.direcao}\n\nUse exatamente esta letra original como base:\n${song.letra}`;
  const interaction = await ai.interactions.create({ model: MUSIC_MODEL, input: prompt });
  const data = interaction.outputAudio?.data || interaction.output_audio?.data;
  if (!data) throw new Error('Lyria não retornou áudio. Verifique se o modelo está liberado na sua conta/região.');
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  return out;
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
      return json(res,200,{ ok:true, radio:RADIO, now:nowParts(), current:cur, next, voices:VOZES, configured:Boolean(apiKey) });
    }
    if (u.pathname === '/api/program') {
      const cur = currentProgram();
      return json(res,200,{ ok:true, ...(await generateProgram(cur)) });
    }
    if (u.pathname === '/api/songs') return json(res,200,{ok:true,songs:LOUVORES.map(({letra,...s})=>s)});
    if (u.pathname === '/api/jingle') {
      const cur = currentProgram();
      const showName = cur?.nome || 'Louvores que Edificam';
      const host = VOZES[cur?.apresentador || 'luiz'];
      let text = `Você está ouvindo a ${RADIO.nome}. Agora, ${showName}${cur ? `, com ${host.nome}` : ''}. Louvores, Palavra de Deus, oração e uma mensagem de fé para o seu coração.`;
      if (ai) {
        try {
          const r = await ai.models.generateContent({ model: TEXT_MODEL, contents: `Crie uma vinheta ORIGINAL de rádio cristã, curta, entre 25 e 45 palavras, para a ${RADIO.nome}. Programa: ${showName}. Apresentador: ${host.nome}. Tom: ${host.style}. Deve mencionar o nome da rádio e do programa. Não diga que é IA.` });
          if (r.text?.trim()) text = r.text.trim();
        } catch (e) { console.error('jingle generation fallback:', e.message); }
      }
      return json(res,200,{ok:true,program:showName,text});
    }
    if (u.pathname === '/api/tts') {
      const text = u.searchParams.get('text') || ''; const voice = u.searchParams.get('voice') || 'luiz';
      if (!text || text.length > 12000) return json(res,400,{ok:false,error:'Texto ausente ou grande demais'});
      const file = await tts(text, voice); return serveFile(res,file,'audio/wav');
    }
    if (u.pathname.startsWith('/api/music/')) {
      const id = decodeURIComponent(u.pathname.split('/').pop());
      const file = await music(id); return serveFile(res,file,'audio/mpeg');
    }
    const rel = u.pathname === '/' ? '/index.html' : u.pathname;
    const safe = path.normalize(rel).replace(/^\.\.(\/|\\|$)/,'');
    const file = path.join(__dirname,'public',safe);
    const ext=path.extname(file); const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'}[ext]||'application/octet-stream';
    return serveFile(res,file,mime);
  } catch(e){ console.error(e); return json(res,500,{ok:false,error:e.message}); }
});
server.listen(PORT,()=>console.log(`${RADIO.nome} em http://localhost:${PORT}`));
