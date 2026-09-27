import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTER_PORT = Number(process.env.PORT || 10000);
const INNER_PORT = Number(process.env.INNER_PORT || 3100);
const STREAM_URL = process.env.PUBLIC_STREAM_URL || 'http://sapircast.caster.fm:11743/I3Pqo';

let appReady = false;
let childExited = false;

const child = spawn(process.execPath, ['server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(INNER_PORT) }
});

child.on('exit', (code, signal) => {
  childExited = true;
  appReady = false;
  console.error(`server.js encerrou (code=${code}, signal=${signal})`);
});

child.on('error', err => {
  childExited = true;
  appReady = false;
  console.error('Falha ao iniciar server.js:', err.message);
});

function checkInnerApp() {
  if (childExited) return;
  const req = http.get({
    hostname: '127.0.0.1',
    port: INNER_PORT,
    path: '/api/status',
    timeout: 1500
  }, res => {
    appReady = true;
    res.resume();
  });
  req.on('error', () => appReady = false);
  req.on('timeout', () => { req.destroy(); appReady = false; });
}
setInterval(checkInnerApp, 1000);
setTimeout(checkInnerApp, 300);

function servePublic(res, filename, type) {
  const file = path.join(__dirname, 'public', filename);
  if (!fs.existsSync(file)) {
    res.writeHead(404, {'content-type':'text/plain; charset=utf-8'});
    return res.end('Not Found');
  }
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-cache, no-store, must-revalidate'
  });
  fs.createReadStream(file).pipe(res);
}

function proxyToApp(req, res) {
  if (!appReady) {
    res.writeHead(503, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '2'
    });
    return res.end('Rádio iniciando. Atualize em alguns segundos.');
  }

  const p = http.request({
    hostname: '127.0.0.1',
    port: INNER_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, up => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });

  p.on('error', err => {
    appReady = false;
    if (!res.headersSent) {
      res.writeHead(503, {'content-type':'text/plain; charset=utf-8','cache-control':'no-store','retry-after':'2'});
    }
    res.end(`Rádio iniciando: ${err.message}`);
  });

  req.on('error', () => {
    try { p.destroy(); } catch {}
  });

  req.pipe(p);
}

function proxyRadio(req, res) {
  let src;
  try {
    src = new URL(STREAM_URL);
  } catch {
    res.writeHead(500, {'content-type':'text/plain; charset=utf-8'});
    return res.end('PUBLIC_STREAM_URL inválida');
  }

  const transport = src.protocol === 'https:' ? https : http;
  const up = transport.get({
    hostname: src.hostname,
    port: src.port || (src.protocol === 'https:' ? 443 : 80),
    path: `${src.pathname}${src.search}`,
    headers: {'User-Agent':'WebRadioVemComigoDeus/1.0','Icy-MetaData':'0','Accept':'*/*'}
  }, stream => {
    if ((stream.statusCode || 500) >= 400) {
      res.writeHead(stream.statusCode || 502, {'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
      stream.resume();
      return res.end(`Stream indisponível (${stream.statusCode})`);
    }

    res.writeHead(200, {
      'content-type': stream.headers['content-type'] || 'audio/mpeg',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'connection': 'keep-alive',
      'access-control-allow-origin': '*'
    });
    stream.pipe(res);
  });

  up.on('error', err => {
    if (!res.headersSent) res.writeHead(502, {'content-type':'text/plain; charset=utf-8'});
    res.end(`Erro no sinal: ${err.message}`);
  });

  res.on('close', () => {
    try { up.destroy(); } catch {}
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Garante que o site principal sempre abra.
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return servePublic(res, 'index.html', 'text/html; charset=utf-8');
  }

  if (url.pathname === '/radio-stream') {
    return proxyRadio(req, res);
  }

  return proxyToApp(req, res);
});

server.listen(OUTER_PORT, '0.0.0.0', () => {
  console.log(`Gateway da Web Rádio ouvindo na porta ${OUTER_PORT}`);
});
