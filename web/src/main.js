// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AudioManager, ClothMeshManager, HydraTextureManager, SnapshotCompressor } from 'treslib';
import { loadMosaic, showMosaic } from './mosaic.js';

const audioManager = new AudioManager();
let audioInitialized = false;

function initAudioOnClick() {
  if (audioInitialized) return;
  audioManager.initAudioContext();
  audioInitialized = true;
  console.log('Audio inicializado - Sonidos listos');
}

// --- HTML Elements ---
const rightPanel = document.getElementById("right-panel");
const hydraCanvas = document.getElementById("hydra-canvas");

// CSS messages
let messageOverlay, nfcAnimation, cyberpunkMessage;
let currentPhraseIndex = 0;
let phraseTimeout;
let snapshotPreviewTimeout = null;

let passiveMode = false;
let isActive = false;
let lastActiveTime = 0;
let isWebSocketActivation = false;

// --- Inicialización de módulos ---
let textureManager, clothManager;

function initModules() {
  // Inicializar HydraTextureManager
  textureManager = new HydraTextureManager(hydraCanvas);
  
  // Inicializar ClothMeshManager con parámetros de deformación
  clothManager = new ClothMeshManager(textureManager, {
    width: 4,
    height: 2,
    segments: 200,
    colorInfluence: 0.25,
    smoothingRadius: 0.25
  });
}

function initCSSMessageLayer() {
  messageOverlay = document.getElementById('message-overlay');
  nfcAnimation = document.getElementById('nfc-animation');
  cyberpunkMessage = document.getElementById('cyberpunk-message');
  startPhraseAnimation();
}

function startPhraseAnimation() {
  const phrases = [
    { static: "Inicia", dynamic: "reconociendo la zona roja del lector" },
    { static: "Acércala", dynamic: "a la etiqueta blanca, sin tocarla" },
    { static: "Mantén", dynamic: "una distancia corta entre ambas" },
    { static: "Aguarda", dynamic: "unos segundos… la respuesta llegará" },
    { static: "Escucha", dynamic: "una señal y contempla el cambio" },
    { static: "Descubre", dynamic: "tu registro, un trazo único en pantalla" }
  ];
  
  // Activar modo pasivo
  passiveMode = true;
  isActive = false;
  
  console.log('🔄 Activando modo INACTIVO');
  
  // Mostrar mosaico y ocultar Three.js
  showMosaic(true);
  setThreeJSActive(false);

  // 👈 Asegurar que TODOS los elementos del modo pasivo estén visibles
  const instructions = document.getElementById('instructions');
  const nfcAnimation = document.getElementById('nfc-animation');
  const mainTitle = document.getElementById('main-title');
  const artDescription = document.getElementById('art-description');
  const cyberpunkMessage = document.getElementById('cyberpunk-message');
  
  // Mostrar elementos de UI para modo pasivo
  if (instructions) instructions.classList.remove('hidden');
  if (nfcAnimation) nfcAnimation.classList.remove('hidden');
  if (mainTitle) mainTitle.classList.remove('hidden');
  if (cyberpunkMessage) cyberpunkMessage.classList.remove('hidden');
  if (artDescription) artDescription.classList.add('hidden');
  
  // Ocultar elementos del modo activo
  const logOverlay = document.getElementById('log-overlay');
  const snapshotPreview = document.getElementById('snapshot-preview');
  
  if (logOverlay) logOverlay.classList.remove('active');
  if (snapshotPreview) snapshotPreview.classList.remove('active');

  console.log('✅ Elementos modo inactivo mostrados');

  // Cargar mosaico
  loadMosaic();

  function updatePhrase() {
    if (!passiveMode) {
      console.log('⏹️ Deteniendo animación de frases (modo activo)');
      return;
    }

    const phrase = phrases[currentPhraseIndex];
    const staticText = document.getElementById('static-text');
    const dynamicText = document.getElementById('dynamic-text');
    
    if (staticText && dynamicText) {
      staticText.textContent = phrase.static;
      dynamicText.textContent = phrase.dynamic;
    }

    audioManager.playTransition("reveal");

    currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
    phraseTimeout = setTimeout(updatePhrase, 6000);
  }

  updatePhrase();
}

function exitPassiveMode() {
  passiveMode = false;
  isActive = true;

  // Ocultar mosaico y mostrar Three.js
  showMosaic(false);
  setThreeJSActive(true);

  // Detener animación de frases
  if (phraseTimeout) {
    clearTimeout(phraseTimeout);
    phraseTimeout = null;
  }
}

