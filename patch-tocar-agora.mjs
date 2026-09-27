import fs from 'node:fs';

const sf='server.js';
let s=fs.readFileSync(sf,'utf8');

if(!s.includes("const FORCED_ONAIR_FILE =")){
  const marker="function writeManifest(m){";
  const i=s.indexOf(marker);
  if(i<0) throw new Error('writeManifest não encontrado');
  const e=s.indexOf("\n}",i);
  const add=String.raw`

const FORCED_ONAIR_FILE = path.join(STATE_DIR, 'forced-onair.json');

function wavDurationSeconds(file){
  try{
    const b=fs.readFileSync(file);
    if(b.length<44 || b.toString('ascii',0,4)!=='RIFF' || b.toString('ascii',8,12)!=='WAVE') return 0;
    let byteRate=0,dataSize=0,p=12;
    while(p+8<=b.length){
      const id=b.toString('ascii',p,p+4), size=b.readUInt32LE(p+4), start=p+8;
      if(id==='fmt ' && size>=12 && start+12<=b.length) byteRate=b.readUInt32LE(start+8);
      if(id==='data'){ dataSize=Math.min(size,b.length-start); break; }
      p=start+size+(size%2);
    }
    return byteRate>0&&dataSize>0?dataSize/byteRate:0;
  }catch{return 0;}
}

function readForcedOnAir(){
  try{
    const x=JSON.parse(fs.readFileSync(FORCED_ONAIR_FILE,'utf8'));
    if(!x?.id||!x?.endsAt) return null;
    if(Date.now()>=Number(x.endsAt)){try{fs.unlinkSync(FORCED_ONAIR_FILE)}catch{};return null;}
    const m=readManifest(x.date||nowParts().date), item=m.programs?.[x.id];
    if(!item?.audio||!fs.existsSync(item.audio)) return null;
    return x;
  }catch{return null;}
}

function forcedProgram(){
  const f=readForcedOnAir();
  return f ? (PROGRAMAS.find(x=>programId(x)===f.id)||null) : null;
}

function startForcedOnAir(id){
  const date=nowParts().date, m=readManifest(date), item=m.programs?.[id];
  if(!item?.audio||!fs.existsSync(item.audio)) throw new Error('Esse programa ainda não está preparado hoje.');
  const p=PROGRAMAS.find(x=>programId(x)===id);
  if(!p) throw new Error('Programa não encontrado.');
  const sec=Math.max(30,Math.min(wavDurationSeconds(item.audio)||1800,7200));
  const x={id,date,nome:item.nome||p.nome,host:item.host||'',startedAt:new Date().toISOString(),endsAt:Date.now()+Math.ceil(sec*1000),durationSeconds:Math.ceil(sec)};
  fs.writeFileSync(FORCED_ONAIR_FILE,JSON.stringify(x,null,2));
  if(typeof queueGithubBackup==='function') queueGithubBackup(FORCED_ONAIR_FILE,'runtime-cache/'+date+'/state/'+path.basename(FORCED_ONAIR_FILE));
  return x;
}
`;
  s=s.slice(0,e+2)+add+s.slice(e+2);
}

if(!s.includes("u.pathname === '/api/onair/start'")){
  const a="    if (u.pathname === '/api/status') {";
  const add=String.raw`    if (u.pathname === '/api/onair/start' && req.method === 'POST') {
      if(!requireAdmin(req,res)) return;
      const raw=await readBody(req); let body={}; try{body=JSON.parse(raw||'{}')}catch{}
      const forced=startForcedOnAir(String(body.id||'').trim());
      return json(res,200,{ok:true,forced});
    }

`;
  s=s.replace(a,add+a);
}

const oldStatus=`        current:state.current,`;
const newStatus=`        current:forcedProgram()||state.current,`;
if(!s.includes(newStatus)) s=s.replace(oldStatus,newStatus);

const oldMode=`        mode:state.mode,`;
const newMode=`        mode:readForcedOnAir()?'manual':state.mode,\n        forcedOnAir:readForcedOnAir(),`;
if(!s.includes("forcedOnAir:readForcedOnAir()")) s=s.replace(oldMode,newMode);

const oldPrepared=`        prepared:Object.keys(manifest.programs||{}).length`;
const newPrepared=`        prepared:Object.keys(manifest.programs||{}).length,\n        preparedIds:Object.keys(manifest.programs||{})`;
if(!s.includes("preparedIds:Object.keys")) s=s.replace(oldPrepared,newPrepared);

const oldProgram=`      const cur = currentProgram();`;
const newProgram=`      const cur = forcedProgram() || currentProgram();`;
if(!s.includes(newProgram)) s=s.replace(oldProgram,newProgram);

fs.writeFileSync(sf,s);
console.log('Servidor: Tocar agora aplicado.');

const af='public/admin.js';
let a=fs.readFileSync(af,'utf8');

if(!a.includes('async function tocarProgramaAgora(')){
  a=a.replace("async function load(){",String.raw`
function adminProgramId(nome){
  return {
    'Bom Dia Deus':'bom-dia-deus',
    'Encontro com Deus':'encontro-com-deus',
    'Deus Está Aqui':'deus-esta-aqui',
    'Tarde da Benção':'tarde-da-bencao',
    'Culto No Seu Lar':'culto-no-seu-lar',
    'Noite com Jovens':'noite-com-jovens'
  }[nome]||'';
}

async function tocarProgramaAgora(id,btn){
  const token=(localStorage.getItem('radioAdminToken')||'').trim();
  if(!token){ alert('Salve primeiro a senha do painel.'); return; }
  setBusy(btn,true,'Colocando no ar...');
  try{
    const r=await fetch('/api/onair/start',{method:'POST',headers:{'content-type':'application/json','x-admin-token':token},body:JSON.stringify({id})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||('HTTP '+r.status));
    alert('No ar agora: '+(d.forced?.nome||id));
    await load();
  }catch(e){ alert(e.message); }
  finally{ setBusy(btn,false); }
}

async function load(){`);
}

const old=`$('#programGrid').innerHTML=schedule.map(x=>\`<article class="program-card"><div class="time">\${x[0]}</div><div><h3>\${x[1]}</h3><p>\${x[2]}</p></div><span class="voice">Voz \${x[3]}</span></article>\`).join('');`;
const neu=`$('#programGrid').innerHTML=schedule.map(x=>{const pid=adminProgramId(x[1]);const ready=(s.preparedIds||[]).includes(pid);return \`<article class="program-card"><div class="time">\${x[0]}</div><div><h3>\${x[1]}</h3><p>\${x[2]}</p></div><span class="voice">Voz \${x[3]}</span><button class="ghost onair-program" data-program-id="\${pid}" \${ready?'':'disabled'}>\${ready?'▶ Tocar agora':'Ainda não preparado'}</button></article>\`}).join('');\n    document.querySelectorAll('.onair-program:not([disabled])').forEach(b=>b.onclick=()=>tocarProgramaAgora(b.dataset.programId,b));`;
if(a.includes(old)) a=a.replace(old,neu);

fs.writeFileSync(af,a);
console.log('Painel: botão Tocar agora aplicado.');
