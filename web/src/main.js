// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Hydra from 'hydra-synth';
import AudioManager from './audio/AudioManager.js';

const audioManager = new AudioManager();

let audioInitialized = false;

function initAudioOnClick() {
  if (audioInitialized) return;
  
  // Inicializar audio con el primer click
  audioManager.initAudioContext();
  audioInitialized = true;
  
  console.log('Audio inicializado - Sonidos listos');
}

const rightPanel = document.getElementById("right-panel");
const hydraCanvas = document.getElementById("hydra-canvas");

// Variables para controlar la capa CSS
let messageOverlay, nfcAnimation, cyberpunkMessage;
let currentPhraseIndex = 0;
let phraseTimeout;

// Inicializar elementos CSS
function initCSSMessageLayer() {
  messageOverlay = document.getElementById('message-overlay');
  nfcAnimation = document.getElementById('nfc-animation');
  cyberpunkMessage = document.getElementById('cyberpunk-message');
  
  // Iniciar animación de frases alternantes
  startPhraseAnimation();
}

function startPhraseAnimation() {
  const phrases = [
    { static: "ACERCA", dynamic: "El dispositivo NFC" },
    { static: "ESPERA", dynamic: "Una confirmación" },
    { static: "PERCIBE", dynamic: "El resultado" },
    { static: "RETIRA", dynamic: "Con un registro exitoso" }
  ];
  
  function updatePhrase() {
    const phrase = phrases[currentPhraseIndex];
    document.getElementById('static-text').textContent = phrase.static;
    document.getElementById('dynamic-text').textContent = phrase.dynamic;
    
    currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
    phraseTimeout = setTimeout(updatePhrase, 4000);
  }
  
  updatePhrase();
}

// Función para mostrar/ocultar NFC
function showNFC(show) {
  if (show) {
    nfcAnimation.classList.remove('hidden');
  } else {
    nfcAnimation.classList.add('hidden');
  }
}

// Función para mostrar/ocultar mensaje completo
function showMessage(show) {
  if (show) {
    cyberpunkMessage.classList.remove('hidden');
    showNFC(true);
  } else {
    cyberpunkMessage.classList.add('hidden');
    showNFC(false);
  }
}

function activateTexture(index, fromWebSocket = false) {
  // Detener el modo demo si está activo
  if (demoInterval) {
    stopDemoMode();
  }

  if (index >= 0 && index < hydraTextures.length) {
    // Activar la textura correspondiente
    hydraTextures[index]();
    currentHydraTexture = index;
    isActive = true;
    isWebSocketActivation = fromWebSocket;
    lastActiveTime = Date.now();

    // Ocultar el mensaje cuando hay textura activa
    showMessage(false);

    // Reiniciar el timeout de inactividad
    resetInactivityTimeout();
  } else {
    // ✅ SONIDO DE ERROR si el índice es inválido
    audioManager.playError();
    console.log('Índice NFC inválido:', index);
  }
}

let inactivityTimeout = null;
let demoInterval = null;
const INACTIVITY_DELAY = 30000; // 30 segundos

function resetInactivityTimeout() {
  // Limpiar cualquier timeout existente
  if (inactivityTimeout) clearTimeout(inactivityTimeout);
  
  // Configurar nuevo timeout
  inactivityTimeout = setTimeout(() => {
    // Solo activar demo mode si no hay actividad reciente
    if (Date.now() - lastActiveTime >= INACTIVITY_DELAY) {
      isActive = false;
      isWebSocketActivation = false;
      resetCameraPosition();
      startDemoMode();
    }
  }, INACTIVITY_DELAY);
}

function startDemoMode() {
  if (demoInterval || Date.now() - lastActiveTime < INACTIVITY_DELAY) {
    return;
  }

  const TEXT_PHASE_DURATION = 10000;
  const MESH_PHASE_DURATION = 5000;
  const INITIAL_DELAY = 3000;
  
  let demoIndex = 0;
  let showInstructions = true;

  // Al iniciar, mostrar instrucciones
  showMessage(true);

  setTimeout(() => {
    demoInterval = setInterval(() => {
      if (showInstructions) {
        // Fase de instrucciones (texto)
        showMessage(true);
        isActive = false;
      } else {
        // Fase de mesh
        hydraTextures[demoIndex]();
        currentHydraTexture = demoIndex;
        isActive = true;
        lastActiveTime = Date.now();

        showMessage(false);
        demoIndex = (demoIndex + 1) % hydraTextures.length;
      }

      showInstructions = !showInstructions;
    }, showInstructions ? TEXT_PHASE_DURATION : MESH_PHASE_DURATION);
    
    if (!showInstructions) {
      const immediateChange = () => {
        hydraTextures[demoIndex]();
        currentHydraTexture = demoIndex;
        isActive = true;
        lastActiveTime = Date.now();
        showMessage(false);
      };
      immediateChange();
    }
  }, INITIAL_DELAY);
}

