import fs from 'node:fs';

const file='server.js';
let s=fs.readFileSync(file,'utf8');

function addOnce(anchor, addition, label){
  if (s.includes(addition.trim().slice(0,80))) return;
  if (!s.includes(anchor)) throw new Error(`Não encontrei ${label}.`);
  s=s.replace(anchor, anchor+addition);
}

function replaceOnce(oldText,newText,label){
  if (s.includes(newText)) return;
  if (!s.includes(oldText)) throw new Error(`Não encontrei ${label}.`);
  s=s.replace(oldText,newText);
}

// Configuração de backup gratuito no GitHub em branch separada.
addOnce(
`const ALLOW_ADHOC_TTS = process.env.ALLOW_ADHOC_TTS === 'true';`,
`

const CACHE_GITHUB_TOKEN = process.env.CACHE_GITHUB_TOKEN || '';
const CACHE_GITHUB_REPO = process.env.CACHE_GITHUB_REPO || 'matheusgoncalvesds2107-create/Webradiovemcomigodeus';
const CACHE_GITHUB_BRANCH = process.env.CACHE_GITHUB_BRANCH || 'radio-cache';
const CACHE_GITHUB_ENABLED = Boolean(CACHE_GITHUB_TOKEN && CACHE_GITHUB_REPO);
let githubBackupChain = Promise.resolve();

async function ghJson(method, apiPath, body=null) {
  if (!CACHE_GITHUB_ENABLED) return null;
  const r = await fetch(\`https://api.github.com\${apiPath}\`, {
    method,
    headers: {
      'accept':'application/vnd.github+json',
      'authorization':\`Bearer \${CACHE_GITHUB_TOKEN}\`,
      'x-github-api-version':'2022-11-28',
      'user-agent':'WebRadioVemComigoDeus'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (r.status === 404) return {__notFound:true};
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(\`GitHub cache HTTP \${r.status}: \${data.message||'erro'}\`);
  return data;
}

async function ensureGithubCacheBranch(){
  if (!CACHE_GITHUB_ENABLED) return false;
  const [owner,repo]=CACHE_GITHUB_REPO.split('/');
  const ref=await ghJson('GET',\`/repos/\${owner}/\${repo}/git/ref/heads/\${encodeURIComponent(CACHE_GITHUB_BRANCH)}\`);
  if (!ref?.__notFound) return true;
  const meta=await ghJson('GET',\`/repos/\${owner}/\${repo}\`);
  const base=meta.default_branch||'main';
  const baseRef=await ghJson('GET',\`/repos/\${owner}/\${repo}/git/ref/heads/\${encodeURIComponent(base)}\`);
  await ghJson('POST',\`/repos/\${owner}/\${repo}/git/refs\`,{
    ref:\`refs/heads/\${CACHE_GITHUB_BRANCH}\`,
    sha:baseRef.object.sha
  });
  return true;
}

async function githubPut(remotePath, buffer){
  if (!CACHE_GITHUB_ENABLED) return;
  await ensureGithubCacheBranch();
  const [owner,repo]=CACHE_GITHUB_REPO.split('/');
  const api=\`/repos/\${owner}/\${repo}/contents/\${remotePath.split('/').map(encodeURIComponent).join('/')}\`;
  const existing=await ghJson('GET',\`\${api}?ref=\${encodeURIComponent(CACHE_GITHUB_BRANCH)}\`);
  const body={
    message:\`cache rádio: \${remotePath}\`,
    content:buffer.toString('base64'),
    branch:CACHE_GITHUB_BRANCH
  };
  if (existing && !existing.__notFound && existing.sha) body.sha=existing.sha;
  await ghJson('PUT',api,body);
}

function queueGithubBackup(localPath, remotePath){
  if (!CACHE_GITHUB_ENABLED || !fs.existsSync(localPath)) return;
  githubBackupChain=githubBackupChain
    .then(()=>githubPut(remotePath,fs.readFileSync(localPath)))
    .catch(e=>console.error('GitHub cache backup:',e.message));
}

async function githubList(remoteDir){
  if (!CACHE_GITHUB_ENABLED) return [];
  await ensureGithubCacheBranch();
  const [owner,repo]=CACHE_GITHUB_REPO.split('/');
  const api=\`/repos/\${owner}/\${repo}/contents/\${remoteDir.split('/').map(encodeURIComponent).join('/')}?ref=\${encodeURIComponent(CACHE_GITHUB_BRANCH)}\`;
  const data=await ghJson('GET',api);
  if (!data || data.__notFound || !Array.isArray(data)) return [];
  return data;
}

async function githubGetFile(remotePath){
  const [owner,repo]=CACHE_GITHUB_REPO.split('/');
  const api=\`/repos/\${owner}/\${repo}/contents/\${remotePath.split('/').map(encodeURIComponent).join('/')}?ref=\${encodeURIComponent(CACHE_GITHUB_BRANCH)}\`;
  const data=await ghJson('GET',api);
  if (!data || data.__notFound || !data.content) return null;
  return Buffer.from(String(data.content).replace(/\\n/g,''),'base64');
}

async function restoreGithubCache(){
  if (!CACHE_GITHUB_ENABLED) {
    console.log('Cache GitHub: desativado (CACHE_GITHUB_TOKEN ausente).');
    return;
  }
  try {
    const date=nowParts().date;
    const groups=[
      ['content',CONTENT_CACHE_DIR],
      ['tts',TTS_CACHE_DIR],
      ['state',STATE_DIR]
    ];
    for (const [kind,dir] of groups){
      const remoteDir=\`runtime-cache/\${date}/\${kind}\`;
      const items=await githubList(remoteDir);
      for (const item of items){
        if (item.type!=='file') continue;
        const data=await githubGetFile(\`\${remoteDir}/\${item.name}\`);
        if (data) fs.writeFileSync(path.join(dir,item.name),data);
      }
    }

    // Ajusta caminhos absolutos do manifesto restaurado para a pasta local atual.
    const mp=manifestPath(date);
    if (fs.existsSync(mp)){
      const m=JSON.parse(fs.readFileSync(mp,'utf8'));
      for (const item of Object.values(m.programs||{})){
        if (item?.audio) item.audio=path.join(TTS_CACHE_DIR,path.basename(item.audio));
      }
      fs.writeFileSync(mp,JSON.stringify(m,null,2));
    }
    console.log('Cache GitHub restaurado para',date);
  } catch(e){
    console.error('Cache GitHub restore:',e.message);
  }
}
`,
'config cache GitHub'
);

