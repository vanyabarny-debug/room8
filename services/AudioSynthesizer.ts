
class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private nextStepTime: number = 0;
  private reverbBuffer: AudioBuffer | null = null;

  constructor() {
    // Lazy init
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Critical: Always try to resume if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn("Audio resume failed", e));
    }
    // Generate Reverb Impulse Response - Long, smooth tail (Vista style)
    if (!this.reverbBuffer && this.ctx) {
        this.reverbBuffer = this.createImpulseResponse(3.5, 2.0); 
    }
  }

  // Generate a procedural reverb impulse (White noise with exponential decay)
  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
      const sampleRate = this.ctx!.sampleRate;
      const length = sampleRate * duration;
      const impulse = this.ctx!.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
          const n = i; 
          // Exponential decay
          const env = Math.pow(1 - n / length, decay);
          // White noise * envelope
          left[i] = (Math.random() * 2 - 1) * env;
          right[i] = (Math.random() * 2 - 1) * env;
      }
      return impulse;
  }

  // --- Game Sounds ---

  playFootstep() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (now < this.nextStepTime) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Randomize pitch slightly for realism
    osc.frequency.value = 150 + Math.random() * 50;
    osc.type = 'triangle';

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.start(now);
    osc.stop(now + 0.1);

    this.nextStepTime = now + 0.35; // Step interval
  }

  playCreatureHit() {
      this.init();
      if(!this.ctx) return;
      const t = this.ctx.currentTime;

      // 1. Thud (Impact)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      osc.type = 'square'; // Crunchier sound
      
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      
      osc.start(t);
      osc.stop(t + 0.1);

      // 2. Squeak (Pain)
      const sqOsc = this.ctx.createOscillator();
      const sqGain = this.ctx.createGain();
      sqOsc.connect(sqGain);
      sqGain.connect(this.ctx.destination);

      sqOsc.frequency.setValueAtTime(800 + Math.random() * 200, t);
      sqOsc.frequency.linearRampToValueAtTime(1200, t + 0.05);
      sqOsc.type = 'sine';

      sqGain.gain.setValueAtTime(0.05, t);
      sqGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      sqOsc.start(t);
      sqOsc.stop(t + 0.15);
  }

  // --- UI Sounds ---

  playUiClick() {
    // Silenced per request
  }

  playUiHover() {
    // Silenced per request
  }

  playUiSuccess() {
    // "Glass Tap" - Dry, Short, Interval (No Reverb)
    this.init();
    if(!this.ctx) return;
    const t = this.ctx.currentTime;

    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.15; // Moderate volume for high pitch
    masterGain.connect(this.ctx.destination);

    // Interval: C6 (1046.5) -> G6 (1568.0) - Perfect 5th
    const freqs = [1046.50, 1567.98];

    freqs.forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'sine'; // Sine is best for "Glass"
        osc.frequency.value = f;
        
        // 60ms delay between notes
        const start = t + (i * 0.06);
        
        gain.gain.setValueAtTime(0, start);
        // Sharp attack (tap)
        gain.gain.linearRampToValueAtTime(1, start + 0.005); 
        // Quick decay
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15); 

        osc.connect(gain).connect(masterGain);
        osc.start(start);
        osc.stop(start + 0.2);
    });
  }

  playReactionPop() {
      // Simple bubble pop for reactions
      this.init();
      if(!this.ctx) return;
      const t = this.ctx.currentTime;
      const vol = 0.1; // Slightly louder

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      
      osc.start(t);
      osc.stop(t + 0.1);
  }

  playNote(freq: number) {
      this.init();
      if(!this.ctx) return;
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Reverb Send
      const reverbGain = this.ctx.createGain();
      reverbGain.gain.value = 0.4;
      const convolver = this.ctx.createConvolver();
      if(this.reverbBuffer) convolver.buffer = this.reverbBuffer;

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      gain.connect(reverbGain);
      reverbGain.connect(convolver);
      convolver.connect(this.ctx.destination);

      osc.type = 'sine'; // Soft tone
      osc.frequency.setValueAtTime(freq, t);

      // ADSR
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.05); // Attack
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0); // Decay

      osc.start(t);
      osc.stop(t + 1.0);
  }

  playZoneEnter(zoneName: string) {
      this.init();
      if(!this.ctx) return;
      const t = this.ctx.currentTime;
      
      // Ambient swell
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 1.5);
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.03, t + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
      
      osc.start(t);
      osc.stop(t + 2.0);
  }
}

export const audioSynth = new AudioSynthesizer();
