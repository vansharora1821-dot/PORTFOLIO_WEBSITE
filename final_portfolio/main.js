/**
 * Cinematic Vault Gate Landing Experience - Interactive Engine
 * 
 * Features:
 * 1. Unified Render Loop: Coordinates base zoom, scroll zoom, camera drift, mouse parallax, and thunder shake.
 * 2. High-Performance Rain: Two-layer HTML5 Canvas simulator with dynamic wind and scroll density scaling.
 * 3. Procedural Audio Manager: Real-time synthesis of bunker drone, rain, thunder, and hydraulic release.
 * 4. Thunder & Lightning Engine: Synced illumination, vignette modulation, camera shake, and speed-of-sound sound delay.
 * 5. Scroll State Manager: Tracks CLOSED -> UNLOCKING -> OPENING states based on scroll position.
 */

// --- STATE MANAGER ---
const VaultState = {
  CLOSED: 'CLOSED',
  UNLOCKING: 'UNLOCKING',
  OPENING: 'OPENING',
  OPENED: 'OPENED',
  TRANSITION: 'TRANSITION'
};

let currentVaultState = VaultState.CLOSED;
let hasTriggeredHydraulics = false;
let hasTriggeredOpening = false;

function transitionTo(newState) {
  if (currentVaultState === newState) return;
  console.log(`[Vault State] Transition: ${currentVaultState} -> ${newState}`);
  currentVaultState = newState;

  // React to state changes
  const bloomLayer = document.getElementById('vault-bloom');
  
  if (newState === VaultState.UNLOCKING) {
    // Speed up neon pulsation and make it glow brighter
    bloomLayer.style.transition = 'opacity 0.2s ease';
    // Start play hydraulic hiss if audio initialized
    if (audioManager.initialized) {
      audioManager.playHydraulicHiss();
    }
  } else if (newState === VaultState.OPENING) {
    // Controlled glow and screen fade while preserving image detail.
    bloomLayer.style.transition = 'opacity 1.5s ease';
    bloomLayer.style.opacity = '0.18';
    setTimeout(() => {
      // Trigger full fade-out to black (simulating entering the vault)
      const loader = document.getElementById('loader');
      loader.style.display = 'flex'; // Reset display to override 'none'
      loader.classList.remove('fade-out');
      const luxuryTitle = loader.querySelector('.luxury-title');
      const luxuryPrompt = loader.querySelector('.luxury-prompt');
      
      luxuryTitle.textContent = "A C C E S S   G R A N T E D";
      luxuryPrompt.textContent = "ENTERING SYSTEM ENVIRONMENT...";
      loader.style.opacity = '1';
      loader.style.visibility = 'visible';
      
      // Duck ambient sounds
      if (audioManager.initialized) {
        audioManager.fadeOutAmbient(3.0);
      }
    }, 1500);
  } else if (newState === VaultState.CLOSED) {
    bloomLayer.style.transition = 'opacity 1s ease';
    bloomLayer.style.opacity = '0.012';
  }
}

