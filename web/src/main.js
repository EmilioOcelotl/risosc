// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Hydra from 'hydra-synth';
import AudioManager from './audio/AudioManager.js';
import SnapshotCompressor from './compressor/snapshotCompressor.js';
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
let currentHydraTexture = null;
let isActive = false;
let lastActiveTime = 0;
let isWebSocketActivation = false;
let activationTimeout = null;

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
  if (active) {
    threeCanvas.classList.remove('hidden');
    cloth.material = clothMaterial;
    if (!scene.children.includes(cloth)) scene.add(cloth);
  } else {
    threeCanvas.classList.add('hidden');
    if (scene.children.includes(cloth)) scene.remove(cloth);
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

function getImageDataPreview() {
  try {
    const canvas = hydraCanvas;
    const ctx = canvas.getContext('2d');
    
    const previewWidth = 40;
    const previewHeight = 30;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = previewWidth;
    tempCanvas.height = previewHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(canvas, 0, 0, previewWidth, previewHeight);
    const imageData = tempCtx.getImageData(0, 0, previewWidth, previewHeight);
    const data = imageData.data;
    
    let preview = '';
    let byteCount = 0;
    const maxBytes = 16;
    
    for (let i = 0; i < data.length && byteCount < maxBytes; i += 4) {
      if (byteCount % 4 === 0) preview += '\n    ';
      const r = data[i].toString(16).padStart(2, '0');
      const g = data[i + 1].toString(16).padStart(2, '0');
      const b = data[i + 2].toString(16).padStart(2, '0');
      preview += `0x${r}${g}${b}, `;
      byteCount++;
    }
    
    return `// Hydra Canvas Data (${byteCount} bytes)
const uint32_t frame_data[] = {${preview.slice(0, -2)}\n};`;
  } catch (error) {
    console.error('Error getting image data:', error);
    return `// Error reading canvas data\n// ${error.message}`;
  }
}

function getTextureName(index) {
  const names = [
    "OSC_BLUE_CYAN",
    "OSC_GREEN_PURPLE", 
    "OSC_ORANGE_RED",
    "VORONOI_RED_BLUE"
  ];
  return names[index] || `TEXTURE_${index}`;
}

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
      <div class="log-nfc">NFC_${nfcIndex} | ${getTextureName(nfcIndex)}</div>
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
        texture_name: getTextureName(nfcIndex),
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
    console.log('Log shown');
  } else {
    logOverlay.classList.remove('active');
    console.log('Log hidden');
  }
}

function clearLog() {
  logEntries.innerHTML = '';
}

// --- Hydra Textures ---
const hydraTextures = [
  () => {
    osc(19, 0.1, 0.4)
      .color(0.8 * 8, 0.9 * 4, 1)
      .modulate(noise(3, 0.1).rotate(0.1, 0.02).scale(1.1), 0.1)
      .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
      .invert()
      .saturate(1.1)
      .hue(2)
      .out();
  },
  () => {
    osc(10, 0.08, 0.8)
      .color(1 * 2, 0.8 * 4, 0.9)
      .modulate(noise(4, 0.1).rotate(0.01, 0.02).scale(1.1), 0.1)
      .modulate(src(o0).scale(1.1).rotate(0.01), 0.2)
      .invert()
      .saturate(1.1)
      .out();
  },
  () => {
    osc(19, 0.4, 0.4)
      .color(1.5, 0.9 * 8, 0.8 * 4)
      .modulate(noise(1, 0.1).rotate(0.1, 0.02).scale(1.01), 0.5)
      .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
      .invert()
      .saturate(1.1)
      .out();
  },
  () => {
    osc(10, 0.14, 0.4)
      .color(2, 0.9 * 8, 0.8 * 4)
      .modulate(voronoi(0.8, 0.1).rotate(0.01, 0.02).scale(1.01), 0.3)
      .modulate(src(o0).scale(1.1).rotate(0.1), 0.2)
      .invert()
      .saturate(1.1)
      .out();
  },
];

