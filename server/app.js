const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

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

// 4️⃣ Endpoint para NFC
app.post('/api/nfc', (req, res) => {
  const { index } = req.body;
  console.log('NFC recibido:', index);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'activate', index }));
    }
  });

  res.status(200).send('ok');
});

// 5️⃣ Endpoint para activar desde query param
app.get('/trigger', (req, res) => {
  const nfcIndex = parseInt(req.query.nfc);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'activate', index: nfcIndex }));
    }
  });
  res.send(`Trigger recibido para índice ${nfcIndex}`);
});

// 6️⃣ SPA fallback: cualquier ruta que no exista en dist ni en src
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// 7️⃣ Puerto
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
