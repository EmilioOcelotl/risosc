// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Hydra from 'hydra-synth';
import AudioManager from './audio/AudioManager.js';

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

function initCSSMessageLayer() {
  messageOverlay = document.getElementById('message-overlay');
  nfcAnimation = document.getElementById('nfc-animation');
  cyberpunkMessage = document.getElementById('cyberpunk-message');
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

function showNFC(show) {
  if (show) nfcAnimation.classList.remove('hidden');
  else nfcAnimation.classList.add('hidden');
}

function showMessage(show) {
  if (show) {
    cyberpunkMessage.classList.remove('hidden');
    showNFC(true);
  } else {
    cyberpunkMessage.classList.add('hidden');
    showNFC(false);
  }
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

let currentHydraTexture = null;
let isActive = false;
let lastActiveTime = 0;
let isWebSocketActivation = false;
let activationTimeout = null;

// --- NFC / WebSocket ---
function handleInitialNFC() {
  const params = new URLSearchParams(window.location.search);
  const nfcIndex = parseInt(params.get('nfc'));
  if (!isNaN(nfcIndex) && nfcIndex >= 0 && nfcIndex < hydraTextures.length) {
    lastActiveTime = Date.now();
    hydraTextures[nfcIndex]();
    currentHydraTexture = nfcIndex;
    isActive = true;
    lastActiveTime = Date.now();
    showMessage(false); // Ocultar texto en estado activo
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
    hydraTextures[index]();
    currentHydraTexture = index;
    isActive = true;
    isWebSocketActivation = fromWebSocket;
    lastActiveTime = Date.now();
    showMessage(false); // Ocultar texto en estado activo
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

// --- Sobel Shader Modificado ---
const SobelShader = {
  uniforms: { 
    tDiffuse: { value: vit }, 
    resolution: { value: new THREE.Vector2(1920, 1080) },
    time: { value: 0 } // Añadir tiempo para animación continua
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
      
      // Añadir leve animación a las coordenadas de muestreo
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
      
      // Añadir efecto de parpadeo sutil
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

    // Aplicar distorsión en AMBOS estados
    positions.array[iz] = waveDisplacement + (intensity - 0.5) * colorInfluence;
    positions.array[ix] = x + Math.sin(y * 2.0 + timeUniform.value * 1.5) * 0.01;
    positions.array[iy] = y + Math.cos(x * 1.7 + timeUniform.value * 1.2) * 0.01;
  }

  positions.needsUpdate = true;
  cloth.geometry.computeVertexNormals();
}

// --- Inactivity / Demo ---
let inactivityTimeout = null;
const INACTIVITY_DELAY = 30000;

function resetInactivityTimeout() {
  if (inactivityTimeout) clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(() => {
    if (Date.now() - lastActiveTime >= INACTIVITY_DELAY) {
      isActive = false;
      isWebSocketActivation = false;
      showMessage(true); // Mostrar texto en estado pasivo
      resetCameraPosition();
    }
  }, INACTIVITY_DELAY);
}

// --- Animate ---
function animate() {
  requestAnimationFrame(animate);

  vit.needsUpdate = true;

  // Mesh siempre visible
  if (!scene.children.includes(cloth)) scene.add(cloth);
  if (!scene.children.includes(wireframeCube)) scene.add(wireframeCube);

  // Actualizar distorsión del mesh en AMBOS estados
  timeUniform.value += 0.01;
  updateClothGeometry();
  
  // Actualizar tiempo en el shader Sobel
  clothSobelMaterial.uniforms.time.value = timeUniform.value;

  if (!isActive) {
    // Estado pasivo: Shader Sobel + texto visible + SIN ROTACIÓN
    cloth.material = clothSobelMaterial;
    // cloth.rotation.z NO se modifica - el mesh se detiene
  } else {
    // Estado activo: Textura Hydra + texto oculto + CON ROTACIÓN
    cloth.material = clothMaterial;
    cloth.rotation.z += 0.005; // Rotación solo en estado activo
  }

  controls.update();
  renderer.render(scene, camera);
}

// --- WebSocket ---
const protocol = window.location.protocol === "https:" ? "wss" : "ws";
let socket = new WebSocket(`${protocol}://${window.location.host}`);

socket.addEventListener("message", (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === "activate") {
      lastActiveTime = Date.now();
      audioManager.playSuccess();
      activateTexture(parseInt(data.index), true);
    }
  } catch (e) {
    audioManager.playError();
    console.error("Error processing WebSocket message:", e);
  }
});

socket.addEventListener("close", () => {
  setTimeout(() => {
    socket = new WebSocket(`${protocol}://${window.location.host}`);
  }, 5000);
});

// --- Init ---
function init() {
  initCSSMessageLayer();
  showMessage(true); // Mostrar texto inicial en estado pasivo
  handleInitialNFC();
  document.addEventListener('click', initAudioOnClick);
  document.addEventListener('touchstart', initAudioOnClick);
  animate();
  resetInactivityTimeout();
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
});

init();