// --- AUDIO MANAGER (Procedural Web Audio API Synthesizers) ---
class ProceduralAudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    
    // Nodes for continuous ambient layers
    this.droneGain = null;
    this.rainGain = null;
    this.masterGain = null;
    
    // Synthesized Noise Buffers
    this.whiteNoiseBuffer = null;
    this.brownNoiseBuffer = null;
    
    // Audio nodes tracking to prevent garbage disposal issues
    this.droneOscs = [];
    this.rainSource = null;
  }

  init() {
    if (this.initialized) return;

    // Create browser Audio Context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
    
    // Create pre-rendered noise buffers
    this.whiteNoiseBuffer = this.createWhiteNoiseBuffer(3.0);
    this.brownNoiseBuffer = this.createBrownNoiseBuffer(4.0);
    
    // Start ambient synthesizers
    this.startBunkerDrone();
    this.startRainAmbience();
    
    // Smoothly fade in ambient tracks
    this.masterGain.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 3.0);
    
    this.initialized = true;
    console.log('[Audio Manager] Synthesizers Initialized successfully.');
  }

  // White noise generator for rain and hydraulics
  createWhiteNoiseBuffer(duration) {
    const size = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Brown noise generator for low rumbles and thunder
  createBrownNoiseBuffer(duration) {
    const size = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < size; i++) {
      const white = Math.random() * 2 - 1;
      // Filter algorithm for brown noise from white noise
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Compensate for amplitude loss
    }
    return buffer;
  }

  // Synthesize Deep Bunker Hum / Drone
  startBunkerDrone() {
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.droneGain.connect(this.masterGain);

    // Deep sub-bass layers (50Hz and 75Hz)
    const frequencies = [50, 75];
    const oscTypes = ['sine', 'triangle'];
    
    frequencies.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = oscTypes[idx] || 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      // Filter to keep the sound extremely clean, heavy, and low-end
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, this.ctx.currentTime);
      
      osc.connect(filter);
      filter.connect(this.droneGain);
      
      osc.start();
      this.droneOscs.push(osc);
    });

    // Slow low-frequency sweep to give the drone movement
    const filterSweeper = this.ctx.createOscillator();
    const sweeperGain = this.ctx.createGain();
    
    filterSweeper.frequency.setValueAtTime(0.04, this.ctx.currentTime); // 0.04 Hz LFO
    sweeperGain.gain.setValueAtTime(30, this.ctx.currentTime); // sweep amplitude
    
    // Create a filter sweep node
    const sweepFilter = this.ctx.createBiquadFilter();
    sweepFilter.type = 'lowpass';
    sweepFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
    
    filterSweeper.connect(sweeperGain);
    sweeperGain.connect(sweepFilter.frequency);
    
    // Connect drone oscillators to the sweeper filter
    this.droneGain.disconnect();
    this.droneGain.connect(sweepFilter);
    sweepFilter.connect(this.masterGain);
    
    filterSweeper.start();
  }

  // Synthesize Realistic Atmospheric Rain Audio
  startRainAmbience() {
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    this.rainGain.connect(this.masterGain);

    // Loop white noise source
    this.rainSource = this.ctx.createBufferSource();
    this.rainSource.buffer = this.whiteNoiseBuffer;
    this.rainSource.loop = true;

    // Filter to isolate the sound of rain drops (bandpass at 1100Hz)
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1100, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(0.9, this.ctx.currentTime);

    // Modulate volume slightly to simulate wind dynamics
    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    const windOsc = this.ctx.createOscillator();
    windOsc.frequency.setValueAtTime(0.12, this.ctx.currentTime); // Slow modulation
    const windModGain = this.ctx.createGain();
    windModGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    windOsc.connect(windModGain);
    windModGain.connect(windGain.gain);
    
    this.rainSource.connect(bandpass);
    bandpass.connect(windGain);
    windGain.connect(this.rainGain);
    
    this.rainSource.start();
    windOsc.start();
  }

  // Dynamically set weather volume based on scroll percent
  updateWeatherIntensity(intensity) {
    if (!this.initialized) return;
    // Scale rain volume up to 2.5x base volume as weather increases
    const targetRainVolume = 0.25 + (intensity * 0.4);
    this.rainGain.gain.setTargetAtTime(targetRainVolume, this.ctx.currentTime, 0.2);
  }

  // Synthesize Thunder Rumble
  playThunderAudio(intensity) {
    if (!this.initialized) return;

    // Source 1: Deep Brown Noise rumble
    const rumbleSource = this.ctx.createBufferSource();
    rumbleSource.buffer = this.brownNoiseBuffer;
    
    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    // Instant attack, slow exponential decay
    rumbleGain.gain.linearRampToValueAtTime(intensity * 0.95, this.ctx.currentTime + 0.1);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 5.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(90, this.ctx.currentTime);
    // Sweep frequency down to make rumble feel distant
    filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 5.0);

    rumbleSource.connect(filter);
    filter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumbleSource.start();

    // Source 2: Synthesize Crackle/Strike
    if (intensity > 0.6) {
      const crackleSource = this.ctx.createBufferSource();
      crackleSource.buffer = this.whiteNoiseBuffer;

      const crackleGain = this.ctx.createGain();
      crackleGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      crackleGain.gain.linearRampToValueAtTime(intensity * 0.2, this.ctx.currentTime + 0.02);
      crackleGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);

      const crackleFilter = this.ctx.createBiquadFilter();
      crackleFilter.type = 'bandpass';
      crackleFilter.frequency.setValueAtTime(250, this.ctx.currentTime);

      crackleSource.connect(crackleFilter);
      crackleFilter.connect(crackleGain);
      crackleGain.connect(this.masterGain);
      crackleSource.start();
    }
  }

  // Synthesize High-End Hydraulic Air Lock Hiss (Vault Unlock sound)
  playHydraulicHiss() {
    if (!this.initialized) return;

    const hissSource = this.ctx.createBufferSource();
    hissSource.buffer = this.whiteNoiseBuffer;

    const hissGain = this.ctx.createGain();
    hissGain.gain.setValueAtTime(0, this.ctx.currentTime);
    // Sudden burst, steady release, long decay
    hissGain.gain.linearRampToValueAtTime(0.24, this.ctx.currentTime + 0.15);
    hissGain.gain.setValueAtTime(0.24, this.ctx.currentTime + 0.95);
    hissGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 4.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(6200, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    hissSource.connect(filter);
    filter.connect(hissGain);
    hissGain.connect(this.masterGain);
    
    hissSource.start();
    console.log('[Audio Manager] Played Hydraulic Release Sound.');
  }

  fadeOutAmbient(duration) {
    if (!this.initialized) return;
    this.masterGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
  }
}

