import fs from 'node:fs';

// ===== server.js =====
{
  const file='server.js';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('async function backupSignalLibraryToGithub(')){
    const anchor="function writeSignalLibrary(items){ fs.writeFileSync(SIGNAL_LIBRARY, JSON.stringify(items,null,2)); }";
    if(!s.includes(anchor)) throw new Error('writeSignalLibrary não encontrado');
    s=s.replace(anchor, anchor + String.raw`

async function backupSignalLibraryToGithub(items){
  if(typeof githubPut!=='function' || !CACHE_GITHUB_ENABLED) return;
  const safe=items.map(({path,...x})=>x);
  await githubPut('signal/library.json',Buffer.from(JSON.stringify(safe,null,2)));
  for(const item of items){
    if(item.path && fs.existsSync(item.path)){
      await githubPut('signal/uploads/'+item.id,fs.readFileSync(item.path));
    }
  }
}

async function restoreSignalLibraryFromGithub(){
  if(typeof githubGetFile!=='function' || !CACHE_GITHUB_ENABLED) return;
  try{
    const raw=await githubGetFile('signal/library.json');
    if(!raw) return;
    const saved=JSON.parse(raw.toString('utf8'));
    const items=[];
    for(const item of saved){
      const data=await githubGetFile('signal/uploads/'+item.id);
      if(!data) continue;
      const dest=path.join(SIGNAL_UPLOAD_DIR,item.id);
      fs.writeFileSync(dest,data);
      items.push({...item,path:dest});
    }
    writeSignalLibrary(items);
    console.log('Louvores restaurados do GitHub:',items.length);
  }catch(e){ console.error('Restore louvores:',e.message); }
}
`);
  }

  const oldFinish="bb.on('finish',async()=>{try{await Promise.all(pending);const items=[...previous,...added];writeSignalLibrary(items);resolve({added,items});}catch(e){reject(e)}});";
  const newFinish="bb.on('finish',async()=>{try{await Promise.all(pending);const items=[...previous,...added];writeSignalLibrary(items);await backupSignalLibraryToGithub(items);resolve({added,items});}catch(e){reject(e)}});";
  if(s.includes(oldFinish)) s=s.replace(oldFinish,newFinish);

  if(s.includes("await restoreGithubCache();") && !s.includes("await restoreSignalLibraryFromGithub();")){
    s=s.replace("await restoreGithubCache();","await restoreGithubCache();\nawait restoreSignalLibraryFromGithub();");
  }

  const oldSec="const sec=Math.max(30,Math.min(wavDurationSeconds(item.audio)||1800,7200));";
  const newSec="const a=mins(p.inicio),b=mins(p.fim); const sec=((b>a?b-a:(1440-a+b))*60);";
  if(s.includes(oldSec)) s=s.replace(oldSec,newSec);

  fs.writeFileSync(file,s);
  console.log('Programa completo teste: servidor pronto.');
}

// ===== public/app.js =====
{
  const file='public/app.js';
  let s=fs.readFileSync(file,'utf8');

  if(!s.includes('let programNarrationPlayed')){
    s=s.replace("let started = false;","let started = false;\nlet programNarrationPlayed = {};");
  }

  const old = `async function getProgramAudio() {
  if (!currentStatus || !currentStatus.current) return null;
  try {
    const p = await getJSON('/api/program');
    if (p.preparedAudio) {
      return { title: p.showName || currentStatus.current.nome || 'Programa', url: p.preparedAudio };
    }
  } catch {}
  return null;
}`;

  const neu = `async function getProgramAudio() {
  if (!currentStatus || !currentStatus.current) return null;
  const key=(currentStatus.forcedOnAir?.id || currentStatus.current.id || currentStatus.current.nome || 'programa');
  if(programNarrationPlayed[key]) return null;
  try {
    const p = await getJSON('/api/program');
    if (p.preparedAudio) {
      programNarrationPlayed[key]=true;
      return { title: (p.showName || currentStatus.current.nome || 'Programa')+' • Palavra e oração', url: p.preparedAudio };
    }
  } catch {}
  return null;
}`;
  if(s.includes(old)) s=s.replace(old,neu);

  fs.writeFileSync(file,s);
  console.log('Programa completo teste: player pronto.');
}