function setThreeJSActive(active) {
  const threeCanvas = renderer.domElement;
  const clothMesh = clothManager.getMesh();
  
  if (active) {
    threeCanvas.classList.remove('hidden');
    clothManager.setMaterial('standard');
    if (!scene.children.includes(clothMesh)) scene.add(clothMesh);
  } else {
    threeCanvas.classList.add('hidden');
    if (scene.children.includes(clothMesh)) scene.remove(clothMesh);
  }
}

function showNFC(show) {
  if (show) nfcAnimation.classList.remove('hidden');
  else nfcAnimation.classList.add('hidden');
}

function showMessage(show) {
  const artDescription = document.getElementById('art-description');
  
  if (show) {
    cyberpunkMessage.classList.remove('hidden');
    showNFC(true);
    artDescription.classList.add('hidden');
  } else {
    cyberpunkMessage.classList.add('hidden');
    showNFC(false);
    artDescription.classList.remove('hidden');
  }
}

// --- Log System ---
const logOverlay = document.getElementById('log-overlay');
const logEntries = document.getElementById('log-entries');
const maxLogEntries = 5;

function addLogEntry(nfcIndex) {
  const timestamp = new Date().toLocaleTimeString('es-MX', { 
    timeZone: 'America/Mexico_City',
    hour12: false 
  });
  
  setTimeout(() => {
    const compressor = new SnapshotCompressor();
    const compressedHex = compressor.captureHydraFrame(hydraCanvas);
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
      <div class="log-timestamp">[${timestamp}]</div>
      <div class="log-nfc">NFC_${nfcIndex} | ${textureManager.getTextureName(nfcIndex)}</div>
      <div class="log-snapshot-info">
        <span class="data-size">${compressedHex.length / 2}B</span>
        <span class="data-preview">${compressedHex.substring(0, 160)}...</span>
      </div>
    `;
    
    logEntries.appendChild(logEntry);
    
    while (logEntries.children.length > maxLogEntries) {
      logEntries.removeChild(logEntries.firstChild);
    }
    
    // 🔊 DETENER SONIDO DE PROCESAMIENTO AL COMPLETAR
    audioManager.stopProcessing();
    
    showSnapshotPreview(compressedHex);
    saveNFCEventToDatabase(nfcIndex, compressedHex);
    
  }, 100);
}

function showSnapshotPreview(hexData) {
  const previewContainer = document.getElementById('snapshot-preview');
  const compressor = new SnapshotCompressor();
  
  if (snapshotPreviewTimeout) {
    clearTimeout(snapshotPreviewTimeout);
    snapshotPreviewTimeout = null;
  }
  
  previewContainer.innerHTML = '';
  
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 80;
  canvas.style.imageRendering = 'pixelated';
  
  const bytes = compressor.hexToBytes(hexData);
  const pixelData = compressor.decompress2bpp(bytes);
  const imageData = compressor.ditheredToImageData(pixelData);
  
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  
  previewContainer.appendChild(canvas);
  previewContainer.classList.add('active');
  
  snapshotPreviewTimeout = setTimeout(() => {
    previewContainer.classList.remove('active');
  }, INACTIVITY_DELAY);
}

async function saveNFCEventToDatabase(nfcIndex, compressedHex) {
  try {
    await fetch('/api/nfc-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        nfc_index: nfcIndex,
        texture_name: textureManager.getTextureName(nfcIndex),
        snapshot_data: compressedHex
      })
    });
  } catch (error) {
    console.error('Error guardando en BD:', error);
  }
}

function showLog(show) {
  if (show) {
    logOverlay.classList.add('active');
  } else {
    logOverlay.classList.remove('active');
  }
}

// --- NFC / WebSocket ---
function handleInitialNFC() {
  const params = new URLSearchParams(window.location.search);
  const nfcIndex = parseInt(params.get('nfc'));
  if (!isNaN(nfcIndex) && nfcIndex >= 0 && nfcIndex < 4) {
    console.log('Initial NFC detected:', nfcIndex);
    lastActiveTime = Date.now();
    textureManager.setTexture(nfcIndex);
    isActive = true;
    lastActiveTime = Date.now();
    
    // Salir del modo pasivo
    if (passiveMode) exitPassiveMode();
    
    setTimeout(() => {
      showLog(true);
      addLogEntry(nfcIndex);
    }, 200);
    
    showMessage(false);
    notifyServer(nfcIndex);
  }
}

function notifyServer(index) {
  fetch('/api/nfc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index }),
  }).catch(e => console.error('Error notifying server:', e));
}

function activateTexture(index, fromWebSocket = false) {
  if (textureManager.setTexture(index)) {
    console.log('Activating texture:', index);
    
    // Salir del modo pasivo si es necesario
    if (passiveMode) exitPassiveMode();
    
    audioManager.playSuccess();
    
    isActive = true;
    isWebSocketActivation = fromWebSocket;
    lastActiveTime = Date.now();
    
    audioManager.startProcessing();
    
    setTimeout(() => {
      showLog(true);
      addLogEntry(index);
    }, 200);
    
    showMessage(false);
    resetInactivityTimeout();
  } else {
    audioManager.playError();
    console.log('Índice NFC inválido:', index);
  }
}

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, 1920 / 1080, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(1920, 1080);
rightPanel.appendChild(renderer.domElement);

// --- Cube & Wireframe ---
const cubeSize = 3;
const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
const edges = new THREE.EdgesGeometry(cubeGeometry);
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, linewidth: 4 });
const wireframeCube = new THREE.LineSegments(edges, lineMaterial);
scene.add(wireframeCube);

// --- Lights ---
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
directionalLight.position.set(0, 2, 2);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
camera.position.set(0, 0, 4);

const initialCameraPosition = camera.position.clone();
const initialTarget = controls.target.clone();

function resetCameraPosition() {
  camera.position.copy(initialCameraPosition);
  controls.target.copy(initialTarget);
  controls.update();
}

// --- Inactivity / Demo ---
let inactivityTimeout = null;
const INACTIVITY_DELAY = 60000;

function resetInactivityTimeout() {
  if (inactivityTimeout) clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(() => {
    if (Date.now() - lastActiveTime >= INACTIVITY_DELAY) {
      isActive = false;
      isWebSocketActivation = false;
      
      // Volver al modo pasivo
      passiveMode = true;
      startPhraseAnimation();
      
      showLog(false);
      resetCameraPosition();
      
      const previewContainer = document.getElementById('snapshot-preview');
      previewContainer.classList.remove('active');
      if (snapshotPreviewTimeout) {
        clearTimeout(snapshotPreviewTimeout);
        snapshotPreviewTimeout = null;
      }
    }
  }, INACTIVITY_DELAY);
}

// --- Animate ---
function animate() {
  requestAnimationFrame(animate);

  if (isActive) {
    textureManager.update();
    clothManager.update(0.01);
  }

  const clothMesh = clothManager.getMesh();
  if (isActive) {
    if (!scene.children.includes(clothMesh)) scene.add(clothMesh);
    clothManager.setMaterial('standard');
    clothMesh.rotation.z += 0.005;
  } else {
    if (scene.children.includes(clothMesh)) scene.remove(clothMesh);
  }

  controls.update();
  renderer.render(scene, camera);
}

// --- WebSocket ---
let socket;
const protocol = window.location.protocol === "https:" ? "wss" : "ws";

function connectWebSocket() {
  socket = new WebSocket(`${protocol}://${window.location.host}`);

  socket.addEventListener("open", () => {
    console.log("🔗 WebSocket conectado");
  });

  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "activate") {
        lastActiveTime = Date.now();
        activateTexture(parseInt(data.index), true);
      } else if (data.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
      }
    } catch (e) {
      console.error("Error procesando mensaje WebSocket:", e);
      audioManager.playError();
    }
  });

  socket.addEventListener("close", () => {
    console.warn("⚠️ WebSocket cerrado, intentando reconectar en 5s...");
    setTimeout(connectWebSocket, 5000);
  });

  socket.addEventListener("error", (err) => {
    console.error("❌ Error en WebSocket:", err);
    socket.close();
  });
}

