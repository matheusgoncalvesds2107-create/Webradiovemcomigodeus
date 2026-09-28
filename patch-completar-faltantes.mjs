import fs from 'node:fs';

const file='server.js';
let s=fs.readFileSync(file,'utf8');

// 1) Preparar só os que faltam. Se texto IA falhar, usa fallback e continua.
const start=s.indexOf('async function prepareDay(){');
const end=s.indexOf('\nasync function music(', start);
if(start<0 || end<0) throw new Error('prepareDay não encontrado');

const prepare = String.raw`async function prepareDay(){
  const date=nowParts().date;
  const manifest=readManifest(date);
  const results=[];

  for (const p of PROGRAMAS) {
    const id=programId(p);

    // Não mexe nos programas que já estão prontos.
    if (manifest.programs[id]?.audio && fs.existsSync(manifest.programs[id].audio)) {
      results.push({id,nome:p.nome,status:'cached'});
      continue;
    }

    let pdata;
    try {
      // Tenta conteúdo novo; se a cota externa estiver esgotada, cai no fallback.
      pdata=await generateProgram(p,true);
    } catch (e) {
      console.log('Texto IA indisponível para '+p.nome+'; usando fallback.');
      pdata=buildFallbackProgram(p);
      try { saveProgramCache(date,p,pdata); } catch {}
    }

    try {
      const audio=await tts(spokenScript(pdata), pdata.hostKey, {countQuota:true});
      manifest.programs[id]={
        nome:p.nome,
        host:pdata.host.nome,
        voiceKey:pdata.hostKey,
        audio,
        createdAt:new Date().toISOString()
      };
      writeManifest(manifest);
      results.push({id,nome:p.nome,status:'generated'});
    } catch (e) {
      console.error('TTS '+p.nome+':',e.message);
      results.push({id,nome:p.nome,status:'error',error:e.message});
      continue;
    }
  }

  return {date,results,quota:quotaSummary()};
}
`;

s=s.slice(0,start)+prepare+s.slice(end);

// 2) Desliga geração de música IA. A rádio usa somente os louvores enviados.
const musicStart=s.indexOf('async function music(');
const musicEnd=s.indexOf('\n\nfunction listPreparedAssets()', musicStart);
if(musicStart<0 || musicEnd<0) throw new Error('music não encontrado');

const musicFn = String.raw`async function music(songId, allowGenerate=false) {
  const song = LOUVORES.find(s => s.id === songId);
  if (!song) throw new Error('Louvor não encontrado');

  const key = hash(`${MUSIC_MODEL}|${song.direcao}|${song.letra}`);
  const out = path.join(MUSIC_CACHE_DIR, `${key}.mp3`);
  if (fs.existsSync(out)) return out;

  if (allowGenerate) {
    throw new Error('Música por IA desativada. A rádio usa os louvores enviados para a biblioteca.');
  }

  throw new Error('Use os louvores enviados para a biblioteca da rádio.');
}
`;

s=s.slice(0,musicStart)+musicFn+s.slice(musicEnd);

fs.writeFileSync(file,s);
console.log('Completar faltantes aplicado: prontos são preservados, faltantes usam fallback se necessário.');
console.log('Lyria desativado: usando somente louvores enviados.');
