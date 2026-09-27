import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';

const OUTER_PORT = Number(process.env.PORT || 10000);
const INNER_PORT = Number(process.env.INNER_PORT || 3100);
const STREAM_URL = process.env.PUBLIC_STREAM_URL || 'http://sapircast.caster.fm:11743/I3Pqo';

const child = spawn(process.execPath, ['server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(INNER_PORT) }
});

child.on('exit', (code, signal) => {
  console.error(`server.js encerrou (code=${code}, signal=${signal})`);
  process.exit(code ?? 1);
});

function proxyToApp(req, res) {
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
    if (!res.headersSent) res.writeHead(502, {'content-type':'text/plain; charset=utf-8'});
    res.end(`Erro interno: ${err.message}`);
  });
  req.pipe(p);
}

function proxyRadio(req, res) {
  let src;
  try { src = new URL(STREAM_URL); }
  catch {
    res.writeHead(500, {'content-type':'text/plain; charset=utf-8'});
    return res.end('PUBLIC_STREAM_URL inválida');
  }

  const transport = src.protocol === 'https:' ? https : http;
  const up = transport.get({
    hostname: src.hostname,
    port: src.port || (src.protocol === 'https:' ? 443 : 80),
    path: `${src.pathname}${src.search}`,
    headers: {
      'User-Agent': 'WebRadioVemComigoDeus/1.0',
      'Icy-MetaData': '0'
    }
  }, stream => {
    if ((stream.statusCode || 500) >= 400) {
      res.writeHead(stream.statusCode || 502, {'content-type':'text/plain; charset=utf-8'});
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

  req.on('close', () => {
    try { up.destroy(); } catch {}
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/radio-stream') return proxyRadio(req, res);
  return proxyToApp(req, res);
});

server.listen(OUTER_PORT, () => {
  console.log(`Gateway da Web Rádio em http://localhost:${OUTER_PORT}`);
  console.log(`Aplicação interna em http://127.0.0.1:${INNER_PORT}`);
});