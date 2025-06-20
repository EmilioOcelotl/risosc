const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');
const hydraCanvas = document.getElementById('hydra-canvas');

/*
let composer;
let bloomPass;
let renderScene;
let bloomParams = {
    exposure: 1,
    bloomStrength: 0.1,
    bloomThreshold: 0,
    bloomRadius: 0.1
};
*/

// Definimos laconsts 4 texturas de Hydra que queremos usar
const hydraTextures = [
    () => {
        osc(10, 0.04, 0.6)
            .color(0.9 * 2, 0.8 * 4, 1.5)
            .modulate(noise(0.1, 0.2).rotate(0.1, 0.2).scale(1.01), 0.2)
            .modulate(src(o0).scale(1.1).rotate(0.1), 0.2)
            .invert()
            .saturate(1.1)
            .out();
    },
    () => {
       osc(15, 0.1, 0.8)
        .color(0.8*4, 0.9*2, 2)
        .modulate(noise(3, 0.1).rotate(0.1, 0.02).scale(1.1),0.1)
        .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
        .invert()
        .saturate(1.1)
        .out()
    },
    () => {
          osc(19, 0.4, 0.4)
            .color( 1.5, 0.9*8,0.8*4)
            .modulate(noise(1, 0.1).rotate(0.1, 0.02).scale(1.01),0.5)
            .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
            .invert()
            .saturate(1.1)
            .out()
    },
    () => {
          osc(12, 0.4, 0.4)
            .color(1, 0.8*8, 0.9*4)
            .modulate(noise(1, 0.1).rotate(0.1, 0.02).scale(1.01),0.5)
            .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
            .invert()
            .saturate(1.1)
            .out()
    }
];

let currentHydraTexture = null;

function adjustRectangles() {
    const rectangles = document.querySelectorAll('.rectangle');
    const panelHeight = leftPanel.clientHeight;
    const gap = 30;
    const padding = 30;

    const availableHeight = panelHeight - (2 * padding) - (3 * gap);
    const rectHeight = availableHeight / 4;
    const rectWidth = (rectHeight * 3) / 2;

    rectangles.forEach((rect, index) => {
        rect.style.width = `${rectWidth}px`;
        rect.style.height = `${rectHeight}px`;
        rect.dataset.textureIndex = index; // Asignamos un índice a cada rectángulo
    });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, 1280 / 1080, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(1280, 1080);
rightPanel.appendChild(renderer.domElement);

const hydra = new Hydra({
    canvas: hydraCanvas,
    autoLoop: true,
    detectAudio: false
});

// Inicializamos con la primera textura
hydraTextures[0]();
const vit = new THREE.CanvasTexture(hydraCanvas);


async function createCyberpunkMessage() {
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 80px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < 5; i++) {
        ctx.shadowBlur = 2 - i * 1;
        ctx.shadowColor = i % 2 === 0 ? '#0ff' : '#f0f';
        ctx.fillStyle = i === 4 ? '#fff' : 'rgba(0, 255, 255, 0.3)';
        ctx.fillText('HOVER TO ACTIVATE', canvas.width / 2, canvas.height / 2);
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

let messageMesh;
createCyberpunkMessage().then(mesh => {
    messageMesh = mesh;
    scene.add(messageMesh);
});

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

/* >>>  BLOQUE DEL CUBO MODIFICADO <<< */
const cubeSize = 3;
const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

const edges = new THREE.EdgesGeometry(cubeGeometry);
const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    transparent: true,
    opacity: 0.2,
    linewidth: 0.01
});
const wireframeCube = new THREE.LineSegments(edges, lineMaterial);
scene.add(wireframeCube);

const vertexSphereGeometry = new THREE.SphereGeometry(0.01, 12, 12);
const vertexSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

const cubeVertices = cubeGeometry.attributes.position;
for (let i = 0; i < cubeVertices.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(cubeVertices, i);
    const sphere = new THREE.Mesh(vertexSphereGeometry, vertexSphereMaterial);
    sphere.position.copy(vertex);
    wireframeCube.add(sphere);
}
/* >>> FIN BLOQUE DEL CUBO MODIFICADO <<< */

/* >>> CÍRCULO EN LA CARA INFERIOR DEL CUBO <<< */
const circleRadius = cubeSize / 2;
const circleSegments = 64;

