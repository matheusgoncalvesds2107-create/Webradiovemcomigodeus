const $ = s => document.querySelector(s);
const audio = $('#audio');

const STREAM = '/radio-stream';

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json();

  if (!r.ok) {
    throw new Error(j.error || 'Erro');
  }

  return j;
}

function mostrarPrograma(nome, apresentador = '') {
  // Parte grande acima do player
  if ($('#show')) {
    $('#show').textContent = nome;
  }

  if ($('#host')) {
    $('#host').textContent = apresentador
      ? `Com ${apresentador}`
      : 'Web Rádio Vem Comigo Deus';
  }

  // Dentro do PLAYER ANTIGO
  if ($('#kind')) {
    $('#kind').textContent =
      nome === 'Louvores que Edificam'
        ? 'LOUVORES • AO VIVO'
        : 'PROGRAMA AO VIVO';
  }

  if ($('#nowTitle')) {
    $('#nowTitle').textContent = apresentador
      ? `${nome} — ${apresentador}`
      : nome;
  }
}

async function refresh() {
  try {
    const s = await getJSON('/api/status');

    if (s.current) {
      const nomePrograma = s.current.nome || 'Web Rádio Vem Comigo Deus';

      const chaveVoz = s.current.apresentador;

      const apresentador =
        s.voices &&
        chaveVoz &&
        s.voices[chaveVoz]
          ? s.voices[chaveVoz].nome
          : '';

      mostrarPrograma(nomePrograma, apresentador);
    } else {
      mostrarPrograma('Louvores que Edificam');
    }

    if ($('#clock') && s.now) {
      $('#clock').textContent =
        `${s.now.full} • Horário de Brasília`;
    }

  } catch (e) {
    // Mesmo se Gemini estiver sem cota,
    // o nome da rádio/programação não desaparece.
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

  } catch (e) {
    $('#statusText').textContent =
      'Não foi possível iniciar o sinal.';
  }
}

$('#power').onclick = startRadio;

$('#play').onclick = async () => {
  if (!audio.src) {
    await startRadio();
    return;
  }

  if (audio.paused) {
    try {
      await audio.play();
      $('#play').textContent = '⏸';
      $('#statusText').textContent = 'AO VIVO';
    } catch {
      $('#statusText').textContent =
        'Não foi possível iniciar o sinal.';
    }
  } else {
    audio.pause();
    $('#play').textContent = '▶';
  }
};

$('#next').onclick = async () => {
  audio.src = STREAM + '?t=' + Date.now();

  try {
    await audio.play();
  } catch {
    $('#statusText').textContent =
      'Não foi possível iniciar o sinal.';
  }
};

$('#prev').onclick = async () => {
  audio.src = STREAM + '?t=' + Date.now();

  try {
    await audio.play();
  } catch {
    $('#statusText').textContent =
      'Não foi possível iniciar o sinal.';
  }
};

audio.addEventListener('playing', () => {
  $('#statusText').textContent = 'AO VIVO';
  $('#play').textContent = '⏸';
  $('#power').textContent = '📻 RÁDIO LIGADA';
});

audio.addEventListener('pause', () => {
  $('#play').textContent = '▶';
});

audio.addEventListener('error', () => {
  $('#statusText').textContent = 'Sinal indisponível.';
});

// Atualiza programa/pastor sem depender do Gemini
refresh();
setInterval(refresh, 15000);
