import fs from 'node:fs';

function replaceRequired(text, oldText, newText, label) {
  if (text.includes(newText)) return text; // já aplicado
  if (!text.includes(oldText)) {
    throw new Error(`Não encontrei o trecho esperado em ${label}.`);
  }
  return text.replace(oldText, newText);
}

function patchServer() {
  const file = 'server.js';
  let s = fs.readFileSync(file, 'utf8');

  s = replaceRequired(
    s,
`  { id: 'encontro-com-deus', nome: 'Encontro com Deus', inicio: '12:30', fim: '13:00', apresentador: 'ingrid' },
  { id: 'tarde-da-bencao', nome: 'Tarde da Benção', inicio: '18:00', fim: '19:00', apresentador: 'bernardo' },
  { id: 'culto-no-seu-lar', nome: 'Culto No Seu Lar', inicio: '19:00', fim: '21:00', apresentador: 'heitor' }`,
`  { id: 'encontro-com-deus', nome: 'Encontro com Deus', inicio: '12:30', fim: '13:00', apresentador: 'ingrid' },
  { id: 'deus-esta-aqui', nome: 'Deus Está Aqui', inicio: '15:00', fim: '17:00', apresentador: 'fernando' },
  { id: 'tarde-da-bencao', nome: 'Tarde da Benção', inicio: '18:00', fim: '19:00', apresentador: 'bernardo' },
  { id: 'culto-no-seu-lar', nome: 'Culto No Seu Lar', inicio: '19:00', fim: '21:00', apresentador: 'heitor' },
  { id: 'noite-com-jovens', nome: 'Noite com Jovens', inicio: '22:00', fim: '00:00', apresentador: 'manuela' }`,
    'server.js / grade'
  );

  s = s.replace(
    `// O painel usa no máximo 4 TTS/dia (1 por programa) e deixa margem de segurança.`,
    `// O painel usa no máximo 6 TTS/dia (1 por programa) e reutiliza o cache diário.`
  );
  s = s.replace(
    `const MAX_TTS_DAY = Number(process.env.MAX_TTS_DAY || 4);`,
    `const MAX_TTS_DAY = Number(process.env.MAX_TTS_DAY || 6);`
  );
  s = s.replace(
    `const MAX_TEXT_DAY = Number(process.env.MAX_TEXT_DAY || 4);`,
    `const MAX_TEXT_DAY = Number(process.env.MAX_TEXT_DAY || 6);`
  );

  s = replaceRequired(
    s,
    `  const currentIndex = PROGRAMAS.findIndex(p => minute >= mins(p.inicio) && minute < mins(p.fim));`,
    `  const currentIndex = PROGRAMAS.findIndex(p => {
    const start = mins(p.inicio), end = mins(p.fim);
    return end > start ? (minute >= start && minute < end) : (minute >= start || minute < end);
  });`,
    'server.js / horário até 00:00'
  );

  fs.writeFileSync(file, s);
}

function patchAdminJs() {
  const file = 'public/admin.js';
  let s = fs.readFileSync(file, 'utf8');

  s = s.replace(
    'Gerando apenas o necessário: no máximo 4 vozes hoje.',
    'Gerando apenas o necessário: no máximo 6 vozes hoje.'
  );
  s = s.replace(
    'preparados ${s.prepared}/4 programas',
    'preparados ${s.prepared}/6 programas'
  );

  s = replaceRequired(
    s,
`      ['12:30–13:00','Encontro com Deus','Missionária Ingrid Laura','Sulafat'],
      ['18:00–19:00','Tarde da Benção','Pastor Bernardo Henrique','Achird'],
      ['19:00–21:00','Culto No Seu Lar','Pastor Heitor Cruz','Charon']`,
`      ['12:30–13:00','Encontro com Deus','Missionária Ingrid Laura','Sulafat'],
      ['15:00–17:00','Deus Está Aqui','Pastor Fernando Baptista','Fenrir'],
      ['18:00–19:00','Tarde da Benção','Pastor Bernardo Henrique','Achird'],
      ['19:00–21:00','Culto No Seu Lar','Pastor Heitor Cruz','Charon'],
      ['22:00–00:00','Noite com Jovens','Pastora Manuela Rodrigues','Pulcherrima']`,
    'public/admin.js / grade visual'
  );

  fs.writeFileSync(file, s);
}

function patchAdminHtml() {
  const file = 'public/admin.html';
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(
    'O painel prepara no máximo 4 vozes por dia e reutiliza os áudios.',
    'O painel prepara no máximo 6 vozes por dia e reutiliza os áudios.'
  );
  fs.writeFileSync(file, s);
}

function patchIndex() {
  const file = 'public/index.html';
  let s = fs.readFileSync(file, 'utf8');

  s = replaceRequired(
    s,
`      <article><b>12:30</b><h4>Encontro com Deus</h4><p>Missionária Ingrid Laura</p></article>
      <article><b>18:00</b><h4>Tarde da Benção</h4><p>Pastor Bernardo Henrique</p></article>
      <article><b>19:00</b><h4>Culto No Seu Lar</h4><p>Pastor Heitor Cruz • até 21:00</p></article>`,
`      <article><b>12:30</b><h4>Encontro com Deus</h4><p>Missionária Ingrid Laura</p></article>
      <article><b>15:00</b><h4>Deus Está Aqui</h4><p>Pastor Fernando Baptista • até 17:00</p></article>
      <article><b>18:00</b><h4>Tarde da Benção</h4><p>Pastor Bernardo Henrique</p></article>
      <article><b>19:00</b><h4>Culto No Seu Lar</h4><p>Pastor Heitor Cruz • até 21:00</p></article>
      <article><b>22:00</b><h4>Noite com Jovens</h4><p>Pastora Manuela Rodrigues • até 00:00</p></article>`,
    'public/index.html / programação'
  );

  fs.writeFileSync(file, s);
}

patchServer();
patchAdminJs();
patchAdminHtml();
patchIndex();

console.log('Grade atualizada para 6 programas.');