// Crear el círculo en la cara inferior (y = -cubeSize/2)
const circleGeometry = new THREE.CircleGeometry(circleRadius, circleSegments);
const circleMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0, 
    wireframe: false
});

const circle = new THREE.Mesh(circleGeometry, circleMaterial);
circle.rotation.x = Math.PI / 2; // Rotar para que quede horizontal
circle.position.y = -cubeSize/2; // Posicionar en la cara inferior
wireframeCube.add(circle);

// Línea del borde del círculo (stroke)
const circleEdges = new THREE.EdgesGeometry(circleGeometry);
const circleLineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 0.01,
    transparent: true,
    opacity: 0.2
});
const circleLine = new THREE.LineSegments(circleEdges, circleLineMaterial);
circleLine.rotation.x = Math.PI / 2;
circleLine.position.y = -cubeSize/2 + 0.01; // Ligeramente por encima para evitar z-fighting
wireframeCube.add(circleLine);

/* >>> ESFERA ORBITANTE MODIFICADA (BLANCA) <<< */
const smallSphereGeometry = new THREE.SphereGeometry(0.01, 16, 16);
const smallSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff});
const orbitingSphere = new THREE.Mesh(smallSphereGeometry, smallSphereMaterial);
wireframeCube.add(orbitingSphere);

// Variable para controlar la animación de la esfera
let orbitAngle = 0;
const orbitSpeed = 0.02;
const orbitHeight = -cubeSize/2 + 0.02; // Misma altura que el círculo


// Luces 
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
directionalLight.position.set(0, 2, 2);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
camera.position.set(0, 0, 4);

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

    // Actualizamos la textura solo si hay una activa
    if (currentHydraTexture !== null) {
        vit.needsUpdate = true;
    }

    // Animación de la esfera que gira alrededor del círculo
    orbitAngle += orbitSpeed;
    orbitingSphere.position.x = Math.cos(orbitAngle) * circleRadius;
    orbitingSphere.position.z = Math.sin(orbitAngle) * circleRadius;
    orbitingSphere.position.y = orbitHeight;


    if (isActive) {
        if (!scene.children.includes(cloth)) {
            scene.add(cloth);
        }
        if (!scene.children.includes(wireframeCube)) {
            scene.add(wireframeCube);
        }
       

        timeUniform.value += 0.01;
        updateClothGeometry();
        cloth.rotation.z += 0.01;

        if (messageMesh) {
            messageMesh.material.opacity = Math.max(messageMesh.material.opacity - 0.1, 0);
        }
    } else {
        if (scene.children.includes(cloth)) {
            scene.remove(cloth);
        }
        if (scene.children.includes(wireframeCube)) {
            scene.remove(wireframeCube);
        } 


        if (messageMesh) {
            messageMesh.material.opacity = Math.min(messageMesh.material.opacity + 0.1, 1);
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

function setupInteractivity() {
    document.querySelectorAll('.rectangle').forEach(rect => {
        rect.addEventListener('mouseenter', () => {
            const textureIndex = parseInt(rect.dataset.textureIndex);
            if (textureIndex >= 0 && textureIndex < hydraTextures.length) {
                // Ejecutamos la función de Hydra correspondiente
                hydraTextures[textureIndex]();
                currentHydraTexture = textureIndex;
                isActive = true;
                lastActiveTime = Date.now();
            }
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

let isActive = false;
let lastActiveTime = 0;

function init() {
    adjustRectangles();
    setupInteractivity();
    animate();
}

window.addEventListener('resize', () => {
    adjustRectangles();
    camera.aspect = 1280 / 1080;
    camera.updateProjectionMatrix();
    renderer.setSize(1280, 1080);
});


// const socket = new WebSocket('ws://localhost:3000');
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const socket = new WebSocket(`${protocol}://${window.location.host}`);

socket.addEventListener('message', function (event) {
    const data = JSON.parse(event.data);
    if (data.type === 'activate') {
        const textureIndex = parseInt(data.index);
        if (textureIndex >= 0 && textureIndex < hydraTextures.length) {
            hydraTextures[textureIndex]();
            currentHydraTexture = textureIndex;
            isActive = true;
            lastActiveTime = Date.now();
        }
    }
});

init();