function stopDemoMode() {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
}

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

let currentHydraTexture = null;
let isActive = false;
let lastActiveTime = 0;
let isWebSocketActivation = false;
let activationTimeout = null;

function handleInitialNFC() {
  const params = new URLSearchParams(window.location.search);
  const nfcIndex = parseInt(params.get('nfc'));
  if (!isNaN(nfcIndex) && nfcIndex >= 0 && nfcIndex < hydraTextures.length) {
    lastActiveTime = Date.now(); // Añadir esta línea
    hydraTextures[nfcIndex]();
    currentHydraTexture = nfcIndex;
    isActive = true;
    lastActiveTime = Date.now();
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

// --- THREE.JS SETUP ---

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, 1280 / 1080, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setSize(1280, 1080);
rightPanel.appendChild(renderer.domElement);

// Hydra setup
const hydra = new Hydra({
  canvas: hydraCanvas,
  autoLoop: true,
  detectAudio: false,
});

// Inicializamos con la primera textura Hydra
hydraTextures[0]();
const vit = new THREE.CanvasTexture(hydraCanvas);

// --- GEOMETRY SETUP ---

const width = 4;
const height = 2;
const segments = 200;
const geometry = new THREE.PlaneGeometry(width, height, segments, segments);

const material = new THREE.MeshPhongMaterial({
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

const cloth = new THREE.Mesh(geometry, material);
cloth.rotation.x = -Math.PI / 4;
cloth.rotation.z += 0.01;
cloth.position.z = 0;

const cubeSize = 3;
const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

const edges = new THREE.EdgesGeometry(cubeGeometry);
const lineMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.4,
  linewidth: 4,
});
const wireframeCube = new THREE.LineSegments(edges, lineMaterial);
scene.add(wireframeCube);

const vertexSphereGeometry = new THREE.SphereGeometry(0.02, 12, 12);
const vertexSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

const cubeVertices = cubeGeometry.attributes.position;
for (let i = 0; i < cubeVertices.count; i++) {
  const vertex = new THREE.Vector3().fromBufferAttribute(cubeVertices, i);
  const sphere = new THREE.Mesh(vertexSphereGeometry, vertexSphereMaterial);
  sphere.position.copy(vertex);
  wireframeCube.add(sphere);
}

const circleRadius = cubeSize / 2;
const circleSegments = 64;
const circleGeometry = new THREE.CircleGeometry(circleRadius, circleSegments);
const circleMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0,
  wireframe: false,
});

const circle = new THREE.Mesh(circleGeometry, circleMaterial);
circle.rotation.x = Math.PI / 2;
circle.position.y = -cubeSize / 2;
wireframeCube.add(circle);

const circleEdges = new THREE.EdgesGeometry(circleGeometry);
const circleLineMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  linewidth: 0.01,
  transparent: true,
  opacity: 0.4,
});
const circleLine = new THREE.LineSegments(circleEdges, circleLineMaterial);
circleLine.rotation.x = Math.PI / 2;
circleLine.position.y = -cubeSize / 2 + 0.01;
wireframeCube.add(circleLine);

const smallSphereGeometry = new THREE.SphereGeometry(0.02, 16, 16);
const smallSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const orbitingSphere = new THREE.Mesh(smallSphereGeometry, smallSphereMaterial);
wireframeCube.add(orbitingSphere);

