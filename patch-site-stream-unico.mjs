import fs from 'node:fs';
import path from 'node:path';

const indexPath=path.join('public','index.html');
const appPath=path.join('public','app.js');

let html=fs.readFileSync(indexPath,'utf8');

// Mantém o visual original do site.
if(!html.includes('id="audio"')){
  throw new Error('Player original do site não encontrado.');
}

fs.writeFileSync(indexPath,html);

const app=`const $ = s => document.querySelector(s);
const audio = $('#audio');
const STREAM = "https://sapircast.caster.fm:11743/I3Pqo?token=8d4e69c8f08e4f85e822c0aa569a65d5";

let started = false;
let currentStatus = null;

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Erro');
  return j;
}

function mostrarPrograma(nome, apresentador = '') {
  if ($('#show')) $('#show').textContent = nome;
  if ($('#host')) $('#host').textContent = apresentador ? 'Com ' + apresentador : 'Web Rádio Vem Comigo Deus';
  if ($('#kind')) $('#kind').textContent = 'SINAL ÚNICO • AO VIVO';
  if ($('#nowTitle')) $('#nowTitle').textContent = apresentador ? nome + ' — ' + apresentador : nome;
}

async function refreshStatus() {
  try {
    const s = await getJSON('/api/status');
    currentStatus = s;
    if (s.current) {
      const nome = s.current.nome || 'Web Rádio Vem Comigo Deus';
      const chave = s.current.apresentador;
      const apresentador = s.voices && chave && s.voices[chave] ? s.voices[chave].nome : '';
      mostrarPrograma(nome, apresentador);
    } else {
      mostrarPrograma('Louvores que Edificam');
    }
    if ($('#clock') && s.now) $('#clock').textContent = s.now.full + ' • Horário de Brasília';
  } catch {
    mostrarPrograma('Web Rádio Vem Comigo Deus');
  }
}

async function playStream() {
  if (!audio.src || audio.src !== STREAM) audio.src = STREAM;
  $('#statusText').textContent = 'Conectando...';
  try {
    await audio.play();
    started = true;
    $('#power').textContent = '📻 RÁDIO LIGADA';
    $('#play').textContent = '⏸';
    $('#statusText').textContent = 'AO VIVO';
  } catch {
    $('#statusText').textContent = 'Não foi possível conectar ao sinal.';
  }
}

$('#power').onclick = playStream;

$('#play').onclick = async () => {
  if (!started || !audio.src) return playStream();
  if (audio.paused) {
    try {
      await audio.play();
      $('#play').textContent = '⏸';
      $('#statusText').textContent = 'AO VIVO';
    } catch {
      $('#statusText').textContent = 'Não foi possível conectar ao sinal.';
    }
  } else {
    audio.pause();
    $('#play').textContent = '▶';
    $('#statusText').textContent = 'PAUSADO';
  }
};

if ($('#prev')) $('#prev').onclick = () => {};
if ($('#next')) $('#next').onclick = () => {};

audio.addEventListener('playing', () => {
  $('#play').textContent = '⏸';
  $('#power').textContent = '📻 RÁDIO LIGADA';
  $('#statusText').textContent = 'AO VIVO';
});

audio.addEventListener('pause', () => {
  if (!audio.ended) $('#play').textContent = '▶';
});

audio.addEventListener('error', () => {
  $('#statusText').textContent = 'Sinal indisponível.';
});

refreshStatus();
setInterval(refreshStatus,15000);
`;

fs.writeFileSync(appPath,app);
console.log('Site usando o mesmo stream direto do aplicativo Lite.');
