// Escena, cámara y renderer
// import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xF5F5DC);
document.body.appendChild(renderer.domElement);

let elCanvas = document.getElementById("hydra-canvas");
let vit = new THREE.CanvasTexture(elCanvas);
elCanvas.style.display = 'none';

const hydra = new Hydra({
    canvas: document.getElementById("hydra-canvas"),
  });

  osc([10, -10], -0.5, 1).modulateRepeat(shape(3), 2, 1).color(1, 1, 4).modulateRepeat(src(o0), 1, 1).saturate(2).out(o0); 

//osc().out();

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

camera.position.set(0, 0, 3);
controls.update();

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const width = 4;
const height = 2;
const segments = 150;

const geometry = new THREE.PlaneGeometry(width, height, segments, segments);

const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.05,
    flatShading: false,
    map: vit,
});

const cloth = new THREE.Mesh(geometry, material);
scene.add(cloth);


const timeUniform = { value: 0 };
const positions = geometry.attributes.position;
const originalPositions = positions.array.slice();

function multiWave(x, y, t) {

    const wave1 = Math.sin(x * 4.0 + t * 1.0) * 0.3;
    
    const wave2 = Math.cos(x * 3.5 + y * 2.0 + t * 1.3) * 0.2;
    
    const wave3 = Math.sin(x * 1.0 + y * 1.5 + t * 0.7) * 0.8;
    
    const wave4 = Math.sin(x * 5.2 + y * 3.7 + t * 1.7) * 
                  Math.cos(x * 2.3 + y * 1.9 + t * 0.9) * 0.05;
    
    return wave1 + wave2 * wave3 + wave4;
}


function animate() {
    requestAnimationFrame(animate);
    vit.needsUpdate = true;

    timeUniform.value += 0.01;
    
    const canvas = document.createElement('canvas');
    canvas.width = elCanvas.width;
    canvas.height = elCanvas.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(elCanvas, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const colorInfluence = 1; 
    const smoothingRadius = 0.25;
    
    for (let i = 0; i < positions.count; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;
        
        const x = originalPositions[ix];
        const y = originalPositions[iy];
        
        const u = (x / width + 0.5);
        const v = (y / height + 0.5);
        
        let totalR = 0, totalG = 0, totalB = 0;
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
        
        const intensity = smoothstep(0.2, 0.8, (r * 0.3 + g * 0.6 + b * 0.1));
        
        const waveDisplacement = multiWave(x, y, timeUniform.value);
        
        positions.array[iz] = waveDisplacement + (intensity - 0.5) * colorInfluence;
        
        positions.array[ix] = x + Math.sin(y * 2.0 + timeUniform.value * 1.5) * 0.01;
        positions.array[iy] = y + Math.cos(x * 1.7 + timeUniform.value * 1.2) * 0.01;
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    
    controls.update();
    renderer.render(scene, camera);
}

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

animate();