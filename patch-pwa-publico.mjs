import fs from 'node:fs';
import path from 'node:path';

const pub='public';
fs.mkdirSync(path.join(pub,'icons'),{recursive:true});

const manifest={
  name:'Web Rádio Vem Comigo Deus',
  short_name:'Vem Comigo Deus',
  description:'Web Rádio Vem Comigo Deus — louvores, palavra e mensagens de fé.',
  start_url:'/',
  scope:'/',
  display:'standalone',
  orientation:'portrait',
  background_color:'#0f2f24',
  theme_color:'#0f2f24',
  icons:[
    {src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},
    {src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}
  ]
};
fs.writeFileSync(path.join(pub,'manifest.webmanifest'),JSON.stringify(manifest,null,2));

const sw=`const CACHE='vem-comigo-deus-pwa-v1';
const SHELL=['/','/style.css','/app.js','/pwa.js','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploaded-radio/') || url.pathname==='/radio-stream' || url.pathname==='/admin.html' || url.pathname.startsWith('/admin')) return;
  event.respondWith(
    fetch(req).then(res=>{
      const copy=res.clone();
      if(res.ok) caches.open(CACHE).then(c=>c.put(req,copy));
      return res;
    }).catch(()=>caches.match(req).then(r=>r||caches.match('/')))
  );
});
`;
fs.writeFileSync(path.join(pub,'service-worker.js'),sw);

const pwa=`let deferredInstallPrompt=null;
const installBtn=document.getElementById('installPwa');
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  if(installBtn) installBtn.hidden=false;
});
if(installBtn) installBtn.addEventListener('click',async()=>{
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  try{ await deferredInstallPrompt.userChoice; }catch{}
  deferredInstallPrompt=null;
  installBtn.hidden=true;
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  if(installBtn) installBtn.hidden=true;
});
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
}
`;
fs.writeFileSync(path.join(pub,'pwa.js'),pwa);

