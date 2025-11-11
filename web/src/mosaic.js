// mosaic.js - Versión que usa el mismo enfoque que tu ejemplo
import SnapshotCompressor from './compressor/snapshotCompressor.js';

export async function loadMosaic() {
  const grid = document.getElementById('mosaic-grid');
  if (!grid) {
    console.error('No se encontró el elemento mosaic-grid');
    return;
  }

  try {
    const res = await fetch('/api/nfc-events?limit=600');
    if (!res.ok) throw new Error('Error fetching snapshots');
    
    let snapshots = await res.json();
    console.log('Snapshots cargados:', snapshots.length);

    // Calcular dimensiones igual que en tu ejemplo
    const targetSize = 80;
    const cols = Math.floor(window.innerWidth / targetSize);
    const rows = Math.floor(window.innerHeight / targetSize);
    const total = cols * rows;

    console.log(`🔲 Grid: ${cols}x${rows} = ${total} celdas`);

    // Manejar cantidad de snapshots igual que en tu ejemplo
    if (snapshots.length < total) {
      const repeatTimes = Math.ceil(total / snapshots.length);
      snapshots = Array.from({length: total}, (_, i) => snapshots[i % snapshots.length]);
    } else if (snapshots.length > total) {
      snapshots = snapshots.slice(0, total);
    }

    // 👇 CONFIGURACIÓN IDÉNTICA A TU EJEMPLO
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.style.width = '100vw';
    grid.style.height = '100vh';
    grid.style.gap = '0';
    grid.style.background = '#000';
    grid.style.overflow = 'hidden';
    grid.style.padding = '0';
    grid.style.margin = '0';
    grid.innerHTML = '';

    const compressor = new SnapshotCompressor();

    // Crear celdas IDÉNTICAS a tu ejemplo
    snapshots.forEach((snap, index) => {
      const cell = document.createElement('div');
      cell.className = 'mosaic-cell';
      
      // 👇 ESTILOS IDÉNTICOS A TU EJEMPLO
      cell.style.position = 'relative';
      cell.style.width = '100%';
      cell.style.aspectRatio = '1 / 1'; // 👈 CLAVE para celdas cuadradas
      cell.style.overflow = 'hidden';
      cell.style.background = '#000';
      
      const canvas = document.createElement('canvas');
      
      // 👇 ESTILOS IDÉNTICOS A TU EJEMPLO
      canvas.style.position = 'absolute';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'cover'; // 👈 CLAVE para ocupar todo el espacio
      canvas.style.imageRendering = 'pixelated';

      // Tamaño del canvas (mantener resolución original)
      canvas.width = compressor.targetWidth;
      canvas.height = compressor.targetHeight;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      
      try {
        const bytes = compressor.hexToBytes(snap.snapshot_data);
        const dithered = compressor.decompress2bpp(bytes);
        const imgData = compressor.ditheredToImageData(dithered);

        // Canvas temporal para rotar 90° - IGUAL QUE TU EJEMPLO
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = compressor.targetWidth;
        tempCanvas.height = compressor.targetHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imgData, 0, 0);

        // Rotar 90° horario - IGUAL QUE TU EJEMPLO
        ctx.save();
        ctx.translate(canvas.width, 0); // Mover origen a esquina superior derecha
        ctx.rotate(Math.PI / 2);        // 90° horario
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
        
        cell.appendChild(canvas);
      } catch (error) {
        console.error('Error procesando snapshot', index, error);
        // Celda de error que mantiene el aspecto
        cell.style.background = 'rgba(255, 50, 50, 0.2)';
        const errorDiv = document.createElement('div');
        errorDiv.textContent = '❌';
        errorDiv.style.color = 'rgba(255, 100, 100, 0.7)';
        errorDiv.style.fontSize = '24px';
        errorDiv.style.position = 'absolute';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        cell.appendChild(errorDiv);
      }
      
      grid.appendChild(cell);
    });

    console.log('✅ Mosaico cargado - Estilo idéntico al ejemplo');
    
  } catch (error) {
    console.error('Error cargando mosaico:', error);
    grid.innerHTML = `
      <div style="
        color: white; 
        text-align: center; 
        padding: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        font-family: 'Orbitron', sans-serif;
        background: #000;
      ">
        Error cargando mosaico
      </div>
    `;
  }
}

// Función para mostrar/ocultar mosaico
export function showMosaic(show) {
  const grid = document.getElementById('mosaic-grid');
  
  if (!grid) {
    console.error('❌ mosaic-grid no encontrado');
    return;
  }
  
  if (show) {
    grid.classList.remove('hidden');
    console.log('🟢 Mosaico MOSTRADO');
    
    // Recargar mosaico cuando se muestra
    setTimeout(() => {
      loadMosaic();
    }, 100);
  } else {
    grid.classList.add('hidden');
    console.log('🔴 Mosaico OCULTADO');
  }
}

// Manejar redimensionamiento
let resizeTimeout;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    console.log('🔄 Redimensionando mosaico...');
    loadMosaic();
  }, 250);
}

// Agregar listener para redimensionamiento
window.addEventListener('resize', handleResize);

// Función para limpiar
export function cleanupMosaic() {
  window.removeEventListener('resize', handleResize);
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
}