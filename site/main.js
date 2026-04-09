// ── Descompresor 2bpp inline (sin bundler) ──────────────────────────────────

const PALETTE = [[0,0,0],[85,85,85],[170,170,170],[255,255,255]];
const W = 80, H = 80;

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function decompress2bpp(bytes) {
  const pixels = new Uint8Array(W * H);
  let idx = 0;
  for (let i = 0; i < bytes.length && idx < pixels.length; i++) {
    for (let n = 0; n < 4 && idx < pixels.length; n++)
      pixels[idx++] = (bytes[i] >> (6 - n * 2)) & 0x03;
  }
  return pixels;
}

function renderHex(hex, canvas) {
  const bytes = hexToBytes(hex);
  const pixels = decompress2bpp(bytes);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < pixels.length; i++) {
    const c = PALETTE[pixels[i]];
    img.data[i * 4]     = c[0];
    img.data[i * 4 + 1] = c[1];
    img.data[i * 4 + 2] = c[2];
    img.data[i * 4 + 3] = 255;
  }

  // Rotar 90° (igual que el resto de la instalación)
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.save();
  ctx.translate(W, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

// ── Estado ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 60;
let currentFilter = null; // null = todos
let currentPage = 0;
let totalCount = 0;

// ── DOM ─────────────────────────────────────────────────────────────────────

const grid      = document.getElementById('grid');
const status    = document.getElementById('status');
const pageInfo  = document.getElementById('page-info');
const prevBtn   = document.getElementById('prev-btn');
const nextBtn   = document.getElementById('next-btn');
const exportBtn = document.getElementById('export-btn');

// ── Analytics ───────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const res = await fetch('/api/analytics/overview');
    if (!res.ok) return;
    const data = await res.json();

    totalCount = data.total_events ?? 0;

    document.getElementById('stat-total').textContent  = totalCount.toLocaleString();
    document.getElementById('stat-avg').textContent    = (data.daily_average ?? 0).toFixed(1);
    document.getElementById('stat-size').textContent   = (data.total_size_mb ?? 0).toFixed(2) + ' MB';
    document.getElementById('stat-last').textContent   = data.last_event
      ? new Date(data.last_event).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
      : '—';
  } catch (e) {
    console.error('Error cargando stats:', e);
  }
}

// ── Grid ────────────────────────────────────────────────────────────────────

async function loadPage() {
  grid.innerHTML = '';
  status.textContent = 'Cargando...';
  status.style.display = 'block';

  const offset = currentPage * PAGE_SIZE;
  const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
  if (currentFilter !== null) params.set('nfc_index', currentFilter);

  try {
    const res = await fetch(`/api/nfc-events?${params}`);
    if (!res.ok) throw new Error('Error fetching');
    const rows = await res.json();

    status.style.display = rows.length === 0 ? 'block' : 'none';
    if (rows.length === 0) { status.textContent = 'Sin resultados.'; updatePagination(0); return; }

    status.style.display = 'none';

    rows.forEach(row => {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const canvas = document.createElement('canvas');
      try { renderHex(row.snapshot_data, canvas); }
      catch (e) { canvas.style.background = '#111'; }

      const meta = document.createElement('div');
      meta.className = 'cell-meta';
      const ts = new Date(row.timestamp).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
      meta.textContent = `NFC ${row.nfc_index} · ${ts}`;

      cell.appendChild(canvas);
      cell.appendChild(meta);
      grid.appendChild(cell);
    });

    updatePagination(rows.length);
  } catch (e) {
    status.textContent = 'Error al cargar snapshots.';
    console.error(e);
  }
}

function updatePagination(loaded) {
  const isFirst = currentPage === 0;
  const isLast  = loaded < PAGE_SIZE;
  prevBtn.disabled = isFirst;
  nextBtn.disabled = isLast;
  pageInfo.textContent = `página ${currentPage + 1}`;
}

// ── Filtros ─────────────────────────────────────────────────────────────────

document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter === 'all' ? null : parseInt(btn.dataset.filter);
    currentPage = 0;
    loadPage();
  });
});

prevBtn.addEventListener('click', () => { currentPage--; loadPage(); });
nextBtn.addEventListener('click', () => { currentPage++; loadPage(); });

// ── Export ──────────────────────────────────────────────────────────────────

exportBtn.addEventListener('click', async () => {
  exportBtn.textContent = 'Exportando...';
  exportBtn.disabled = true;

  try {
    const params = new URLSearchParams({ limit: 9999, offset: 0 });
    if (currentFilter !== null) params.set('nfc_index', currentFilter);

    const res = await fetch(`/api/nfc-events?${params}`);
    const rows = await res.json();

    // CSV: id, timestamp, nfc_index, texture_name, snapshot_data
    const header = 'id,timestamp,nfc_index,texture_name,snapshot_data';
    const lines = rows.map(r =>
      `${r.id},"${r.timestamp}",${r.nfc_index},"${r.texture_name ?? ''}","${r.snapshot_data}"`
    );
    const csv = [header, ...lines].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `risosc-snapshots${currentFilter !== null ? `-nfc${currentFilter}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Error exportando:', e);
  } finally {
    exportBtn.textContent = 'Exportar CSV';
    exportBtn.disabled = false;
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────

loadStats();
loadPage();
