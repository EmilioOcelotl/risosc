const express = require('express');
const app = express();
const path = require('path');

// Middleware para parsear JSON (necesario para recibir datos de la ESP32)
app.use(express.json());

// Sirve la página web estática (ajusta la ruta según tu estructura)
app.use(express.static(path.join(__dirname, '../web'))); // O usa './public' si está en server/

// Endpoint para recibir datos de la ESP32
app.post('/api/nfc', (req, res) => {
  const nfcData = req.body;
  console.log('Datos NFC recibidos:', nfcData);
  res.status(200).send('Datos recibidos');
});

// Endpoint para verificar que el servidor está vivo
app.get('/ping', (req, res) => {
  res.send('¡Servidor activo!');
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});