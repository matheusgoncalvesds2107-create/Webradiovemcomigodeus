const $ = s => document.querySelector(s);
const audio = $('#audio');

let uploadedSongs = [];
let songIndex = 0;
let currentStatus = null;
let started = false;

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Erro');
  return j;
}

function mostrarPrograma(nome, apresentador = '') {
  if ($('#show')) $('#show').textContent = nome;
  if ($('#host')) $('#host').textContent = apresentador ? `Com ${apresentador}` : 'Web Rádio Vem Comigo Deus';
  if ($('#kind')) $('#kind').textContent = nome === 'Louvores que Edificam' ? 'LOUVORES • AO VIVO' : 'PROGRAMA AO VIVO';
  if ($('#nowTitle')) $('#nowTitle').textContent = apresentador ? `${nome} — ${apresentador}` : nome;
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
    if ($('#clock') && s.now) $('#clock').textContent = `${s.now.full} • Horário de Brasília`;
  } catch {
    mostrarPrograma('Louvores que Edificam');
  }
}

async function loadUploadedSongs() {
  try {
    const data = await getJSON('/api/signal/library');
    uploadedSongs = (data.items || [])
      .filter(x => /\.mp3$/i.test(x.name || x.id || ''))
      .map(x => ({
        title: x.name || 'Louvor',
        url: `/uploaded-radio/${encodeURIComponent(x.id)}`
      }));
  } catch {
    uploadedSongs = [];
  }
}

async function getProgramAudio() {
  if (!currentStatus || !currentStatus.current) return null;
  try {
    const p = await getJSON('/api/program');
    if (p.preparedAudio) {
      return { title: p.showName || currentStatus.current.nome || 'Programa', url: p.preparedAudio };
    }
  } catch {}
  return null;
}

async function chooseNextTrack() {
  await refreshStatus();

  const program = await getProgramAudio();
  if (program) return program;

  if (!uploadedSongs.length) await loadUploadedSongs();

  if (uploadedSongs.length) {
    const track = uploadedSongs[songIndex % uploadedSongs.length];
    songIndex = (songIndex + 1) % uploadedSongs.length;
    return track;
  }

  return null;
}

async function playNext() {
  const track = await chooseNextTrack();

  if (!track) {
    $('#statusText').textContent = 'Envie músicas pelo painel ou prepare a programação de hoje.';
    return;
  }

  audio.src = track.url;
  if ($('#nowTitle') && (!currentStatus || !currentStatus.current)) {
    $('#nowTitle').textContent = track.title;
  }
  $('#statusText').textContent = 'Carregando...';

  try {
    await audio.play();
    started = true;
    $('#power').textContent = '📻 RÁDIO LIGADA';
    $('#play').textContent = '⏸';
    $('#statusText').textContent = 'AO VIVO';
  } catch {
    $('#statusText').textContent = 'Não foi possível tocar este áudio.';
  }
}

$('#power').onclick = playNext;

$('#play').onclick = async () => {
  if (!started || !audio.src) return playNext();
  if (audio.paused) {
    try {
      await audio.play();
      $('#play').textContent = '⏸';
      $('#statusText').textContent = 'AO VIVO';
    } catch {
      $('#statusText').textContent = 'Não foi possível tocar este áudio.';
    }
  } else {
    audio.pause();
    $('#play').textContent = '▶';
    $('#statusText').textContent = 'PAUSADO';
  }
};

$('#prev').onclick = async () => {
  if (uploadedSongs.length) {
    songIndex = (songIndex - 2 + uploadedSongs.length) % uploadedSongs.length;
  }
  await playNext();
};

$('#next').onclick = playNext;

audio.addEventListener('ended', playNext);
audio.addEventListener('playing', () => {
  $('#play').textContent = '⏸';
  $('#power').textContent = '📻 RÁDIO LIGADA';
  $('#statusText').textContent = 'AO VIVO';
});
audio.addEventListener('pause', () => {
  if (!audio.ended) $('#play').textContent = '▶';
});

refreshStatus();
loadUploadedSongs();
setInterval(refreshStatus, 15000);
