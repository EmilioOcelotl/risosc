const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose(); // 👈 AÑADIR

const app = express();

// Middleware para JSON
app.use(express.json());

// Directorios
const DIST_DIR = path.join(__dirname, '../dist');       // build principal
const WEB_SRC_DIR = path.join(__dirname, '../web/src'); // viewers y archivos originales

// 1️⃣ Servir archivos estáticos
app.use(express.static(DIST_DIR));    // app principal
app.use(express.static(WEB_SRC_DIR)); // viewers

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

// 4️⃣ CONEXIÓN A BD (AÑADIR)
const db = new sqlite3.Database('./nfc_snapshots.db', (err) => {
  if (err) {
    console.error('Error abriendo BD:', err.message);
  } else {
    console.log('✅ Conectado a SQLite');
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

// 5️⃣ Endpoint para NFC (MODIFICADO - ahora guarda en BD también)
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

// 6️⃣ NUEVO ENDPOINT PARA SNAPSHOTS
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
        
        console.log(`✅ Snapshot guardado: NFC_${nfc_index} | ${texture_name} | ${snapshot_data.length} bytes`);
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

// 7️⃣ OPCIONAL: Endpoint para consultar historial
app.get('/api/nfc-events', (req, res) => {
  const { limit = 50, nfc_index } = req.query;
  
  let query = `SELECT * FROM nfc_snapshots`;
  let params = [];
  
  if (nfc_index) {
    query += ` WHERE nfc_index = ?`;
    params.push(nfc_index);
  }
  
  query += ` ORDER BY timestamp DESC LIMIT ?`;
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error consultando eventos:', err);
      return res.status(500).json({ error: 'Error en consulta' });
    }
    res.json(rows);
  });
});

// 8️⃣ Endpoint para activar desde query param
app.get('/trigger', (req, res) => {
  const nfcIndex = parseInt(req.query.nfc);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'activate', index: nfcIndex }));
    }
  });
  res.send(`Trigger recibido para índice ${nfcIndex}`);
});

// 9️⃣ SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// 🔟 Puerto
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});

// Manejo graceful de cierre
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('✅ BD cerrada');
    process.exit(0);
  });
});