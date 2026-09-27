import fs from 'node:fs';

const file='server.js';
let s=fs.readFileSync(file,'utf8');

const oldFn = `async function githubGetFile(remotePath){
  const [owner,repo]=CACHE_GITHUB_REPO.split('/');
  const api='/repos/'+owner+'/'+repo+'/contents/'+remotePath.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(CACHE_GITHUB_BRANCH);
  const data=await ghJson('GET',api);
  if (!data || data.__notFound || !data.content) return null;
  return Buffer.from(String(data.content).replace(/\\n/g,''),'base64');
}`;

const newFn = `async function githubGetFile(remotePath){
  const [owner,repo]=CACHE_GITHUB_REPO.split('/');
  const api='/repos/'+owner+'/'+repo+'/contents/'+remotePath.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(CACHE_GITHUB_BRANCH);
  const data=await ghJson('GET',api);
  if (!data || data.__notFound) return null;

  if (data.content) {
    return Buffer.from(String(data.content).replace(/\\n/g,''),'base64');
  }

  // Arquivos maiores de 1 MB não vêm com "content" na Contents API.
  // Busca o blob pelo SHA para restaurar WAVs grandes do cache.
  if (data.sha) {
    const blob=await ghJson('GET','/repos/'+owner+'/'+repo+'/git/blobs/'+data.sha);
    if (blob?.content) {
      return Buffer.from(String(blob.content).replace(/\\n/g,''),'base64');
    }
  }

  return null;
}`;

if(s.includes(newFn)){
  console.log('Restauração de áudio grande do GitHub já corrigida.');
}else if(s.includes(oldFn)){
  s=s.replace(oldFn,newFn);
  fs.writeFileSync(file,s);
  console.log('Restauração de WAV grande do GitHub corrigida.');
}else{
  throw new Error('Não encontrei githubGetFile no server.js.');
}
