// mosaic.js - Versión optimizada con densidad máxima
import { SnapshotCompressor } from 'treslib';

export async function loadMosaic() {
  const grid = document.getElementById('mosaic-grid');
  if (!grid) {
    console.error('No se encontró el elemento mosaic-grid');
    return;
  }

  try {
    const res = await fetch('/api/nfc-events?limit=1200');
    if (!res.ok) throw new Error('Error fetching snapshots');
    
    let snapshots = await res.json();
    console.log('Snapshots cargados:', snapshots.length);

    // Ordenar por timestamp (más recientes primero)
    snapshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 👇 CÁLCULO DE DENSIDAD MÁXIMA SIN LÍMITES
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight;
    const totalArea = availableWidth * availableHeight;
    
    // Tamaño teórico para mostrar TODOS
    const theoreticalSize = Math.sqrt(totalArea / snapshots.length);
    
    // Dimensiones del grid
    let cols = Math.floor(availableWidth / theoreticalSize);
    let rows = Math.floor(availableHeight / theoreticalSize);
    let totalCells = cols * rows;

    console.log(`📐 Teórico: ${theoreticalSize.toFixed(1)}px, Grid: ${cols}x${rows} = ${totalCells} celdas`);

    // 👇 OPTIMIZACIÓN: ELIMINAR SNAPS VIEJOS PARA EVITAR CELDAS VACÍAS
    if (snapshots.length > totalCells) {
      // Descartar los más viejos (que están al final del array ordenado)
      const snapshotsToRemove = snapshots.length - totalCells;
      snapshots = snapshots.slice(0, totalCells);
      console.log(`🗑️ Eliminados ${snapshotsToRemove} snaps más viejos`);
    } else if (snapshots.length < totalCells) {
      // Ajustar filas para minimizar celdas vacías
      const optimalRows = Math.ceil(snapshots.length / cols);
      if (optimalRows <= Math.floor(availableHeight / theoreticalSize)) {
        rows = optimalRows;
        totalCells = cols * rows;
        console.log(`🔄 Ajustado a ${cols}x${rows} = ${totalCells} celdas`);
      }
    }

    // Tamaño final basado en grid optimizado
    const finalCellSize = Math.min(availableWidth / cols, availableHeight / rows);
    
    console.log(`🎯 Final: ${cols}x${rows}, ${snapshots.length}/${totalCells} snaps, ${finalCellSize.toFixed(1)}px`);

    // 👇 APLICAR AL GRID
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.style.width = '100vw';
    grid.style.height = '100vh';
    grid.style.gap = '0';
    grid.style.background = '#000';
    grid.style.overflow = 'hidden';
    grid.innerHTML = '';

    const compressor = new SnapshotCompressor();

    // Renderizar snaps optimizados
    snapshots.forEach((snap, index) => {
      const cell = document.createElement('div');
      cell.className = 'mosaic-cell';
      
      cell.style.position = 'relative';
      cell.style.width = '100%';
      cell.style.aspectRatio = '1 / 1';
      cell.style.overflow = 'hidden';
      cell.style.background = '#000';
      
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'cover';
      canvas.style.imageRendering = 'pixelated';

      canvas.width = compressor.targetWidth;
      canvas.height = compressor.targetHeight;

      try {
        compressor.renderToCanvas(snap.snapshot_data, canvas, 90);
        cell.appendChild(canvas);
      } catch (error) {
        console.error('Error procesando snapshot', index, error);
        cell.style.background = 'rgba(255, 50, 50, 0.2)';
      }
      
      grid.appendChild(cell);
    });

    // Rellenar celdas vacías si las hay
    const emptyCells = totalCells - snapshots.length;
    if (emptyCells > 0) {
      console.log(`⚪ ${emptyCells} celdas vacías`);
      for (let i = 0; i < emptyCells; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'mosaic-cell';
        emptyCell.style.background = '#000';
        emptyCell.style.aspectRatio = '1 / 1';
        grid.appendChild(emptyCell);
      }
    }

    console.log('✅ Mosaico optimizado cargado');
    
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

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Mosaic.js inicializado');
  });
} else {
  console.log('🚀 Mosaic.js inicializado (DOM ya listo)');
}