fs.writeFileSync(path.join(pub,'icons','icon-192.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAIAAADdvvtQAAAIbElEQVR4nO3cTWwUZRzH8f/u9m1bu1taClgaKaaQNBRKCTWGEBKM4cWgoPHloMQINw4aUaNoiAcOJEaNFz0JF5UENRIPhQQVhYMvIUGoSoHwIgXahNKWbrddutvd9TB1HWe725n5zzzzPDu/z4ls92U6++3/mVl2NxDtaCUAu4JebwCoDQEBCwICFgQELAgIWBAQsCAgYEFAwIKAgAUBAQsCAhYEBCwICFgQELAgIGBBQMCCgIAFAQELAgIWBAQsCAhYEBCwICBgQUDAgoCABQEBCwICFgTkmNN7l3q9CR4o83oDSoE/09FgAnHp6/FhSZhA9vkwl3yYQDYVqsdvVWECWVYkka59l0RuiQwQkAXFp4sP6yEEZB4Gz4wQ0OwweIpAQMUgnVkhoIKwZpmBgGaAwWMeAjLC4LEEAf0H6diAgIiwZjEgIAweFl8HhMHD59+AMHgc4ceAkI6D/BUQ1izH+SggDB43+CIgDB73lH5AGDyuKuWAkI4ApRkQ1ixhSjAgDB6RSiogDB7xSiQgpOOVUggIa5aH1A4Ig8dzCgeEwSMDJQNCOvJQ8rPxhSpBPeIFoh2tnjyw376EQABP/n5EB4RuBBBZktAlDPWIIXI/iwsI9YgkbG8LWsLyf591B4cEPK6vnNrRYLhEwFomIiBDPUjHVYaM3G7I9SUM9Qhm2MNur2XuBoR6PCGyIXEH0ahHJGF7W8lXokEeLgakn5wYP+Lp97l7qxgmELAgIGBBQMCCgIAFAQELAgIWBAQsCAhYEBCwICBgQUDAouTnwgq5fGB/oR+17twjckv8Q/mAikRT6GqIyUEKB2QynUI3REaOUDIg2+nk3wkyYlIvIHsHOoVudfnAfjTEoVJAhSIwU0DuOvl3glHEocxp/Iz1tO7cY/WJL3QTR5ZFH1JjAuU/u8yBod3ccLdSLWeGbZNnwwwUmECO11PkfjCHrJI9oPw/RGf/FvPvEA1ZIntAeu6NcWkXCPlJHZBXwwBDyDx5AxJ8FImFzB55A9ITs8RgIbNB0tN42wMg/ztyyO7nYqU6q5eWAhPI5LN4akfDjPUU/5G9x4IcGQOyMX7M9GGyIeaW+I2MAemZGQnmyzBzTQwhS2QPaFZW54qNOQRFqB2QvRrQkIOkOwuT4b2nrTv35DbD1XMx88dY0r7dW+EJxBkkGEJOUTggkAECAhYEBCzSHUT7ivlPAUj76hQmELAgIGBROCDOd0/je6udIl1A+sVehnckSnvwIQnpArLE3iDB+HGQ2gGR9RpQj7NkD8jMKma+CTPXxHuALJExIBuHHWbKsDF7cAA0KxkDMjA5EtYdHCqUSJEf2XssyJH0lWj9GyoscfAQB+PHDAUmEIkaDBg/NsgbkOBP+qnyf0+ykXQJ09heyPiPK/5BJdwGM+SdQPnciwmLl22yB5S/kDn7ZOffoSp/+pKQPSBy82ug3PvqKv9QICAq0BAnoxlvjnpsUCMgKvDs2sio0E1Qjz1Sn4UZzPjNmPpLbHxPdPFbwaxUCkhT5NzexqKGepjUC4gKjyIbdwJMSgaksZ0R0nGQwgFpTL4FFtG4RPmA9FCJeMqcxoOcEBCwICBgQUDAgoCABQEBCwICFhcD6tp3KfdvfCehePp9rn8unIUJBCziAsIQEknY3nY3IMPkRENiGPaze+sXCZhAaEgwkfUQUSDa0erqA2hO711quARfs+K4/D9Ot+shYQHRTA2BqwTUQyIPosX8PqARtreFnsajITFE7mdxS5gBVjTHefL36VlAUBrwSjSwICBgQUDAgoCABQEBCwICFgQELAgIWBAQsJTUZ+Nn9cn25q6W6kyWHvvo6lB8Knf5S2vrd62fS0TvfDNw/K8xIlrTWvPUquiyhVV11aHkVHZkPH3tTvLNr/qT6ey7TyzY0hEhoixRKp0dS6T7hlOnLsWPnBkdn8x49at5xV8BHe2JdbVUBwO0cVntod9Gcpdvbo8Q0fhk5uTFeIDo7S3zt3VGJ5KZ947d/vFCvLoiuGR+5dOro6FggNLZ3K1e/LTvyu3Jtqaq3RsaX3m08ZnVdS8funV9KOnBL+Ydfy1hJ3rjiVSGiDYtr81duHRB5eLGCiL6/vzY5FT2+YfnbOuMEtGHxwe7e2ITycyd+NQvV8ZfO9yv3VYvmc6eu5HY9fnNwbGpprryD55rKgsGBP5C3vNXQBPJzE8X4kTUdn9Vy9wK7UJt/BBRd08sGKDta+qJaDSRPtoTM3m345OZb38fJaJFDRXr2+5zfrsl5q+AiKj73yw2tUeIKBigDctqiaj/bupsX2JRQ0V9TYiI/r6TTOlWq1n1Dkxq/+h8IOzwFsvNdwGdvjZxOzZFRJuX1xLRqkXV8yJlRHS0J5YlioRD2tVGJtKW7jZ3+BypCjm5udLzXUCZLB37M0ZETXXlK5rDm9qnD4aO/hEjolhiups51dY6qKmc3pOxe9bKU53vAiLdKra1M/JIWy0R9dxM3BhOEdH1oeTweJqIWuZWlIcsHA63NVVq/zjbl3B4c+Xmx4CuDSZ7B+4R0eMro7VVQSLqPjedVCZLn/08TETRcEh/plZcTWVw68ooEfUNJU/0xl3ZaFn5MSAi0s6wtAmTTGe/Oz+W+9EXv45op1Svb5y3eXkkXB6srwk9tLj6/WebwuXG3VUeCqxoDn/8QnNjbdmtkdTuw/1TGQuH3iXAp++JrqsOHXv1Qe01mx96x976esBwhbVLap5cFW1fGI6Gg6k03Z1IXx2cfOPL/70STUSpdDaWSPcNp05ejB85MzqR9N0r0T4NCJzi0yUMnIKAgAUBAQsCAhYEBCwICFgQELAgIGBBQMCCgIAFAQELAgIWBAQsCAhYEBCwICBgQUDAgoCABQEBCwICln8AyVbn6BKztvkAAAAASUVORK5CYII=','base64'));
fs.writeFileSync(path.join(pub,'icons','icon-512.png'),Buffer.from('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','base64'));

const indexFile=path.join(pub,'index.html');
let html=fs.readFileSync(indexFile,'utf8');

// Remove completamente o acesso visual ao Painel 3.0 do site público.
html=html.replace(/\s*<a class="admin-link"[^>]*>[^<]*<\/a>\s*/g,'\n');

// Cabeçalho PWA.
if(!html.includes('rel="manifest"')){
  html=html.replace('</title>',`</title>
  <meta name="theme-color" content="#0f2f24">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Vem Comigo Deus">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" sizes="192x192" href="/icons/icon-192.png">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">`);
}

// Botão só aparece quando o navegador disser que o PWA pode ser instalado.
if(!html.includes('id="installPwa"')){
  html=html.replace('<span class="live">● AO VIVO 24H</span>',
    '<span class="live">● AO VIVO 24H</span>\n  <button id="installPwa" class="install-pwa" hidden>📲 Instalar rádio</button>');
}

if(!html.includes('/pwa.js')){
  html=html.replace('</body>','<script src="/pwa.js?v=1"></script>\n</body>');
}

fs.writeFileSync(indexFile,html);
console.log('PWA público aplicado. Painel 3.0 removido da tela pública.');
