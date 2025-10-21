// web/audio/AudioManager.js
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.ambientSound = null;
    this.isAmbientPlaying = false;
    this.isInitialized = false;
    
    // Configuración de sonidos
    this.settings = {
      ambient: {
        volume: 0.1,
        baseFreq: 110, // A
        detune: 7,     // Slight detune for richness
        lfoSpeed: 0.02
      },
      success: {
        volume: 0.3,
        frequencies: [330, 440, 550], // C-E-G chord
        duration: 1.5
      },
      error: {
        volume: 0.2,
        startFreq: 440,
        endFreq: 110,
        duration: 0.8
      }
    };
    
    this.init();
  }

  async init() {
    try {
      // Esperar interacción del usuario para crear AudioContext
      if (this.isInitialized) return;
      
      // El AudioContext se creará con el primer user interaction
      console.log('AudioManager: Esperando interacción del usuario...');
      
    } catch (error) {
      console.error('Error inicializando AudioManager:', error);
    }
  }

  // Inicializar AudioContext (debe llamarse desde user interaction)
  initAudioContext() {
    if (this.audioContext) return;
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.isInitialized = true;
    console.log('AudioContext inicializado');
    
    // Iniciar sonido ambiental automáticamente
    this.startAmbientSound();
  }

  // 1. 🎵 SONIDO AMBIENTAL - Loop continuo sutil
  startAmbientSound() {
    if (!this.audioContext || this.isAmbientPlaying) return;

    const ctx = this.audioContext;
    const settings = this.settings.ambient;

    // Oscilador principal
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(settings.baseFreq, ctx.currentTime);
    
    // Oscilador secundario para richness
    const oscillator2 = ctx.createOscillator();
    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(settings.baseFreq + settings.detune, ctx.currentTime);

    // LFO para variación sutil
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(settings.lfoSpeed, ctx.currentTime);
    
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(3, ctx.currentTime); // Variación de ±3Hz

    // Filtro para suavizar
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, ctx.currentTime);
    filter.Q.setValueAtTime(0.5, ctx.currentTime);

    // Gain principal
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(settings.volume, ctx.currentTime);

    // Conectar nodos
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);
    lfoGain.connect(oscillator2.frequency);
    
    oscillator.connect(filter);
    oscillator2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Iniciar osciladores
    oscillator.start();
    oscillator2.start();
    lfo.start();

    this.ambientSound = {
      oscillator,
      oscillator2,
      lfo,
      filter,
      gainNode
    };

    this.isAmbientPlaying = true;
    console.log('Sonido ambiental iniciado');
  }

  stopAmbientSound() {
    if (!this.ambientSound || !this.isAmbientPlaying) return;

    const now = this.audioContext.currentTime;
    this.ambientSound.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2);
    
    setTimeout(() => {
      if (this.ambientSound) {
        this.ambientSound.oscillator.stop();
        this.ambientSound.oscillator2.stop();
        this.ambientSound.lfo.stop();
        this.ambientSound = null;
      }
      this.isAmbientPlaying = false;
    }, 2000);
  }

  // 2. ✅ SONIDO DE ÉXITO - Acorde satisfactorio
  playSuccess() {
    if (!this.audioContext) {
      console.warn('AudioContext no inicializado');
      return;
    }

    const ctx = this.audioContext;
    const settings = this.settings.success;
    const now = ctx.currentTime;

    // Crear ganancia principal para el acorde
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(settings.volume, now + 0.1);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);
    mainGain.connect(ctx.destination);

    // Crear osciladores para cada frecuencia del acorde
    settings.frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, now);
      
      // Detalle: pequeños detunes y envelopes diferentes
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.8 / settings.frequencies.length, now + 0.05 + (index * 0.02));
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration - (index * 0.1));
      
      oscillator.connect(oscGain);
      oscGain.connect(mainGain);
      
      oscillator.start(now);
      oscillator.stop(now + settings.duration);
    });

    console.log('Sonido de éxito reproducido');
  }

  // 3. ❌ SONIDO DE ERROR - Glitch descendente
  playError() {
    if (!this.audioContext) {
      console.warn('AudioContext no inicializado');
      return;
    }

    const ctx = this.audioContext;
    const settings = this.settings.error;
    const now = ctx.currentTime;

    // Oscilador principal descendente
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(settings.startFreq, now);
    oscillator.frequency.exponentialRampToValueAtTime(settings.endFreq, now + settings.duration);

    // Ruido para el componente "glitch"
    const noise = ctx.createBufferSource();
    const bufferSize = ctx.sampleRate * settings.duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    noise.buffer = buffer;

    // Ganancia para el oscilador
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(settings.volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);

    // Ganancia para el ruido (más corto)
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(settings.volume * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration * 0.3);

    // Conectar
    oscillator.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Iniciar y detener
    oscillator.start(now);
    oscillator.stop(now + settings.duration);
    
    noise.start(now);
    noise.stop(now + settings.duration * 0.3);

    console.log('Sonido de error reproducido');
  }

  // Control de volumen ambiental
  setAmbientVolume(volume) {
    this.settings.ambient.volume = Math.max(0, Math.min(1, volume));
    if (this.ambientSound && this.ambientSound.gainNode) {
      this.ambientSound.gainNode.gain.setValueAtTime(this.settings.ambient.volume, this.audioContext.currentTime);
    }
  }

  // Limpieza
  cleanup() {
    this.stopAmbientSound();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export default AudioManager;