let orbitAngle = 0;
const orbitSpeed = 0.02;
const orbitHeight = -cubeSize / 2 + 0.02;

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
  const wave4 =
    Math.sin(x * 5.2 + y * 3.7 + t * 1.7) *
    Math.cos(x * 2.3 + y * 1.9 + t * 0.9) *
    0.05;
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
    const ix = i * 3;
    const iy = i * 3 + 1;
    const iz = i * 3 + 2;

    const x = originalPositions[ix];
    const y = originalPositions[iy];

    const u = x / width + 0.5;
    const v = y / height + 0.5;

    let totalR = 0,
      totalG = 0,
      totalB = 0;
    let sampleCount = 0;

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
    positions.array[ix] =
      x + Math.sin(y * 2.0 + timeUniform.value * 1.5) * 0.01;
    positions.array[iy] =
      y + Math.cos(x * 1.7 + timeUniform.value * 1.2) * 0.01;
  }

  positions.needsUpdate = true;
  cloth.geometry.computeVertexNormals();
}

function animate() {
  requestAnimationFrame(animate);

  if (currentHydraTexture !== null) {
    vit.needsUpdate = true;
  }

  orbitAngle += orbitSpeed;
  orbitingSphere.position.x = Math.cos(orbitAngle) * circleRadius;
  orbitingSphere.position.z = Math.sin(orbitAngle) * circleRadius;
  orbitingSphere.position.y = orbitHeight;

  if (isActive) {
    if (!scene.children.includes(cloth)) scene.add(cloth);
    if (!scene.children.includes(wireframeCube)) scene.add(wireframeCube);

    timeUniform.value += 0.01;
    updateClothGeometry();
    cloth.rotation.z += 0.01;

    // Los mensajes se controlan directamente en activateTexture y startDemoMode
  } else {
    if (scene.children.includes(cloth)) scene.remove(cloth);
    if (scene.children.includes(wireframeCube)) scene.remove(wireframeCube);

    // Los mensajes se controlan directamente en activateTexture y startDemoMode
  }

  controls.update();
  renderer.render(scene, camera);
}

const protocol = window.location.protocol === "https:" ? "wss" : "ws";
let socket = new WebSocket(`${protocol}://${window.location.host}`);

// MODIFICAR el event listener del WebSocket:
socket.addEventListener("message", (event) => {
  try {
    const data = JSON.parse(event.data);

    if (data.type === "activate") {
      lastActiveTime = Date.now();

      // ✅ SONIDO DE ÉXITO
      audioManager.playSuccess();

      activateTexture(parseInt(data.index), true);

      const textureIndex = parseInt(data.index);
      if (textureIndex >= 0 && textureIndex < hydraTextures.length) {
        hydraTextures[textureIndex]();
        currentHydraTexture = textureIndex;
        isActive = true;
        isWebSocketActivation = true;
        lastActiveTime = Date.now();

        if (activationTimeout) clearTimeout(activationTimeout);
        activationTimeout = setTimeout(() => {
          isActive = false;
          isWebSocketActivation = false;
          resetCameraPosition();
        }, 30000);
      }
    }
  } catch (e) {
    // ✅ SONIDO DE ERROR
    audioManager.playError();
    console.error("Error processing WebSocket message:", e);
  }
});

socket.addEventListener("close", () => {
  setTimeout(() => {
    socket = new WebSocket(`${protocol}://${window.location.host}`);
  }, 5000);
});

function init() {
  // Inicializar capa de mensajes CSS
  initCSSMessageLayer();
  
  // Mostrar mensaje inicial
  showMessage(true);

  handleInitialNFC();

  // ✅ INICIALIZAR AUDIO CON CLICKS
  document.addEventListener('click', initAudioOnClick);
  
  // También con touch para dispositivos móviles
  document.addEventListener('touchstart', initAudioOnClick);

  animate();
  resetInactivityTimeout();
}

// Limpiar timeout al cerrar
window.addEventListener('beforeunload', () => {
  if (phraseTimeout) clearTimeout(phraseTimeout);
});

document.addEventListener('keydown', (event) => {
  if (!audioInitialized) {
    initAudioOnClick();
  }
  
  // Probar sonidos con teclas
  if (event.key === '1') {
    audioManager.playSuccess();
    console.log('Probando sonido de éxito');
  } else if (event.key === '2') {
    audioManager.playError(); 
    console.log('Probando sonido de error');
  } else if (event.key === '3') {
    audioManager.startAmbientSound();
    console.log('Iniciando sonido ambiental');
  } else if (event.key === '0') {
    audioManager.stopAmbientSound();
    console.log('Deteniendo sonido ambiental');
  }
});

init();