const express = require('express');
const app = express();
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// ✅ Middleware necesario para leer JSON en POST
app.use(express.json());

// 1. Servir archivos estáticos desde web/src
app.use(express.static(path.join(__dirname, '../web/src')));

// 2. Crear servidor HTTP
const server = http.createServer(app);

// 3. WebSocket
const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', ws => {
  clients.push(ws);
  console.log('Cliente conectado');

  ws.on('close', () => {
    clients = clients.filter(client => client !== ws);
    console.log('Cliente desconectado');
  });
});

// 4. Endpoint para NFC
app.post('/api/nfc', (req, res) => {
  const { index } = req.body;
  console.log('NFC recibido:', index);

  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'activate', index: index }));
    }
  });

  res.status(200).send('ok');
});

// 5. Endpoint para lanzar viewer desde query param
app.get('/trigger', (req, res) => {
  const nfcIndex = parseInt(req.query.nfc);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'activate', index: nfcIndex }));
    }
  });
  res.send(`Trigger recibido para índice ${nfcIndex}`);
});

// 6. Puerto
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
