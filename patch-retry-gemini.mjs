import fs from 'node:fs';

const file='server.js';
let s=fs.readFileSync(file,'utf8');

function insertAfterHash(addition){
  if (s.includes('async function withGeminiRetry(')) {
    console.log('Retry helper já aplicado.');
    return;
  }
  const marker = "function hash(s){ return crypto.createHash('sha1').update(s).digest('hex'); }";
  if (!s.includes(marker)) throw new Error('Não encontrei function hash no server.js.');
  s = s.replace(marker, marker + addition);
}

function replaceIfFound(oldText,newText,label){
  if (s.includes(newText)) {
    console.log(label + ': já aplicado.');
    return;
  }
  if (!s.includes(oldText)) {
    console.log(label + ': trecho já diferente; seguindo sem quebrar deploy.');
    return;
  }
  s=s.replace(oldText,newText);
}

insertAfterHash(`

function isRetryableGeminiError(e){
  const msg=String(e?.message||e||'');
  return /503|UNAVAILABLE|high demand|temporar|overload|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg);
}

function isGeminiQuotaError(e){
  const msg=String(e?.message||e||'');
  return /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
}

async function withGeminiRetry(fn, label='Gemini'){
  const delays=[0,8000,20000];
  let last;
  for(let i=0;i<delays.length;i++){
    if(delays[i]) await sleep(delays[i]);
    try{
      return await fn();
    }catch(e){
      last=e;
      if(isGeminiQuotaError(e)) throw e;
      if(!isRetryableGeminiError(e) || i===delays.length-1) throw e;
      console.warn(\`${label}: tentativa ${i+1} falhou; tentando novamente em ${Math.round(delays[i+1]/1000)}s.\`);
    }
  }
  throw last;
}
`);

replaceIfFound(
`  reserve('text', MAX_TEXT_DAY, date);
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
  return base;`,
`  try {
    const r = await withGeminiRetry(
      () => ai.models.generateContent({ model: TEXT_MODEL, contents: prompt, config: { responseMimeType: 'application/json' } }),
      \`Texto ${base.showName}\`
    );
    const parsed = JSON.parse(r.text || '{}');
    const map = { 'Palavra': parsed.palavra, 'Oração': parsed.oracao, 'Mensagem de Fé': parsed.fe };
    base.queue = base.queue.map(q => map[q.label] ? {...q, text: map[q.label]} : q);
    reserve('text', MAX_TEXT_DAY, date);
    saveProgramCache(date,program,base);
    return base;
  } catch (e) {
    if (isRetryableGeminiError(e)) {
      throw new Error(\`Gemini temporariamente indisponível para ${base.showName}: ${e.message}\`);
    }
    console.error('text generation fallback:', e.message);
    saveProgramCache(date,program,base);
    return base;
  }`,
'retry de texto'
);

replaceIfFound(
`  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ role:'user', parts:[{ text, speech_metadata:{ style:v.style } }] }],
    config: { responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ voice:v.voice } } }
  });`,
`  const response = await withGeminiRetry(
    () => ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ role:'user', parts:[{ text, speech_metadata:{ style:v.style } }] }],
      config: { responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ voice:v.voice } } }
    }),
    \`TTS ${v.nome}\`
  );`,
'retry de TTS'
);

s=s.replace(
`      results.push({id,nome:p.nome,status:'error',error:e.message});
      break;`,
`      results.push({id,nome:p.nome,status:'error',error:e.message});
      continue;`
);

fs.writeFileSync(file,s);
console.log('Retry automático do Gemini aplicado sem quebrar o deploy.');
