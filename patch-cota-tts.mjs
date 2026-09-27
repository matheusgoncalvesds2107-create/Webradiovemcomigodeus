import fs from 'node:fs';

function replaceRequired(text, oldText, newText, label) {
  if (text.includes(newText)) return text;
  if (!text.includes(oldText)) throw new Error(`Não encontrei o trecho esperado em ${label}.`);
  return text.replace(oldText, newText);
}

const file = 'server.js';
let s = fs.readFileSync(file, 'utf8');

// 1) TTS só conta a cota local depois que o WAV foi realmente salvo.
s = replaceRequired(
  s,
`  if (!ai) throw new Error('GEMINI_API_KEY não configurada');
  if (countQuota) reserve('tts', MAX_TTS_DAY);
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ role:'user', parts:[{ text, speech_metadata:{ style:v.style } }] }],
    config: { responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ voice:v.voice } } }
  });
  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error('TTS não retornou áudio');
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  return out;`,
`  if (!ai) throw new Error('GEMINI_API_KEY não configurada');
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ role:'user', parts:[{ text, speech_metadata:{ style:v.style } }] }],
    config: { responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ voice:v.voice } } }
  });
  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error('TTS não retornou áudio');
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  if (countQuota) reserve('tts', MAX_TTS_DAY);
  return out;`,
  'tts()'
);

// 2) Antes de preparar o dia, corrige o contador TTS para a quantidade real de programas prontos.
s = replaceRequired(
  s,
`async function prepareDay(){
  const date=nowParts().date;
  const manifest=readManifest(date);
  const results=[];`,
`function reconcileTtsQuotaWithManifest(date=nowParts().date){
  const manifest=readManifest(date);
  const ready=Object.values(manifest.programs||{}).filter(x=>x?.audio && fs.existsSync(x.audio)).length;
  const b=readBudget(date);
  if ((b.tts||0) !== ready) {
    b.tts=ready;
    writeBudget(b);
  }
  return ready;
}

async function prepareDay(){
  const date=nowParts().date;
  reconcileTtsQuotaWithManifest(date);
  const manifest=readManifest(date);
  const results=[];`,
  'prepareDay()'
);

// 3) Se um programa falhar, registra o erro e para sem perder os que já estavam prontos.
s = replaceRequired(
  s,
`    const pdata=await generateProgram(p,true);
    const audio=await tts(spokenScript(pdata), pdata.hostKey, {countQuota:true});
    manifest.programs[id]={ nome:p.nome, host:pdata.host.nome, voiceKey:pdata.hostKey, audio, createdAt:new Date().toISOString() };
    writeManifest(manifest);
    results.push({id,nome:p.nome,status:'generated'});`,
`    try {
      const pdata=await generateProgram(p,true);
      const audio=await tts(spokenScript(pdata), pdata.hostKey, {countQuota:true});
      manifest.programs[id]={ nome:p.nome, host:pdata.host.nome, voiceKey:pdata.hostKey, audio, createdAt:new Date().toISOString() };
      writeManifest(manifest);
      results.push({id,nome:p.nome,status:'generated'});
    } catch (e) {
      results.push({id,nome:p.nome,status:'error',error:e.message});
      break;
    }`,
  'prepareDay loop'
);

// 4) Retorno do painel inclui a cota já reconciliada.
s = s.replace(
  `  return {date,results,quota:quotaSummary()};`,
  `  reconcileTtsQuotaWithManifest(date);
  return {date,results,quota:quotaSummary()};`
);

fs.writeFileSync(file, s);
console.log('Correção de cota TTS aplicada.');
