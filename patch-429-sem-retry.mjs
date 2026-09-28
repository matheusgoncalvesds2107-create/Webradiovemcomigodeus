import fs from 'node:fs';

const file='server.js';
let s=fs.readFileSync(file,'utf8');

if(!s.includes('function isGeminiDailyQuotaError(')){
  const anchor="function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }";
  if(!s.includes(anchor)) throw new Error('sleep não encontrado');
  s=s.replace(anchor, anchor + `
function isGeminiDailyQuotaError(err){
  const m=String(err?.message||err||'');
  return m.includes('GenerateRequestsPerDayPerProjectPerModel-FreeTier')
    || (m.includes('429') && m.includes('quotaValue'));
}
`);
}

const oldCatch=`  } catch (e) {
    console.error('text generation fallback:', e.message);
    // Salva o fallback para impedir tentativas repetidas no mesmo dia.
    saveProgramCache(date,program,base);
  }`;

const newCatch=`  } catch (e) {
    console.error('text generation fallback:', e.message);
    if (isGeminiDailyQuotaError(e)) {
      console.log('Cota diária do Gemini esgotada; usando fallback e seguindo.');
    }
    saveProgramCache(date,program,base);
  }`;

if(s.includes(oldCatch)) s=s.replace(oldCatch,newCatch);

// Evita esperar e repetir quando o erro for a cota diária.
s=s.replace(
  "console.log(`Texto ${base.showName}: tentativa 1 falhou; tentando novamente em 8s.`);",
  "if(isGeminiDailyQuotaError(e)) throw e; console.log(`Texto ${base.showName}: tentativa 1 falhou; tentando novamente em 8s.`);"
);

fs.writeFileSync(file,s);
console.log('Correção 429 aplicada: cota diária usa fallback sem insistir.');
