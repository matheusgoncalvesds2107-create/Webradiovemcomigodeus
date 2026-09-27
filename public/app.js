const $ = s => document.querySelector(s);

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Erro');
  return j;
}

function mostrarPrograma(nome, apresentador = '') {
  if ($('#show')) $('#show').textContent = nome;
  if ($('#host')) {
    $('#host').textContent = apresentador
      ? `Com ${apresentador}`
      : 'Web Rádio Vem Comigo Deus';
  }
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
      const nome = s.current.nome || 'Web Rádio Vem Comigo Deus';
      const chave = s.current.apresentador;
      const apresentador =
        s.voices && chave && s.voices[chave]
          ? s.voices[chave].nome
          : '';
      mostrarPrograma(nome, apresentador);
    } else {
      mostrarPrograma('Louvores que Edificam');
    }

    if ($('#clock') && s.now) {
      $('#clock').textContent = `${s.now.full} • Horário de Brasília`;
    }
  } catch {
    mostrarPrograma('Louvores que Edificam');
  }
}

if ($('#power')) {
  $('#power').onclick = () => {
    const player = $('#casterPlayer');
    if (player) player.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if ($('#statusText')) $('#statusText').textContent = 'Toque no play do rádio para ouvir ao vivo.';
  };
}

refresh();
setInterval(refresh, 15000);