function safeSend(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    safeSend({ type: "ping" });
  }
}, 30000);

connectWebSocket();

// --- Init ---
function init() {
  initModules();
  initCSSMessageLayer();
  showMessage(true);
  showLog(false);
  handleInitialNFC();
  document.addEventListener('click', initAudioOnClick);
  document.addEventListener('touchstart', initAudioOnClick);
  animate();
  resetInactivityTimeout();
  
  setInterval(() => {
    if (audioInitialized && !isActive) {
      audioManager.playAtmosphericTexture();
    }
  }, 20000 + Math.random() * 10000);
}

// Event Listeners
document.addEventListener('keydown', (event) => {
  if (!audioInitialized) initAudioOnClick();
  
  if (event.key === '1') audioManager.playSuccess();
  else if (event.key === '2') audioManager.playError();
  else if (event.key === '3') audioManager.startAmbientSound();
  else if (event.key === '0') audioManager.stopAmbientSound();
  else if (event.key === 't') audioManager.playTransition("reveal");
  else if (event.key === 'a') audioManager.playAtmosphericTexture();
  
  if (event.key >= '4' && event.key <= '7') {
    const nfcIndex = parseInt(event.key) - 4;
    activateTexture(nfcIndex);
  }
});

window.addEventListener('beforeunload', () => {
  if (phraseTimeout) clearTimeout(phraseTimeout);
  audioManager.cleanup();
});

init();