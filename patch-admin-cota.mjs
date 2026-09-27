import fs from 'node:fs';

const file = 'public/admin.js';
let s = fs.readFileSync(file, 'utf8');

const oldLine =
"const rows=(data.results||[]).map(x=>`${x.nome}: ${x.status==='cached'?'já estava pronto':'gerado agora'}`).join('\\n');";

const newLine =
"const rows=(data.results||[]).map(x=>x.status==='cached'?`${x.nome}: já estava pronto`:x.status==='generated'?`${x.nome}: gerado agora`:`${x.nome}: ERRO — ${x.error||'não foi possível gerar'}`).join('\\n');";

if (s.includes(newLine)) {
  console.log('Painel de cota já corrigido.');
} else if (s.includes(oldLine)) {
  s = s.replace(oldLine, newLine);
  fs.writeFileSync(file, s);
  console.log('Painel ajustado para mostrar erros por programa.');
} else {
  console.log('Trecho do painel já mudou; seguindo sem alterar.');
}