const audioManager = new ProceduralAudioManager();

// --- CANVAS RAIN SIMULATION ---
const canvas = document.getElementById('rain-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
const particlePool = []; // Memory pool to reuse objects
let maxParticles = 380;
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;

function resizeCanvas() {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewportWidth * dpr);
  canvas.height = Math.round(viewportHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class RainDrop {
  init(isForeground) {
    this.x = Math.random() * (viewportWidth + 200) - 100;
    this.y = Math.random() * -viewportHeight - 20;
    this.layer = isForeground ? 1 : 0;
    
    if (this.layer === 1) {
      // Foreground streaks: visible, narrow, and fast.
      this.vy = 20 + Math.random() * 6;
      this.length = 16 + Math.random() * 9;
      this.width = 0.55 + Math.random() * 0.22;
      this.baseOpacity = 0.48;
    } else {
      // Midground streaks: lighter and shorter for depth.
      this.vy = 12 + Math.random() * 4;
      this.length = 10 + Math.random() * 7;
      this.width = 0.32 + Math.random() * 0.18;
      this.baseOpacity = 0.32;
    }
  }

  update(windX) {
    this.y += this.vy;
    this.x += windX * (this.layer === 1 ? 1.25 : 0.85);

    // Recycle if out of viewport
    if (this.y > viewportHeight + 50) {
      this.init(this.layer === 1);
    }
  }

  draw() {
    // Dynamic rain opacity masking based on proximity to central light sources
    const dx = this.x - (viewportWidth * 0.49);
    const dy = this.y - (viewportHeight * 0.54);
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Proximity factor to center-left vault gate light source
    const lightGlowRadius = Math.max(viewportWidth, viewportHeight) * 0.40;
    // Set min proximity threshold to 0.25 so rain remains visible in dark margins (stairs/sides)
    const proximity = Math.max(0.25, 1.0 - (dist / lightGlowRadius));
    const finalOpacity = this.baseOpacity * proximity * 0.82;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(185, 205, 230, ${finalOpacity})`;
    ctx.lineWidth = this.width;
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + (windXEffect * (this.layer === 1 ? 1.3 : 0.8)), this.y + this.length);
    ctx.stroke();
  }
}

// Instantiate particles pool
function initWeather() {
  particles = [];
  for (let i = 0; i < 1000; i++) { // Increased pool size to 1000
    const drop = new RainDrop();
    // 35% foreground, 65% midground
    drop.init(Math.random() < 0.35);
    particlePool.push(drop);
  }
  updateActiveParticleCount();
}

function updateActiveParticleCount() {
  particles = [];
  for (let i = 0; i < maxParticles; i++) {
    particles.push(particlePool[i]);
  }
}


// --- CINEMATIC RENDERING ENGINE ---
const cameraRig = document.getElementById('camera-rig');
const vignetteNode = document.getElementById('vignette');
const lightningFlashNode = document.getElementById('lightning-flash');
const vaultGate = document.getElementById('vault-gate');
const vaultBloom = document.getElementById('vault-bloom');

// Interpolated coordinate state vectors (for LERPing)
let targetX = 0, targetY = 0;
let currentX = 0, currentY = 0;

let scale = 1.0;
let targetScale = 1.0;

let driftX = 0, driftY = 0;
let shakeX = 0, shakeY = 0;
let shakeIntensity = 0;

let targetScrollPercent = 0;
let currentScrollPercent = 0;

let windXEffect = -2.5;

// Monitor Mouse Parallax Coordinates
window.addEventListener('mousemove', (e) => {
  // Translate coordinate from screen center (-0.5 to 0.5)
  const xOffset = (e.clientX / window.innerWidth) - 0.5;
  const yOffset = (e.clientY / window.innerHeight) - 0.5;
  
  // Exceedingly subtle maximum drift of 14px to retain luxury look
  targetX = xOffset * -14;
  targetY = yOffset * -14;
});

// Monitor Scroll Position
window.addEventListener('scroll', () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return;
  targetScrollPercent = window.scrollY / maxScroll;
});

// Thunder Scheduler (Lightning Events)
let nextThunderTime = Date.now() + 8000 + Math.random() * 10000;

function handleThunderLightning(currentTime) {
  if (Date.now() < nextThunderTime) return;
  
  // Set next strike interval (between 12 and 22 seconds)
  nextThunderTime = Date.now() + 12000 + Math.random() * 10000;

  const strikeIntensity = 0.5 + Math.random() * 0.5; // randomized brightness
  console.log(`[Lightning Strike] Intensity: ${strikeIntensity.toFixed(2)}`);

  // Flash Sequence (Visual Illumination)
  const timeline = animeLightningFlash(strikeIntensity);

  // Synchronized Camera Shake
  shakeIntensity = strikeIntensity * 7; // Reduced camera response

  // Speed-of-sound sound delay delay (500ms to 1800ms)
  const audioDelay = 500 + Math.random() * 1300;
  setTimeout(() => {
    audioManager.playThunderAudio(strikeIntensity);
  }, audioDelay);
}

function animeLightningFlash(intensity) {
  // Flash flicker loop in JS using frames
  let frame = 0;
  
  function triggerFlashFrame() {
    frame++;
    let opacity = 0;
    let vignetteSize = 60;
    let vignetteOpacity = 0.20;

    if (frame <= 4) {
      // First quick bolt flash (reduced maximum intensity significantly)
      opacity = intensity * 0.18;
      vignetteSize = 64;
      vignetteOpacity = 0.17;
    } else if (frame <= 8) {
      // Dropoff
      opacity = 0;
    } else if (frame <= 16) {
      // Primary lightning discharge flash
      const decay = 1.0 - ((frame - 8) / 8);
      opacity = intensity * decay * 0.22;
      vignetteSize = 60 + (4 * decay);
      vignetteOpacity = 0.20 - (0.03 * decay);
    }

    // Apply lightning flash opacity
    lightningFlashNode.style.opacity = opacity;
    
    // Add subtle indirect illumination by adjusting brightness/contrast of the main image
    const brightnessBoost = 1.0 + (opacity * 0.25); // Subtle indirect light bounce
    const contrastBoost = 1.0 + (opacity * 0.12);
    vaultGate.style.filter = `brightness(${brightnessBoost}) contrast(${contrastBoost})`;
    vaultBloom.style.filter = `contrast(${2.6 * contrastBoost}) brightness(${1.28 * brightnessBoost}) blur(5px)`;

    document.documentElement.style.setProperty('--vignette-size', `${vignetteSize}%`);
    document.documentElement.style.setProperty('--vignette-opacity', vignetteOpacity);

    if (frame < 24) {
      requestAnimationFrame(triggerFlashFrame);
    } else {
      // Ensure resets
      lightningFlashNode.style.opacity = '0';
      vaultGate.style.filter = '';
      vaultBloom.style.filter = '';
      document.documentElement.style.setProperty('--vignette-size', '60%');
      document.documentElement.style.setProperty('--vignette-opacity', '0.20');
    }
  }

  requestAnimationFrame(triggerFlashFrame);
}


// --- MAIN LOOP ---
function renderLoop(timestamp) {
  // Heavy scroll LERP for physical crane zoom feel
  currentScrollPercent += (targetScrollPercent - currentScrollPercent) * 0.022;

  // Scroll Cinematic Framework Stage Calculations
  // 0% - 25%: Vault Closed
  // 25% - 100%: Push-in scale begins and increases
  let scrollScale = 0;
  if (currentScrollPercent > 0.25) {
    const factor = (currentScrollPercent - 0.25) / 0.75;
    // Keep scroll movement subtle and below the 1.02 presentation ceiling.
    scrollScale = factor * 0.012;
  }

  // 50% - 100%: Weather/rain and CSS Fog density scale up
  if (currentScrollPercent > 0.5) {
    const fact = (currentScrollPercent - 0.5) / 0.5;
    maxParticles = Math.floor(380 + (fact * 300));
    updateActiveParticleCount();
    
    // Scale wind deflection slightly based on weather escalation
    windXEffect = -2.2 - (fact * 3.4);
    
    // Ramp sound volume and decrease fog transparency slightly
    audioManager.updateWeatherIntensity(fact);
  } else {
    maxParticles = 380;
    windXEffect = -2.2;
    audioManager.updateWeatherIntensity(0);
  }

  // 75%+: Transition stages to UNLOCKING state
  if (currentScrollPercent >= 0.98) {
    transitionTo(VaultState.OPENING);
  } else if (currentScrollPercent >= 0.75) {
    transitionTo(VaultState.UNLOCKING);
  } else {
    transitionTo(VaultState.CLOSED);
  }

  // Keep the camera almost static so the native image detail remains crisp.
  const baseScale = 1.0 + Math.min(timestamp * 0.00000001, 0.002);
  
  // Target Scale = base push-in + scroll zoom. Gentle push if OPENING.
  let targetRigScale = baseScale + scrollScale;
  if (currentVaultState === VaultState.OPENING) {
    targetRigScale += 0.003;
  }
  targetRigScale = Math.min(targetRigScale, 1.02);
  
  // Extra-heavy LERP for majestic cinema camera feel
  scale += (targetRigScale - scale) * 0.02;

  // Calculate Camera Drift (extremely slow organic crane movement)
  driftX = Math.sin(timestamp * 0.0002) * 5;
  driftY = Math.cos(timestamp * 0.00015) * 5;

  // Compute camera shake decay
  shakeX = Math.sin(timestamp * 0.22) * shakeIntensity;
  shakeY = Math.cos(timestamp * 0.18) * shakeIntensity;
  shakeIntensity *= 0.925; // Exp decay

  // Heavy LERP Mouse Parallax offset for weighted physical crane look
  currentX += (targetX - currentX) * 0.015;
  currentY += (targetY - currentY) * 0.015;

  // Compile final spatial coordinate transform
  const finalX = currentX + driftX + shakeX;
  const finalY = currentY + driftY + shakeY;

  cameraRig.style.transform = `translate3d(${finalX}px, ${finalY}px, 0) scale(${scale})`;

  // Render Rain Canvas
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  for (let i = 0; i < particles.length; i++) {
    particles[i].update(windXEffect);
    particles[i].draw();
  }

  // Manage Lightning Strikes
  handleThunderLightning(timestamp);

  requestAnimationFrame(renderLoop);
}

// --- INITIALIZATION AND BOOTSTRAPPING ---
const loader = document.getElementById('loader');

loader.addEventListener('click', () => {
  // Boot and start Web Audio API (satisfying interaction locks)
  audioManager.init();

  // Trigger loading screen fadeout
  loader.classList.add('fade-out');

  // Launch core weather systems
  initWeather();

  // Run rendering framework loop
  requestAnimationFrame(renderLoop);
  
  // Clean up loader node after CSS transition completes to free memory
  setTimeout(() => {
    // We hide it but keep it in DOM so we can re-use it to show ACCESS GRANTED screen during transition.
    loader.style.display = 'none';
  }, 2000);
});

// Handle tab visibility (suspend audio context when backgrounded to prevent visual-audio drift)
document.addEventListener('visibilitychange', () => {
  if (audioManager.initialized) {
    if (document.hidden) {
      audioManager.ctx.suspend();
    } else {
      audioManager.ctx.resume();
    }
  }
});
