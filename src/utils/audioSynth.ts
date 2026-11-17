// Web Audio API Solfeggio Synthesizer for Quantum Anchoring

class SolfeggioSynthesizer {
  private ctx: AudioContext | null = null;
  private primaryOsc: OscillatorNode | null = null;
  private harmonicOsc: OscillatorNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private currentHz: number = 432;
  private playing: boolean = false;
  private volume: number = 0.25;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public start(hz: number, volume = this.volume): void {
    const ctx = this.ensureContext();
    this.stopImmediate();

    this.currentHz = hz;
    this.volume = Math.max(0.02, Math.min(0.8, volume));

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(this.volume, ctx.currentTime + 0.6);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    // Pure Solfeggio fundamental sine oscillator
    const primaryOsc = ctx.createOscillator();
    primaryOsc.type = 'sine';
    primaryOsc.frequency.setValueAtTime(hz, ctx.currentTime);

    // Subtle fifth harmonic overtone at very gentle amplitude for acoustic warmth
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.12, ctx.currentTime);

    const harmonicOsc = ctx.createOscillator();
    harmonicOsc.type = 'sine';
    harmonicOsc.frequency.setValueAtTime(hz * 1.5, ctx.currentTime);

    primaryOsc.connect(masterGain);
    harmonicOsc.connect(harmonicGain);
    harmonicGain.connect(masterGain);

    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    primaryOsc.start();
    harmonicOsc.start();

    this.primaryOsc = primaryOsc;
    this.harmonicOsc = harmonicOsc;
    this.masterGain = masterGain;
    this.analyser = analyser;
    this.playing = true;
  }

  public setFrequency(hz: number): void {
    this.currentHz = hz;
    if (this.playing && this.ctx && this.primaryOsc && this.harmonicOsc) {
      const now = this.ctx.currentTime;
      this.primaryOsc.frequency.exponentialRampToValueAtTime(hz, now + 0.25);
      this.harmonicOsc.frequency.exponentialRampToValueAtTime(hz * 1.5, now + 0.25);
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0.01, Math.min(0.8, vol));
    if (this.playing && this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
    }
  }

  public stop(): void {
    if (!this.playing || !this.ctx || !this.masterGain) {
      this.stopImmediate();
      return;
    }

    const ctx = this.ctx;
    const gain = this.masterGain;
    const pOsc = this.primaryOsc;
    const hOsc = this.harmonicOsc;

    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.001), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      setTimeout(() => {
        try {
          pOsc?.stop();
          hOsc?.stop();
          pOsc?.disconnect();
          hOsc?.disconnect();
        } catch {
          // Ignore already stopped oscillators
        }
      }, 380);
    } catch {
      this.stopImmediate();
    }

    this.primaryOsc = null;
    this.harmonicOsc = null;
    this.masterGain = null;
    this.analyser = null;
    this.playing = false;
  }

  private stopImmediate(): void {
    try {
      this.primaryOsc?.stop();
      this.harmonicOsc?.stop();
      this.primaryOsc?.disconnect();
      this.harmonicOsc?.disconnect();
      this.masterGain?.disconnect();
    } catch {
      // Ignore cleanup errors
    }
    this.primaryOsc = null;
    this.harmonicOsc = null;
    this.masterGain = null;
    this.analyser = null;
    this.playing = false;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public getFrequency(): number {
    return this.currentHz;
  }

  public getWaveformData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.playing || !this.analyser) return false;
    this.analyser.getByteTimeDomainData(target);
    return true;
  }
}

export const solfeggioSynth = new SolfeggioSynthesizer();