// --- NFC / WebSocket ---
function handleInitialNFC() {
  const params = new URLSearchParams(window.location.search);
  const nfcIndex = parseInt(params.get('nfc'));
  if (!isNaN(nfcIndex) && nfcIndex >= 0 && nfcIndex < hydraTextures.length) {
    console.log('Initial NFC detected:', nfcIndex);
    lastActiveTime = Date.now();
    hydraTextures[nfcIndex]();
    currentHydraTexture = nfcIndex;
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
  if (index >= 0 && index < hydraTextures.length) {
    console.log('Activating texture:', index);
    
    // Salir del modo pasivo si es necesario
    if (passiveMode) exitPassiveMode();
    
    audioManager.playSuccess();
    
    hydraTextures[index]();
    currentHydraTexture = index;
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

// Hydra setup
const hydra = new Hydra({ canvas: hydraCanvas, autoLoop: true, detectAudio: false });
hydraTextures[0]();
const vit = new THREE.CanvasTexture(hydraCanvas);

// --- Geometry & Cloth ---
const width = 4;
const height = 2;
const segments = 200;
const geometry = new THREE.PlaneGeometry(width, height, segments, segments);

const clothMaterial = new THREE.MeshPhongMaterial({
  color: 0xffffff,
  specular: 0x222222,
  shininess: 30,
  emissive: 0x000000,
  emissiveIntensity: 0,
  map: vit,
  reflectivity: 0.9,
  combine: THREE.MixOperation,
  shading: THREE.SmoothShading
});

const cloth = new THREE.Mesh(geometry, clothMaterial);
cloth.rotation.x = -Math.PI / 4;
cloth.position.z = 0;
cloth.position.y = 0.25;

// --- Sobel Shader ---
const SobelShader = {
  uniforms: { 
    tDiffuse: { value: vit }, 
    resolution: { value: new THREE.Vector2(1920, 1080) },
    time: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { 
      vUv = uv; 
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); 
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    varying vec2 vUv;
    
    void main() {
      float dx = 1.0 / resolution.x;
      float dy = 1.0 / resolution.y;
      
      vec2 animatedUV = vUv + vec2(sin(time * 0.5 + vUv.y * 5.0) * 0.001, cos(time * 0.3 + vUv.x * 5.0) * 0.001);
      
      vec3 tl = texture2D(tDiffuse, animatedUV + vec2(-dx,-dy)).rgb;
      vec3 t  = texture2D(tDiffuse, animatedUV + vec2(0.0,-dy)).rgb;
      vec3 tr = texture2D(tDiffuse, animatedUV + vec2(dx,-dy)).rgb;
      vec3 l  = texture2D(tDiffuse, animatedUV + vec2(-dx,0.0)).rgb;
      vec3 r  = texture2D(tDiffuse, animatedUV + vec2(dx,0.0)).rgb;
      vec3 bl = texture2D(tDiffuse, animatedUV + vec2(-dx,dy)).rgb;
      vec3 b  = texture2D(tDiffuse, animatedUV + vec2(0.0,dy)).rgb;
      vec3 br = texture2D(tDiffuse, animatedUV + vec2(dx,dy)).rgb;
      
      vec3 hor = -tl - 2.0*l - bl + tr + 2.0*r + br;
      vec3 ver = -tl - 2.0*t - tr + bl + 2.0*b + br;
      float edge = length(hor + ver);
      
      float pulse = 0.8 + 0.2 * sin(time * 2.0);
      vec3 color = vec3(edge * pulse);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const clothSobelMaterial = new THREE.ShaderMaterial({
  uniforms: SobelShader.uniforms,
  vertexShader: SobelShader.vertexShader,
  fragmentShader: SobelShader.fragmentShader
});

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

const timeUniform = { value: 0 };
const originalPositions = geometry.attributes.position.array.slice();

function resetCameraPosition() {
  camera.position.copy(initialCameraPosition);
  controls.target.copy(initialTarget);
  controls.update();
}

function multiWave(x, y, t) {
  const wave1 = Math.sin(x * 4.0 + t * 1.0) * 0.3;
  const wave2 = Math.cos(x * 3.5 + y * 2.0 + t * 1.3) * 0.2;
  const wave3 = Math.sin(x * 1.0 + y * 1.5 + t * 0.7) * 0.8;
  const wave4 = Math.sin(x * 5.2 + y * 3.7 + t * 1.7) * Math.cos(x * 2.3 + y * 1.9 + t * 0.9) * 0.05;
  return wave1 + wave2 * wave3 + wave4;
}

function smoothstep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function updateClothGeometry() {
  const positions = cloth.geometry.attributes.position;
  const canvas = document.createElement("canvas");
  canvas.width = hydraCanvas.width;
  canvas.height = hydraCanvas.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(hydraCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const colorInfluence = 0.25;
  const smoothingRadius = 0.25;

  for (let i = 0; i < positions.count; i++) {
    const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
    const x = originalPositions[ix], y = originalPositions[iy];
    const u = x / width + 0.5, v = y / height + 0.5;
    let totalR = 0, totalG = 0, totalB = 0, sampleCount = 0;

    for (let dx = -smoothingRadius; dx <= smoothingRadius; dx++) {
      for (let dy = -smoothingRadius; dy <= smoothingRadius; dy++) {
        const px = Math.floor(u * (canvas.width - 1)) + dx;
        const py = Math.floor((1 - v) * (canvas.height - 1)) + dy;
        if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
          const pixelIndex = (py * canvas.width + px) * 4;
          totalR += data[pixelIndex];
          totalG += data[pixelIndex + 1];
          totalB += data[pixelIndex + 2];
          sampleCount++;
        }
      }
    }

    const r = totalR / sampleCount / 255;
    const g = totalG / sampleCount / 255;
    const b = totalB / sampleCount / 255;
    const intensity = smoothstep(0.2, 0.8, r * 0.3 + g * 0.6 + b * 0.1);
    const waveDisplacement = multiWave(x, y, timeUniform.value);

    positions.array[iz] = waveDisplacement + (intensity - 0.5) * colorInfluence;
    positions.array[ix] = x + Math.sin(y * 2.0 + timeUniform.value * 1.5) * 0.01;
    positions.array[iy] = y + Math.cos(x * 1.7 + timeUniform.value * 1.2) * 0.01;
  }

  positions.needsUpdate = true;
  cloth.geometry.computeVertexNormals();
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
    vit.needsUpdate = true;
    timeUniform.value += 0.01;
    updateClothGeometry();
  }

  if (isActive) {
    if (!scene.children.includes(cloth)) scene.add(cloth);
    cloth.material = clothMaterial;
    cloth.rotation.z += 0.005;
  } else {
    if (scene.children.includes(cloth)) scene.remove(cloth);
  }

  if (!scene.children.includes(wireframeCube)) scene.add(wireframeCube);

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

window.addEventListener('beforeunload', () => {
  if (phraseTimeout) clearTimeout(phraseTimeout);
});

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