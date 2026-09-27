const $ = s => document.querySelector(s);

const tabs = [...document.querySelectorAll('.tab')];

function showTab(id) {
  tabs.forEach(t => t.classList.toggle('active', t.id === id));
  document.querySelectorAll('.nav[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === id);
  });
}

document.querySelectorAll('.nav[data-tab]').forEach(b => {
  b.onclick = () => showTab(b.dataset.tab);
});

async function getJSON(url) {
  const sep = url.includes('?') ? '&' : '?';
  const r = await fetch(`${url}${sep}_=${Date.now()}`, { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    btn.dataset.old = btn.textContent;
    btn.disabled = true;
    btn.textContent = label || 'Aguarde...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.old || btn.textContent;
  }
}

function resultBox(title, status = '') {
  const p = $('#resultPanel');
  if (!p) return;
  p.style.display = 'block';
  $('#resultTitle').textContent = title;
  $('#resultStatus').textContent = status;
  $('#resultText').textContent = '';
  $('#resultAudio').style.display = 'none';
  $('#resultAudio').removeAttribute('src');
  p.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function showProgramItem(kind, btn) {
  setBusy(btn, true, 'Carregando...');
  resultBox(kind === 'sermon' ? 'Pregação' : 'Oração', 'Carregando conteúdo do programa...');
  try {
    const data = await getJSON('/api/program');
    const wanted = kind === 'sermon' ? 'Palavra' : 'Oração';
    const item = (data.queue || []).find(x => x.label === wanted);
    if (!item?.text) throw new Error('Conteúdo ainda não disponível.');
    $('#resultStatus').textContent = `${data.showName || ''} • ${data.host?.nome || ''}`;
    $('#resultText').textContent = item.text;
  } catch (e) {
    $('#resultStatus').textContent = 'Não foi possível carregar';
    $('#resultText').textContent = e.message;
  } finally {
    setBusy(btn, false);
  }
}

async function showJingle(btn) {
  setBusy(btn, true, 'Carregando...');
  resultBox('Vinheta', 'Carregando identificação da rádio...');
  try {
    const data = await getJSON('/api/jingle');
    $('#resultStatus').textContent = data.program || 'Web Rádio Vem Comigo Deus';
    $('#resultText').textContent = data.text || '';
  } catch (e) {
    $('#resultStatus').textContent = 'Não foi possível carregar';
    $('#resultText').textContent = e.message;
  } finally {
    setBusy(btn, false);
  }
}

async function prepareToday(btn) {
  setBusy(btn, true, 'Preparando...');
  resultBox('Programação de hoje', 'Preparando conteúdo e voz para os programas...');
  try {
    const data = await getJSON('/api/prepare-day');
    const rows = (data.results || [])
      .map(x => `${x.nome}: ${x.status === 'cached' ? 'já estava pronto' : 'preparado agora'}`)
      .join('\n');

    const q = data.quota || {};
    $('#resultStatus').textContent = 'Programação preparada';
    $('#resultText').textContent =
      `${rows}\n\n` +
      `TTS: ${q.tts ?? '-'} / ${q.limits?.tts ?? '-'}\n` +
      `Texto: ${q.text ?? '-'} / ${q.limits?.text ?? '-'}\n\n` +
      `As músicas são enviadas separadamente por você na aba Músicas.`;

    await loadDashboard();
  } catch (e) {
    $('#resultStatus').textContent = 'Não foi possível preparar tudo';
    $('#resultText').textContent = e.message;
  } finally {
    setBusy(btn, false);
  }
}

function bind(id, fn) {
  const b = $(id);
  if (b) b.addEventListener('click', () => fn(b));
}

bind('#quickPrepare', prepareToday);
bind('#prepareDay', prepareToday);
bind('#genSermon', b => showProgramItem('sermon', b));
bind('#genPrayer', b => showProgramItem('prayer', b));
bind('#genJingle', showJingle);

bind('#quickSermon', () => {
  showTab('conteudo');
  showProgramItem('sermon', $('#genSermon'));
});

bind('#quickPrayer', () => {
  showTab('conteudo');
  showProgramItem('prayer', $('#genPrayer'));
});

bind('#quickJingle', () => {
  showTab('conteudo');
  showJingle($('#genJingle'));
});

bind('#quickLibrary', () => showTab('biblioteca'));

if ($('#closeResult')) {
  $('#closeResult').onclick = () => $('#resultPanel').style.display = 'none';
}

const schedule = [
  ['09:00–10:00', 'Bom Dia Deus', 'Pastor Luiz Felipe', 'Puck'],
  ['12:30–13:00', 'Encontro com Deus', 'Missionária Ingrid Laura', 'Sulafat'],
  ['18:00–19:00', 'Tarde da Benção', 'Pastor Bernardo Henrique', 'Achird'],
  ['19:00–21:00', 'Culto No Seu Lar', 'Pastor Heitor Cruz', 'Charon']
];

function renderSchedule() {
  if ($('#scheduleMini')) {
    $('#scheduleMini').innerHTML = schedule.map(x => `
      <div class="schedule-row">
        <b>${x[0].split('–')[0]}</b>
        <div><strong>${x[1]}</strong><span> • ${x[2]}</span></div>
        <span>${x[0]}</span>
      </div>
    `).join('');
  }

  if ($('#programGrid')) {
    $('#programGrid').innerHTML = schedule.map(x => `
      <article class="program-card">
        <div class="time">${x[0]}</div>
        <div><h3>${x[1]}</h3><p>${x[2]}</p></div>
        <span class="voice">Voz ${x[3]}</span>
      </article>
    `).join('');
  }
}

function humanSize(n = 0) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function classifyName(name = '') {
  const s = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (s.includes('forro')) return 'Forró gospel';
  if (s.includes('sertanejo') || s.includes('viola')) return 'Sertanejo gospel';
  if (s.includes('adoracao') || s.includes('worship')) return 'Adoração';
  if (s.includes('pentecostal') || s.includes('avivado') || s.includes('fogo')) return 'Pentecostal';
  if (s.includes('instrumental')) return 'Instrumental';
  return 'Louvor';
}

function autoOrder(files) {
  const groups = new Map();

  for (const file of files) {
    const cat = classifyName(file.name);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(file);
  }

  const buckets = [...groups.values()];
  const ordered = [];

  let more = true;
  while (more) {
    more = false;
    for (const bucket of buckets) {
      if (bucket.length) {
        ordered.push(bucket.shift());
        more = true;
      }
    }
  }

  return ordered;
}

const musicState = { files: [] };

function libraryToken() {
  return ($('#libraryAdminToken')?.value || localStorage.getItem('radioAdminToken') || '').trim();
}

function saveLibraryToken() {
  const t = libraryToken();
  if (t) localStorage.setItem('radioAdminToken', t);
}

function renderSelectedMusic() {
  const box = $('#selectedMusic');
  if (!box) return;

  if (!musicState.files.length) {
    box.innerHTML = '<p class="muted">Nenhuma música selecionada.</p>';
    return;
  }

  const ordered = autoOrder([...musicState.files]);

  box.innerHTML = ordered.map((f, i) => `
    <div class="signal-file-pick">
      <span><b>${String(i + 1).padStart(2, '0')}.</b> 🎵 ${f.name}</span>
      <small>${classifyName(f.name)} • ${humanSize(f.size)}</small>
    </div>
  `).join('');
}

async function loadMusicLibrary() {
  const box = $('#musicLibraryList');

  try {
    const d = await getJSON('/api/signal/library');
    const items = d.items || [];

    if ($('#musicCount')) {
      $('#musicCount').textContent = `${items.length} música${items.length === 1 ? '' : 's'}`;
      $('#musicCount').className = 'badge ' + (items.length ? 'ready' : 'pending');
    }

    if ($('#statSongs')) $('#statSongs').textContent = String(items.length);

    if (!box) return;

    if (!items.length) {
      box.innerHTML = '<p class="muted">A biblioteca ainda está vazia. Envie seus MP3 acima.</p>';
      return;
    }

    box.innerHTML = items.map((x, i) => `
      <article class="library-item">
        <small>${classifyName(x.name).toUpperCase()}</small>
        <h3>${String(i + 1).padStart(2, '0')} • ${x.name}</h3>
        <p>${humanSize(x.bytes || 0)} • pronto para a rotação automática</p>
      </article>
    `).join('');
  } catch (e) {
    if (box) box.innerHTML = `<p class="muted">${e.message}</p>`;
  }
}

if ($('#libraryAdminToken')) {
  $('#libraryAdminToken').value = localStorage.getItem('radioAdminToken') || '';
  $('#libraryAdminToken').addEventListener('change', saveLibraryToken);
}

if ($('#pickMusicFiles')) {
  $('#pickMusicFiles').onclick = () => $('#musicUploadPicker').click();
}

if ($('#musicUploadPicker')) {
  $('#musicUploadPicker').onchange = () => {
    const all = [...$('#musicUploadPicker').files];
    musicState.files = all.filter(f => /\.mp3$/i.test(f.name));
    renderSelectedMusic();

    if ($('#uploadState')) {
      $('#uploadState').textContent = `${musicState.files.length} selecionada${musicState.files.length === 1 ? '' : 's'}`;
    }
  };
}

if ($('#uploadMusicFiles')) {
  $('#uploadMusicFiles').onclick = async () => {
    const btn = $('#uploadMusicFiles');

    if (!musicState.files.length) {
      alert('Escolha as músicas MP3 primeiro.');
      return;
    }

    const token = libraryToken();
    if (!token) {
      alert('Digite a senha do painel antes de enviar.');
      return;
    }

    saveLibraryToken();
    setBusy(btn, true, 'Enviando...');
    if ($('#uploadState')) $('#uploadState').textContent = 'Organizando e enviando...';

    try {
      const ordered = autoOrder([...musicState.files]);
      const fd = new FormData();

      ordered.forEach(f => fd.append('audio', f, f.name));

      const r = await fetch('/api/signal/upload', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: fd
      });

      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);

      musicState.files = [];
      $('#musicUploadPicker').value = '';
      renderSelectedMusic();

      if ($('#uploadState')) {
        $('#uploadState').textContent = `Pronto • ${d.count || 0} músicas`;
        $('#uploadState').className = 'badge ready';
      }

      await loadMusicLibrary();
      await loadDashboard();

    } catch (e) {
      if ($('#uploadState')) {
        $('#uploadState').textContent = 'Erro';
        $('#uploadState').className = 'badge pending';
      }
      alert(e.message);
    } finally {
      setBusy(btn, false);
    }
  };
}