// Persistir quota/state.
replaceOnce(
`function writeBudget(b){ fs.writeFileSync(budgetPath(b.date), JSON.stringify(b,null,2)); }`,
`function writeBudget(b){
  const p=budgetPath(b.date);
  fs.writeFileSync(p, JSON.stringify(b,null,2));
  queueGithubBackup(p,\`runtime-cache/\${b.date}/state/\${path.basename(p)}\`);
}`,
'writeBudget'
);

// Persistir JSON individual de cada programa.
replaceOnce(
`function saveProgramCache(date,p,data){ fs.writeFileSync(programCachePath(date,p), JSON.stringify(data,null,2)); }`,
`function saveProgramCache(date,p,data){
  const f=programCachePath(date,p);
  fs.writeFileSync(f, JSON.stringify(data,null,2));
  queueGithubBackup(f,\`runtime-cache/\${date}/content/\${path.basename(f)}\`);
}`,
'saveProgramCache'
);

// Persistir manifesto diário.
replaceOnce(
`function writeManifest(m){ fs.writeFileSync(manifestPath(m.date), JSON.stringify(m,null,2)); }`,
`function writeManifest(m){
  const f=manifestPath(m.date);
  fs.writeFileSync(f, JSON.stringify(m,null,2));
  queueGithubBackup(f,\`runtime-cache/\${m.date}/content/\${path.basename(f)}\`);
}`,
'writeManifest'
);

// Persistir WAV depois de salvo.
replaceOnce(
`  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  if (countQuota) reserve('tts', MAX_TTS_DAY);
  return out;`,
`  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  queueGithubBackup(out,\`runtime-cache/\${nowParts().date}/tts/\${path.basename(out)}\`);
  if (countQuota) reserve('tts', MAX_TTS_DAY);
  return out;`,
'tts backup'
);

// Restaurar antes de começar a atender requisições.
replaceOnce(
`server.listen(PORT,()=>console.log(\`${RADIO.nome} em http://localhost:${PORT}\`));`,
`await restoreGithubCache();
server.listen(PORT,()=>console.log(\`${RADIO.nome} em http://localhost:${PORT}\`));`,
'server.listen'
);

fs.writeFileSync(file,s);
console.log('Persistência gratuita via GitHub aplicada.');
