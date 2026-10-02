/**
 * FarmRush 3D audio subsystem.
 * Keeps WebAudio implementation out of the main game simulation file.
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.engine = null;
    this.horn = null;
  }

  getAudioContextClass() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  ensureContext() {
    if (this.ctx) return this.ctx;
    const AudioContextClass = this.getAudioContextClass();
    if (!AudioContextClass) return null;
    this.ctx = new AudioContextClass();
    return this.ctx;
  }

  init() {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    this.initEngine();
    this.initHorn();
    ctx.resume?.();
    return true;
  }

  initEngine() {
    if (this.engine) return true;
    const ctx = this.ensureContext();
    if (!ctx) return false;

    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.16;
    master.gain.value = 0.0001;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    const fire = ctx.createOscillator();
    fire.type = 'square';
    const fireGain = ctx.createGain();
    fireGain.gain.value = 0.085;
    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = 'lowpass';
    fireFilter.frequency.value = 310;
    fireFilter.Q.value = 0.65;
    fire.connect(fireFilter);
    fireFilter.connect(fireGain);
    fireGain.connect(master);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.055;
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.value = 170;
    bodyFilter.Q.value = 0.7;
    body.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(master);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    const thumpGain = ctx.createGain();
    thumpGain.gain.value = 0.10;
    thump.connect(thumpGain);
    thumpGain.connect(master);

    const h2 = ctx.createOscillator();
    h2.type = 'sawtooth';
    const h2Gain = ctx.createGain();
    h2Gain.gain.value = 0.025;
    h2.connect(h2Gain);
    h2Gain.connect(master);

    const h4 = ctx.createOscillator();
    h4.type = 'square';
    const h4Gain = ctx.createGain();
    h4Gain.gain.value = 0.012;
    h4.connect(h4Gain);
    h4Gain.connect(master);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) {
      const white = Math.random() * 2 - 1;
      noiseData[i] = white * 0.72 + (i ? noiseData[i - 1] * 0.28 : 0);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const exhaust = ctx.createBiquadFilter();
    exhaust.type = 'bandpass';
    exhaust.frequency.value = 700;
    exhaust.Q.value = 0.55;
    const exhaustGain = ctx.createGain();
    exhaustGain.gain.value = 0.015;
    noise.connect(exhaust);
    exhaust.connect(exhaustGain);
    exhaustGain.connect(master);

    const air = ctx.createBiquadFilter();
    air.type = 'highpass';
    air.frequency.value = 420;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.004;
    noise.connect(air);
    air.connect(airGain);
    airGain.connect(master);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain);
    lfoGain.connect(fireGain.gain);

    const now = ctx.currentTime;
    fire.start(now);
    body.start(now);
    thump.start(now);
    h2.start(now);
    h4.start(now);
    noise.start(now);
    lfo.start(now);

    this.engine = {
      master,
      fire,
      body,
      thump,
      h2,
      h4,
      exhaustGain,
      airGain,
      fireGain,
      bodyGain,
      thumpGain,
      h2Gain,
      h4Gain,
    };

    return true;
  }

  initHorn() {
    if (this.horn) return true;
    const ctx = this.ensureContext();
    if (!ctx) return false;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.14;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.frequency.value = 420;
    o2.frequency.value = 500;

    const f1 = ctx.createBiquadFilter();
    const f2 = ctx.createBiquadFilter();
    f1.type = 'lowpass';
    f2.type = 'lowpass';
    f1.frequency.value = 980;
    f2.frequency.value = 1150;
    f1.Q.value = 0.7;
    f2.Q.value = 0.7;

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 0.19;
    g2.gain.value = 0.11;

    o1.connect(f1);
    f1.connect(g1);
    g1.connect(master);
    o2.connect(f2);
    f2.connect(g2);
    g2.connect(master);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 6.2;
    lfoGain.gain.value = 3.8;
    lfo.connect(lfoGain);
    lfoGain.connect(o1.detune);
    lfoGain.connect(o2.detune);

    const now = ctx.currentTime;
    o1.start(now);
    o2.start(now);
    lfo.start(now);

    this.horn = { master };
    return true;
  }

  hornDown() {
    if (!this.init()) return false;
    const now = this.ctx.currentTime;
    this.horn.master.gain.cancelScheduledValues(now);
    this.horn.master.gain.setTargetAtTime(0.20, now, 0.012);
    this.ctx.resume?.();
    return true;
  }

  hornUp() {
    if (!this.horn || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.horn.master.gain.cancelScheduledValues(now);
    this.horn.master.gain.setTargetAtTime(0.0001, now, 0.045);
  }

  updateEngine({ state, controls, rpm, speed }) {
    if (!this.engine || !this.ctx) return;
    const a = this.engine;
    const now = this.ctx.currentTime;
    const rpmNow = Math.max(700, Math.min(2800, rpm || 850));
    const firingHz = Math.max(17.5, rpmNow / 40);
    const throttle = (controls.w || controls.up) && state.gear !== 0 && !controls.hand ? 1 : 0;
    const load = Math.max(0, Math.min(1, (rpmNow - 750) / 1850));
    const moving = Math.min(1, Math.abs(speed) / 10);
    const active = state.started && !state.paused;

    this.ctx.resume?.();
    a.fire.frequency.setTargetAtTime(firingHz, now, 0.045);
    a.body.frequency.setTargetAtTime(Math.max(12, firingHz * 0.50), now, 0.05);
    a.thump.frequency.setTargetAtTime(Math.max(18, firingHz), now, 0.05);
    a.h2.frequency.setTargetAtTime(firingHz * 2, now, 0.045);
    a.h4.frequency.setTargetAtTime(firingHz * 4, now, 0.045);

    const engineVolumeBoost = 1.15; // small approved increase
    const masterTarget = active
      ? (0.075 + load * 0.055 + throttle * 0.025 + (controls.plough ? 0.018 : 0)) * engineVolumeBoost
      : 0.0001;
    const fireTarget = 0.058 + load * 0.055 + throttle * 0.018;
    const bodyTarget = 0.045 + load * 0.040;
    const thumpTarget = 0.055 + load * 0.060 + throttle * 0.025;
    const h2Target = 0.012 + load * 0.022;
    const h4Target = 0.006 + load * 0.014;
    const exhaustTarget = 0.007 + load * 0.032 + throttle * 0.022 + (controls.plough ? 0.018 : 0);
    const airTarget = 0.002 + load * 0.010 + throttle * 0.016;

    a.master.gain.setTargetAtTime(masterTarget, now, 0.06);
    a.fireGain.gain.setTargetAtTime(fireTarget, now, 0.055);
    a.bodyGain.gain.setTargetAtTime(bodyTarget, now, 0.06);
    a.thumpGain.gain.setTargetAtTime(thumpTarget, now, 0.055);
    a.h2Gain.gain.setTargetAtTime(h2Target, now, 0.06);
    a.h4Gain.gain.setTargetAtTime(h4Target, now, 0.06);
    a.exhaustGain.gain.setTargetAtTime(exhaustTarget, now, 0.07);
    a.airGain.gain.setTargetAtTime(airTarget, now, 0.08);
    a.fire.detune.setTargetAtTime((Math.sin(performance.now() * 0.006) * 3) + moving * 2, now, 0.08);
  }
}


// Expose for classic-script loading so the game also works from file:// URLs.
window.AudioManager = AudioManager;
