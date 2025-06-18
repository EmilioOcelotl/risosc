// Configuración inicial
const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');
const hydraCanvas = document.getElementById('hydra-canvas');

// Añade estas variables al inicio
let composer;
let bloomPass;
let renderScene;
let bloomParams = {
    exposure: 1,
    bloomStrength: 1.5,  // Intensidad del glow (0.5 a 2.0)
    bloomThreshold: 0,   // Luminosidad mínima para aplicar glow (0 a 1)
    bloomRadius: 0.5     // Suavidad del glow (0 a 1)
};

// Ajustar rectángulos
function adjustRectangles() {
    const rectangles = document.querySelectorAll('.rectangle');
    const panelHeight = leftPanel.clientHeight;
    const gap = 30;
    const padding = 30;
    
    const availableHeight = panelHeight - (2 * padding) - (3 * gap);
    const rectHeight = availableHeight / 4;
    const rectWidth = (rectHeight * 3) / 2;
    
    rectangles.forEach(rect => {
        rect.style.width = `${rectWidth}px`;
        rect.style.height = `${rectHeight}px`;
    });
}

// Three.js Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, 1280 / 1080, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance"
});
renderer.setSize(1280, 1080);
rightPanel.appendChild(renderer.domElement);

// Hydra setup
const hydra = new Hydra({
    canvas: hydraCanvas,
    autoLoop: true
});
osc(10, 0.04, 0.6)
    .color(0.9*2, 0.8*4, 1.5)
    .modulate(noise(0.1, 0.2).rotate(0.1, 0.2).scale(1.01), 0.2)
    .modulate(src(o0).scale(1.1).rotate(0.1), 0.2)
    .invert()
    .saturate(1.1)
    .out();

// Textura de Hydra
const vit = new THREE.CanvasTexture(hydraCanvas);

// Mensaje Cyberpunk en 3D
function createCyberpunkMessage() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Fondo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Texto
    ctx.font = 'Bold 80px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Efecto de texto neón
    for(let i = 0; i < 5; i++) {
        ctx.shadowBlur = 20 - i*3;
        ctx.shadowColor = i % 2 === 0 ? '#0ff' : '#f0f';
        ctx.fillStyle = i === 4 ? '#fff' : 'rgba(0, 255, 255, 0.3)';
        ctx.fillText('HOVER TO ACTIVATE', canvas.width/2, canvas.height/2);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 1.0
    });
    
    const geometry = new THREE.PlaneGeometry(3, 1.5);
    const messageMesh = new THREE.Mesh(geometry, material);
    messageMesh.position.z = 0.5;
    messageMesh.position.y = 0;

    return messageMesh;
}

const messageMesh = createCyberpunkMessage();
scene.add(messageMesh);

// Elementos de la escena
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
//cloth.position.y = 0.25;
cloth.position.z = 0;

// Luces
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
directionalLight.position.set(0, 2, 2);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Controles
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
camera.position.set(0, 0, 4);

// Animación
const timeUniform = { value: 0 };
const originalPositions = geometry.attributes.position.array.slice();

function multiWave(x, y, t) {
    const wave1 = Math.sin(x * 4.0 + t * 1.0) * 0.3;
    const wave2 = Math.cos(x * 3.5 + y * 2.0 + t * 1.3) * 0.2;
    const wave3 = Math.sin(x * 1.0 + y * 1.5 + t * 0.7) * 0.8;
    const wave4 = Math.sin(x * 5.2 + y * 3.7 + t * 1.7) * 
                 Math.cos(x * 2.3 + y * 1.9 + t * 0.9) * 0.05;
    return wave1 + wave2 * wave3 + wave4;
}

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

function updateClothGeometry() {
    const positions = cloth.geometry.attributes.position;
    const canvas = document.createElement('canvas');
    canvas.width = hydraCanvas.width;
    canvas.height = hydraCanvas.height;
    const ctx = canvas.getContext('2d');
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
    cloth.geometry.computeVertexNormals();
}


function animate() {
    requestAnimationFrame(animate);
    
    vit.needsUpdate = isActive;
    
    if (isActive) {
        // Añadir el mesh si no está en la escena
        if (!scene.children.includes(cloth)) {
            scene.add(cloth);
            vit.needsUpdate = true;
        }
        
        timeUniform.value += 0.01;
        updateClothGeometry();
        
        // Ocultar mensaje gradualmente
        messageMesh.material.opacity = Math.max(messageMesh.material.opacity - 0.1, 0);
    } else {
        // Remover el mesh si está en la escena
        if (scene.children.includes(cloth)) {
            scene.remove(cloth);
        }
        
        // Mostrar mensaje gradualmente
        messageMesh.material.opacity = Math.min(messageMesh.material.opacity + 0.1, 1);
    }
    
    controls.update();
    renderer.render(scene, camera);
}

// Event listeners
function setupInteractivity() {
    document.querySelectorAll('.rectangle').forEach(rect => {
        rect.addEventListener('mouseenter', () => {
            isActive = true;
            lastActiveTime = Date.now();
        });
        
        rect.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (Date.now() - lastActiveTime > 100) {
                    isActive = false;
                }
            }, 100);
        });
    });
}

// Variables de estado
let isActive = false;
let lastActiveTime = 0;

// Inicialización
function init() {
    adjustRectangles();
    setupInteractivity();
    animate();
}

// Manejo de redimensionamiento
window.addEventListener('resize', () => {
    adjustRectangles();
    camera.aspect = 1280 / 1080;
    camera.updateProjectionMatrix();
    renderer.setSize(1280, 1080);
});


// Iniciar
init();