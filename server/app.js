const express = require('express');
const app = express();
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

app.use(express.json());
app.use(express.static(path.join(__dirname, '../web')));

const server = http.createServer(app);
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

app.post('/api/nfc', (req, res) => {
  const { nfcIndex } = req.body;
  console.log('NFC recibido:', nfcIndex);

  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'activate', index: nfcIndex }));
    }
  });

  res.status(200).send('ok');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
app.get('/trigger', (req, res) => {
  const nfcIndex = parseInt(req.query.nfc);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'activate', index: nfcIndex }));
    }
  });
  res.send(`Trigger recibido para índice ${nfcIndex}`);
});