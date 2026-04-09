const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const app = express();

// Middleware para JSON
app.use(express.json());

// Directorios
const SITE_DIR    = path.join(__dirname, '../site');       // nuevo sitio (landing principal)
const DIST_DIR    = path.join(__dirname, '../dist');       // build histórico (app Three.js)
const WEB_SRC_DIR = path.join(__dirname, '../web/src');    // viewers y archivos originales

// 1️⃣ Servir archivos estáticos
app.use(express.static(SITE_DIR));    // sitio principal
app.use(express.static(DIST_DIR));    // app histórica
app.use(express.static(WEB_SRC_DIR)); // viewers
app.use('/lib/treslib', express.static(path.join(__dirname, '../node_modules/treslib/src')));

// 2️⃣ Crear servidor HTTP
const server = http.createServer(app);

// 3️⃣ Configurar WebSocket
const wss = new WebSocket.Server({ server });
let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  console.log('Cliente conectado');

  ws.on('close', () => {
    clients = clients.filter((client) => client !== ws);
    console.log('Cliente desconectado');
  });
});

// 4️⃣ CONEXIÓN A BD
const db = new sqlite3.Database('./nfc_snapshots.db', (err) => {
  if (err) {
    console.error('Error abriendo BD:', err.message);
  } else {
    console.log('Conectado a SQLite');
    // Crear tabla si no existe
    db.run(`CREATE TABLE IF NOT EXISTS nfc_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      nfc_index INTEGER NOT NULL,
      texture_name TEXT,
      snapshot_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// 5️⃣ Endpoint para NFC
app.post('/api/nfc', (req, res) => {
  const { index } = req.body;
  console.log('NFC recibido:', index);

  // Notificar clientes WebSocket
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'activate', index }));
    }
  });

  res.status(200).send('ok');
});

// 6️⃣ Endpoint para SNAPSHOTS
app.post('/api/nfc-events', (req, res) => {
  try {
    const { timestamp, nfc_index, texture_name, snapshot_data } = req.body;
    
    // Validar datos
    if (nfc_index === undefined || !snapshot_data) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Guardar en BD
    db.run(
      `INSERT INTO nfc_snapshots (timestamp, nfc_index, texture_name, snapshot_data) 
       VALUES (?, ?, ?, ?)`,
      [timestamp, nfc_index, texture_name, snapshot_data],
      function(err) {
        if (err) {
          console.error('❌ Error BD:', err);
          return res.status(500).json({ error: 'Error guardando en BD' });
        }
        
        console.log(`Snapshot guardado: NFC_${nfc_index} | ${texture_name} | ${snapshot_data.length} bytes`);
        res.json({ 
          success: true, 
          id: this.lastID,
          size: snapshot_data.length 
        });
      }
    );

  } catch (error) {
    console.error('❌ Error guardando snapshot:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 7️⃣ Endpoint para consultar historial
app.get('/api/nfc-events', (req, res) => {
  const { limit = 50, offset = 0, nfc_index } = req.query;

  let query = `SELECT * FROM nfc_snapshots`;
  let params = [];

  if (nfc_index !== undefined) {
    query += ` WHERE nfc_index = ?`;
    params.push(nfc_index);
  }

  query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error consultando eventos:', err);
      return res.status(500).json({ error: 'Error en consulta' });
    }
    res.json(rows);
  });
});

// 8️⃣ 📊 ENDPOINTS DE ANALYTICS COMPLETOS
app.get('/api/analytics/overview', (req, res) => {
  const queries = `
    SELECT 
      (SELECT COUNT(*) FROM nfc_snapshots) as total_events,
      (SELECT MIN(created_at) FROM nfc_snapshots) as first_event,
      (SELECT MAX(created_at) FROM nfc_snapshots) as last_event,
      (SELECT SUM(LENGTH(snapshot_data)) FROM nfc_snapshots) as total_data_size
  `;

  db.get(queries, [], (err, overview) => {
    if (err) {
      console.error('Error en overview:', err);
      return res.status(500).json({ error: 'Error en análisis' });
    }

    // Calcular promedio diario
    let avg_per_day = 0;
    if (overview.first_event && overview.last_event) {
      const first = new Date(overview.first_event);
      const last = new Date(overview.last_event);

      // Diferencia en días (mínimo 1)
      const diffDays = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
      avg_per_day = overview.total_events / diffDays;
    }

    // Datos por hora del día
    db.all(`
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(*) as count
      FROM nfc_snapshots 
      GROUP BY hour 
      ORDER BY hour
    `, [], (err, hourly) => {
      if (err) {
        console.error('Error en hourly:', err);
        return res.status(500).json({ error: 'Error en análisis' });
      }

      // Eventos por NFC
      db.all(`
        SELECT nfc_index, COUNT(*) as count 
        FROM nfc_snapshots 
        GROUP BY nfc_index 
        ORDER BY count DESC
      `, [], (err, byNFC) => {
        if (err) {
          console.error('Error en byNFC:', err);
          return res.status(500).json({ error: 'Error en análisis' });
        }

        // Respuesta final
        res.json({
          overview: {
            total_events: overview.total_events,
            first_event: overview.first_event,
            last_event: overview.last_event,
            total_data_size: overview.total_data_size,
            total_data_size_mb: (overview.total_data_size / 1024 / 1024).toFixed(2) + ' MB',
            avg_per_day: avg_per_day.toFixed(2)
          },
          hourly_distribution: hourly,
          events_by_nfc: byNFC,
          database_info: {
            last_updated: new Date().toISOString(),
            estimated_records: overview.total_events
          }
        });
      });
    });
  });
});


// 9️⃣ Análisis específico por NFC
app.get('/api/analytics/nfc/:index', (req, res) => {
  const nfcIndex = req.params.index;
  
  db.all(`
    SELECT 
      COUNT(*) as total_uses,
      MIN(created_at) as first_use,
      MAX(created_at) as last_use,
      AVG(LENGTH(snapshot_data)) as avg_snapshot_size,
      COUNT(DISTINCT texture_name) as unique_textures_used
    FROM nfc_snapshots 
    WHERE nfc_index = ?
  `, [nfcIndex], (err, stats) => {
    if (err) {
      console.error('Error en stats NFC:', err);
      return res.status(500).json({ error: 'Error en análisis NFC' });
    }
    
    // Historial reciente de este NFC
    db.all(`
      SELECT 
        timestamp,
        texture_name,
        created_at,
        LENGTH(snapshot_data) as snapshot_size
      FROM nfc_snapshots 
      WHERE nfc_index = ?
      ORDER BY created_at DESC
      LIMIT 20
    `, [nfcIndex], (err, history) => {
      if (err) {
        console.error('Error en history NFC:', err);
        return res.status(500).json({ error: 'Error en historial NFC' });
      }
      
      res.json({
        nfc_index: nfcIndex,
        statistics: stats[0],
        recent_activity: history
      });
    });
  });
});

// 🔟 Endpoint para activar desde query param
app.get('/trigger', (req, res) => {
  const nfcIndex = parseInt(req.query.nfc);
  if (isNaN(nfcIndex) || nfcIndex < 0 || nfcIndex > 3) {
    return res.status(400).send('Parámetro nfc inválido. Usa ?nfc=0 a ?nfc=3');
  }
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'activate', index: nfcIndex }));
    }
  });
  res.send(`Trigger recibido para índice ${nfcIndex}`);
});

// 🆕 1️⃣1️⃣ RUTA DEL DASHBOARD - IMPORTANTE: ANTES del SPA fallback
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(WEB_SRC_DIR, 'dashboard.html'));
});

// App histórica Three.js
app.get('/web', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// 1️⃣2️⃣ SPA fallback - DEBE IR AL FINAL
app.use((req, res) => {
  res.sendFile(path.join(SITE_DIR, 'index.html'));
});

// 1️⃣3️⃣ Puerto
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`RisOSC corriendo en http://localhost:${PORT}`);
  console.log(`  /              sitio principal (dataset + granulador)`);
  console.log(`  /web           instalacion historica Three.js`);
  console.log(`  /dashboard     panel de analiticas`);
  console.log(`  /lib/treslib/  modulos granulares (GrainEngine, SnapToGrains)`);
  console.log(`  /api/nfc-events         historial de snapshots`);
  console.log(`  /api/analytics/overview estadisticas generales`);
});

// Manejo graceful de cierre
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('BD cerrada');
    process.exit(0);
  });
});