// Puente selectivo a treslib — solo los módulos sin dependencias externas.
// Evita que el browser intente resolver three/hydra-synth/tween.
export { GrainEngine }          from '/lib/treslib/GrainEngine.js';
export { SnapToGrains }         from '/lib/treslib/SnapToGrains.js';
export { default as SnapshotCompressor } from '/lib/treslib/SnapshotCompressor.js';
