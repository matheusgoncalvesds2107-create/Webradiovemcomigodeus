import http from 'node:http';import https from 'node:https';import {spawn} from 'node:child_process';
const OUTER_PORT=Number(process.env.PORT||10000),INNER_PORT=3100,STREAM_URL=process.env.PUBLIC_STREAM_URL||'http://sapircast.caster.fm:11743/I3Pqo';
spawn(process.execPath,['server.js'],{stdio:'inherit',env:{...process.env,PORT:String(INNER_PORT)}});
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,`http://${req.headers.host}`);
 if(u.pathname==='/radio-stream'){
  const src=new URL(STREAM_URL),t=src.protocol==='https:'?https:http;
  const up=t.get({hostname:src.hostname,port:src.port||80,path:src.pathname+src.search,headers:{'User-Agent':'WebRadioVemComigoDeus/1.0','Icy-MetaData':'0'}},r=>{
   if((r.statusCode||500)>=400){res.writeHead(r.statusCode||502);r.resume();return res.end('Stream indisponível');}
   res.writeHead(200,{'content-type':r.headers['content-type']||'audio/mpeg','cache-control':'no-store','access-control-allow-origin':'*'});r.pipe(res);
  });up.on('error',e=>{if(!res.headersSent)res.writeHead(502);res.end('Erro no sinal')});req.on('close',()=>up.destroy());return;
 }
 const p=http.request({hostname:'127.0.0.1',port:INNER_PORT,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode||502,r.headers);r.pipe(res)});req.pipe(p);
});server.listen(OUTER_PORT);