
class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private nextStepTime: number = 0;

  constructor() {
    // Lazy init
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
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

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);

    this.nextStepTime = now + 0.35; // Step interval
  }

  // --- UI Sounds ---

  private playTone(freqStart: number, freqEnd: number, duration: number, type: OscillatorType, vol: number) {
      this.init();
      if(!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, t);
      if (freqStart !== freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
      }
      
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      
      osc.start(t);
      osc.stop(t + duration);
  }

  playUiClick() {
    // High pitched pleasant blip
    this.playTone(600, 800, 0.15, 'sine', 0.1);
  }

  playUiHover() {
    // Very subtle, quiet tick
    this.playTone(400, 400, 0.05, 'sine', 0.02);
  }

  playUiSuccess() {
    // Ascending major third
    this.init();
    if(!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Note 1
    const osc1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    osc1.connect(g1);
    g1.connect(this.ctx.destination);
    osc1.frequency.value = 440; // A4
    g1.gain.setValueAtTime(0.1, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc1.start(t);
    osc1.stop(t + 0.3);

    // Note 2
    const osc2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc2.connect(g2);
    g2.connect(this.ctx.destination);
    osc2.frequency.value = 554.37; // C#5
    g2.gain.setValueAtTime(0.1, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.4);
  }

  playReactionPop() {
      // Fun cheerful major chord arpeggio
      this.init();
      if(!this.ctx) return;
      const t = this.ctx.currentTime;
      const vol = 0.05;

      [523.25, 659.25, 783.99].forEach((freq, i) => { // C5, E5, G5
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          
          const start = t + i * 0.05;
          osc.frequency.value = freq;
          osc.type = 'sine';
          
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(vol, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
          
          osc.start(start);
          osc.stop(start + 0.3);
      });
  }
}

export const audioSynth = new AudioSynthesizer();
