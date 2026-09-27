const $ = s => document.querySelector(s);
const audio = $('#audio');
const STREAM = '/radio-stream';

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

async function refresh() {
  try {
    const s = await getJSON('/api/status');
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

async function startRadio() {
  $('#statusText').textContent = 'Conectando ao sinal...';
  audio.src = STREAM + '?t=' + Date.now();
  try {
    await audio.play();
    $('#power').textContent = '📻 RÁDIO LIGADA';
    $('#play').textContent = '⏸';
    $('#statusText').textContent = 'AO VIVO';
  } catch {
    $('#statusText').textContent = 'Sinal indisponível no momento.';
  }
}

$('#power').onclick = startRadio;
$('#play').onclick = async () => {
  if (!audio.src) return startRadio();
  if (audio.paused) {
    try { await audio.play(); $('#play').textContent='⏸'; $('#statusText').textContent='AO VIVO'; }
    catch { $('#statusText').textContent='Sinal indisponível no momento.'; }
  } else {
    audio.pause();
    $('#play').textContent='▶';
  }
};
$('#prev').onclick = startRadio;
$('#next').onclick = startRadio;

audio.addEventListener('playing',()=>{ $('#play').textContent='⏸'; $('#power').textContent='📻 RÁDIO LIGADA'; $('#statusText').textContent='AO VIVO'; });
audio.addEventListener('pause',()=>{ $('#play').textContent='▶'; });
audio.addEventListener('error',()=>{ $('#statusText').textContent='Sinal indisponível no momento.'; });

refresh();
setInterval(refresh,15000);