if ($('#clearMusicFiles')) {
  $('#clearMusicFiles').onclick = async () => {
    if (!confirm('Apagar todas as músicas enviadas da biblioteca?')) return;

    const token = libraryToken();
    if (!token) {
      alert('Digite a senha do painel.');
      return;
    }

    saveLibraryToken();

    try {
      const r = await fetch('/api/signal/clear', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-token': token
        },
        body: '{}'
      });

      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);

      await loadMusicLibrary();
      await loadDashboard();

    } catch (e) {
      alert(e.message);
    }
  };
}

if ($('#refreshMusicLibrary')) {
  $('#refreshMusicLibrary').onclick = loadMusicLibrary;
}

async function loadDashboard() {
  try {
    const [s, lib] = await Promise.all([
      getJSON('/api/status'),
      getJSON('/api/signal/library')
    ]);

    const cur = s.current;

    $('#currentShow').textContent =
      cur?.nome || s.filler?.nome || 'Louvores que Edificam';

    if (cur) {
      const host = s.voices?.[cur.apresentador]?.nome || '';
      $('#currentHost').textContent = `${host ? `Com ${host} • ` : ''}${cur.inicio}–${cur.fim}`;
    } else {
      $('#currentHost').textContent = `Rotação automática de músicas • Próximo: ${s.next.nome} às ${s.next.inicio}`;
    }

    $('#clock').textContent = `${s.now.full} • Brasília`;

    $('#apiState').textContent = s.configured
      ? `IA conectada • TTS ${s.quota.tts}/${s.quota.limits.tts} • Texto ${s.quota.text}/${s.quota.limits.text}`
      : 'IA: chave não configurada';

    $('#statCurrent').textContent =
      cur?.nome || s.filler?.nome || 'Louvores que Edificam';

    $('#statNext').textContent = `${s.next.inicio} • ${s.next.nome}`;

    $('#statSongs').textContent = String(lib.count || 0);

    if ($('#quotaNote')) {
      $('#quotaNote').textContent =
        `Programas preparados: ${s.prepared}/4 • ` +
        `TTS ${s.quota.tts}/${s.quota.limits.tts} • ` +
        `Texto ${s.quota.text}/${s.quota.limits.text} • ` +
        `Músicas enviadas: ${lib.count || 0}`;
    }

  } catch (e) {
    $('#currentShow').textContent = 'Painel em modo local';
    $('#currentHost').textContent = 'Servidor não respondeu.';
    $('#apiState').textContent = 'Servidor desconectado';
  }
}

renderSchedule();
loadDashboard();
loadMusicLibrary();

setInterval(loadDashboard, 15000);
setInterval(loadMusicLibrary, 30000);
