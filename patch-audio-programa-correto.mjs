import fs from 'node:fs';

const sf='server.js';
let s=fs.readFileSync(sf,'utf8');

// Corrige URLs dos blocos para serem únicas por programa e por dia.
// Antes todos usavam /api/program/block?name=..., então o navegador podia
// reaproveitar o WAV em cache de outro programa.
const oldBlocks = `      return json(res,200,{ok:true,showName:x.showName,host:x.host,blocks:{
        opening:'/api/program/block?name=opening',
        word:'/api/program/block?name=word',
        faith:'/api/program/block?name=faith'
      }});`;

const newBlocks = `      const base='/api/program/block?pid='+encodeURIComponent(x.id)+'&date='+encodeURIComponent(x.date)+'&name=';
      return json(res,200,{ok:true,showName:x.showName,host:x.host,programId:x.id,blocks:{
        opening:base+'opening',
        word:base+'word',
        faith:base+'faith'
      }});`;

if(s.includes(oldBlocks)) s=s.replace(oldBlocks,newBlocks);

// Faz o endpoint respeitar o pid da URL em vez de depender só do programa atual/manual.
const oldEndpoint = `    if (u.pathname === '/api/program/block') {
      const cur=forcedProgram() || currentProgram();
      if(!cur){res.writeHead(404);return res.end('Nenhum programa no ar');}
      const name=String(u.searchParams.get('name')||'');
      const x=ensureRadioSpeechBlocks(cur);
      const f=x.files[name];
      if(!f){res.writeHead(404);return res.end('Bloco não encontrado');}
      return serveFile(res,f,'audio/wav');
    }`;

const newEndpoint = `    if (u.pathname === '/api/program/block') {
      const pid=String(u.searchParams.get('pid')||'').trim();
      const cur=(pid ? PROGRAMAS.find(p=>programId(p)===pid) : null) || forcedProgram() || currentProgram();
      if(!cur){res.writeHead(404);return res.end('Nenhum programa no ar');}
      const name=String(u.searchParams.get('name')||'');
      const x=ensureRadioSpeechBlocks(cur);
      const f=x.files[name];
      if(!f){res.writeHead(404);return res.end('Bloco não encontrado');}
      res.writeHead(200, {
        'content-type':'audio/wav',
        'cache-control':'no-store, no-cache, must-revalidate',
        'pragma':'no-cache',
        'expires':'0'
      });
      return fs.createReadStream(f).pipe(res);
    }`;

if(s.includes(oldEndpoint)) s=s.replace(oldEndpoint,newEndpoint);

fs.writeFileSync(sf,s);
console.log('Áudio repetido corrigido: cada programa agora usa blocos próprios sem cache cruzado.');

// Também evita reaproveitar a lista de blocos quando muda o programa no player.
const af='public/app.js';
let a=fs.readFileSync(af,'utf8');

if(!a.includes("programIdFromBlocks")){
  a=a.replace(
`    const d=await getJSON('/api/program/blocks');
    radioProgramState.blocks=d.blocks||null;`,
`    const d=await getJSON('/api/program/blocks');
    radioProgramState.blocks=d.blocks||null;
    radioProgramState.programIdFromBlocks=d.programId||'';`
  );
}

fs.writeFileSync(af,a);
console.log('Player atualizado para blocos exclusivos por programa.');
