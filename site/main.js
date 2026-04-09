import { GrainEngine, SnapToGrains, SnapshotCompressor } from '/lib/granular.js';

// ── Instancias treslib ────────────────────────────────────────────────────────

const compressor = new SnapshotCompressor(80, 80);

// ── Estado ───────────────────────────────────────────────────────────────────

let currentFilter = null;
let snapshots     = []; // { hex, el }

let audioCtx     = null;
let grainEngine  = null;
let snapToGrains = null;
let isPlaying    = false;
let activeCell   = null;

// ── DOM ──────────────────────────────────────────────────────────────────────

const grid         = document.getElementById('grid');
const statusEl     = document.getElementById('status');
const audioStatus  = document.getElementById('audio-status');
const audioFile    = document.getElementById('audio-file');
const audioLoad    = document.getElementById('audio-load');
const audioToggle  = document.getElementById('audio-toggle');
const audioVol     = document.getElementById('audio-vol');

// ── Analytics ────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const res  = await fetch('/api/analytics/overview');
    if (!res.ok) return;
    const data = await res.json();
    const ov   = data.overview;

    document.getElementById('stat-total').textContent = (ov.total_events ?? 0).toLocaleString();
    document.getElementById('stat-avg').textContent   = parseFloat(ov.avg_per_day ?? 0).toFixed(1);
    document.getElementById('stat-size').textContent  = ov.total_data_size_mb ?? '—';
    document.getElementById('stat-last').textContent  = ov.last_event
      ? new Date(ov.last_event.replace(' ', 'T') + 'Z').toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
      : '—';
  } catch (e) {
    console.error('Error cargando stats:', e);
  }
}

// ── Grid (densidad máxima) ────────────────────────────────────────────────────

async function loadGrid() {
  statusEl.textContent   = 'Cargando...';
  statusEl.style.display = 'block';
  grid.innerHTML = '';
  snapshots = [];

  const params = new URLSearchParams({ limit: 1200 });
  if (currentFilter !== null) params.set('nfc_index', currentFilter);

  try {
    const res = await fetch(`/api/nfc-events?${params}`);
    if (!res.ok) throw new Error('fetch failed');
    let rows = await res.json();

    if (rows.length === 0) { statusEl.textContent = 'Sin resultados.'; return; }

    rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const topOffset = grid.getBoundingClientRect().top;
    const W = window.innerWidth;
    const H = window.innerHeight - topOffset;

    const size = Math.sqrt((W * H) / rows.length);
    let cols   = Math.floor(W / size);
    let nrows  = Math.floor(H / size);
    let total  = cols * nrows;

    if (rows.length > total) {
      rows = rows.slice(0, total);
    } else if (rows.length < total) {
      const opt = Math.ceil(rows.length / cols);
      if (opt <= Math.floor(H / size)) { nrows = opt; total = cols * nrows; }
    }

    statusEl.style.display = 'none';

    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows    = `repeat(${nrows}, 1fr)`;
    grid.style.height              = `${H}px`;
    grid.style.padding             = '0';
    grid.style.gap                 = '0';

    rows.forEach((row, i) => {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const canvas = document.createElement('canvas');
      canvas.width  = compressor.targetWidth;
      canvas.height = compressor.targetHeight;
      try { compressor.renderToCanvas(row.snapshot_data, canvas, 90); }
      catch (e) { canvas.style.background = '#111'; }

      const meta = document.createElement('div');
      meta.className   = 'cell-meta';
      const ts = row.timestamp
        ? new Date(row.timestamp).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
        : '—';
      meta.textContent = `NFC ${row.nfc_index} · ${ts}`;

      cell.appendChild(canvas);
      cell.appendChild(meta);
      grid.appendChild(cell);
      snapshots.push({ hex: row.snapshot_data, el: cell });

      cell.addEventListener('click', () => handleCellClick(i));
    });

    for (let i = rows.length; i < total; i++) {
      const empty = document.createElement('div');
      empty.className = 'cell';
      grid.appendChild(empty);
    }

  } catch (e) {
    statusEl.textContent = 'Error al cargar snapshots.';
    console.error(e);
  }
}

// ── Interacción con celda ─────────────────────────────────────────────────────

function handleCellClick(i) {
  if (!snapToGrains) {
    setAudioStatus('carga un archivo de audio primero');
    return;
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();

  if (activeCell) activeCell.el.classList.remove('cell-active');
  activeCell = snapshots[i];
  activeCell.el.classList.add('cell-active');

  snapToGrains.applySnapshot(snapshots[i].hex);

  const snap = snapToGrains.getCurrentSnapshot();
  if (snap) {
    setAudioStatus(
      `brillo ${snap.brightness.toFixed(2)} · ` +
      `contraste ${snap.contrast.toFixed(2)} · ` +
      `complejidad ${snap.complexity.toFixed(2)}`
    );
  }
}

// ── Audio: carga ─────────────────────────────────────────────────────────────

audioLoad.addEventListener('click', async () => {
  const file = audioFile.files[0];
  if (!file) { setAudioStatus('selecciona un archivo primero'); return; }

  setAudioStatus('cargando...');

  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const buffer = await audioCtx.decodeAudioData(await file.arrayBuffer());

    if (grainEngine) { grainEngine.stop(); }

    grainEngine = new GrainEngine(audioCtx, buffer, {
      pointer: 0, rate: 1, overlaps: 6, windowSize: 0.12, masterAmp: parseFloat(audioVol.value),
    });
    grainEngine.connect(audioCtx.destination);

    snapToGrains = new SnapToGrains(audioCtx, grainEngine, {
      compressor,
      smoothingTime: 0.5,
      jitter: 0.05,
      pointerTransitionTime: 2.0,
    });

    isPlaying = false;
    audioToggle.textContent = 'Play';
    audioToggle.disabled = false;

    setAudioStatus(`"${file.name}" · ${buffer.duration.toFixed(1)}s · haz click en una celda`);

  } catch (err) {
    setAudioStatus('error: ' + err.message);
    console.error(err);
  }
});

// ── Audio: play / stop ────────────────────────────────────────────────────────

audioToggle.addEventListener('click', () => {
  if (!snapToGrains) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  if (isPlaying) {
    snapToGrains.stop();
    audioToggle.textContent = 'Play';
    isPlaying = false;
  } else {
    snapToGrains.start();
    audioToggle.textContent = 'Stop';
    isPlaying = true;
  }
});

// ── Audio: volumen ────────────────────────────────────────────────────────────

audioVol.addEventListener('input', () => {
  if (grainEngine) grainEngine.masterAmp.gain.value = parseFloat(audioVol.value);
});

// ── Filtros ──────────────────────────────────────────────────────────────────

document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter === 'all' ? null : parseInt(btn.dataset.filter);
    loadGrid();
  });
});

// ── Resize ───────────────────────────────────────────────────────────────────

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(loadGrid, 250);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function setAudioStatus(msg) { audioStatus.textContent = msg; }

// ── Welcome screen ───────────────────────────────────────────────────────────

const welcome    = document.getElementById('welcome');
const welcomeBtn = document.getElementById('welcome-btn');

function initWelcome() {
  if (sessionStorage.getItem('risosc-welcomed')) {
    welcome.classList.add('hidden');
    return;
  }
  welcomeBtn.addEventListener('click', () => {
    welcome.classList.add('hidden');
    sessionStorage.setItem('risosc-welcomed', '1');
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────

initWelcome();
loadStats();
loadGrid();
