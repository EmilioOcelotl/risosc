// DOM Elements
const hydraCanvas = document.getElementById('hydra-canvas');
const container = document.getElementById('container');
const exportBtn = document.getElementById('export-btn');
const textureSelect = document.getElementById('texture-select');
const status = document.getElementById('status');

// Three.js Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
directionalLight.position.set(2, 2, 2);
scene.add(directionalLight);
scene.add(new THREE.AmbientLight(0x404040));

// Globals
const width = 4;
const height = 2;
const segments = 50;
let currentMesh;
let originalPositions;

// Texture loading
const textureLoader = new THREE.TextureLoader();
let displacementTexture = null;
let displacementImageData = null;
let displacementReady = false;

textureLoader.load('tex22.png', (texture) => {
  displacementTexture = texture;
  displacementTexture.encoding = THREE.sRGBEncoding;
  displacementTexture.flipY = false;

  const image = texture.image;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  displacementImageData = imageData.data;

  displacementReady = true;
  console.log('Textura cargada y lista para deformación.');

  init();
});

// Mesh creation
function createMesh() {
  const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
  originalPositions = Float32Array.from(geometry.attributes.position.array);

  const material = new THREE.MeshStandardMaterial({
    map: displacementTexture,
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.set(Math.PI/2, 0, 0);

  return mesh;
}

function multiWave(x, y, t) {
  const wave1 = Math.sin(x * 4.0 + t * 1.0) * 0.3;
  const wave2 = Math.cos(x * 3.5 + y * 2.0 + t * 1.3) * 0.2;
  const wave3 = Math.sin(x * 1.0 + y * 1.5 + t * 0.7) * 0.8;
  const wave4 = Math.sin(x * 5.2 + y * 3.7 + t * 1.7) * Math.cos(x * 2.3 + y * 1.9 + t * 0.9) * 0.05;
  return wave1 + wave2 * wave3 + wave4;
}

// Geometry deformation
function updateMeshGeometry(mesh) {
  if (!displacementReady) return;

  const geometry = mesh.geometry;
  const posAttr = geometry.attributes.position;

  const imgWidth = displacementTexture.image.width;
  const imgHeight = displacementTexture.image.height;
  const t = 0.0; // Tiempo estático para snapshot

  for (let i = 0; i < posAttr.count; i++) {
    const ix = i * 3;
    const iy = i * 3 + 1;
    const iz = i * 3 + 2;

    const x = originalPositions[ix];
    const y = originalPositions[iy];

    const u = Math.floor((x / width + 0.5) * imgWidth);
    const v = Math.floor((1.0 - (y / height + 0.5)) * imgHeight);
    const px = Math.max(0, Math.min(imgWidth - 1, u));
    const py = Math.max(0, Math.min(imgHeight - 1, v));
    const idx = (py * imgWidth + px) * 4;

    const r = displacementImageData[idx] / 255;
    const g = displacementImageData[idx + 1] / 255;
    const b = displacementImageData[idx + 2] / 255;
    const intensity = (r + g + b) / 3;

    const waveZ = multiWave(x, y, t);
    posAttr.array[iz] = intensity * 0.5 + waveZ * 1;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}

// GLB Export
function exportGLB(mesh) {
  return new Promise((resolve) => {
    const exportScene = new THREE.Scene();
    const meshClone = mesh.clone();
    meshClone.geometry = mesh.geometry.clone();
    meshClone.material = mesh.material.clone();

    const textureClone = mesh.material.map.clone();
    textureClone.encoding = THREE.sRGBEncoding;
    textureClone.flipY = false;
    textureClone.needsUpdate = true;

    meshClone.material.map = textureClone;
    meshClone.material.needsUpdate = true;

    exportScene.add(meshClone);
    exportScene.add(new THREE.AmbientLight(0xffffff, 1));

    const exporter = new THREE.GLTFExporter();
    exporter.parse(
      exportScene,
      (result) => {
        if (!(result instanceof ArrayBuffer)) {
          console.error('Exportación fallida:', result);
          status.textContent = 'Error en exportación';
          return;
        }

        const blob = new Blob([result], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mesh-texturizado.glb';
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      },
      { binary: true }
    );
  });
}

function init() {
  currentMesh = createMesh();
  updateMeshGeometry(currentMesh);
  scene.add(currentMesh);
  renderer.render(scene, camera);
}

exportBtn.addEventListener('click', async () => {
  exportBtn.disabled = true;
  status.textContent = 'Exportando...';
  await exportGLB(currentMesh);
  status.textContent = 'Exportación completa';
  exportBtn.disabled = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
