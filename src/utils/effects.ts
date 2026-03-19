import confetti from 'canvas-confetti';

// ─── Confetti effects ────────────────────────────────────

/** Fire confetti celebration for bingo win */
export function celebrateBingo(): void {
  const duration = 4000;
  const end = Date.now() + duration;

  // Initial burst from both sides
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.1, y: 0.6 },
    colors: ['#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#10b981'],
  });
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.9, y: 0.6 },
    colors: ['#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#10b981'],
  });

  // Continuous light shower
  const interval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(interval);
      return;
    }
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.5 },
      colors: ['#fbbf24', '#f59e0b'],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.5 },
      colors: ['#fbbf24', '#f59e0b'],
    });
  }, 150);
}

/** Big confetti burst for big screen */
export function celebrateBigScreen(): void {
  const duration = 6000;
  const end = Date.now() + duration;

  // Massive initial burst
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { y: 0.5 },
    colors: ['#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6'],
  });

  // Continuous rain
  const interval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(interval);
      return;
    }
    confetti({
      particleCount: 5,
      angle: 60 + Math.random() * 60,
      spread: 60,
      origin: { x: Math.random(), y: 0 },
      colors: ['#fbbf24', '#f59e0b', '#ef4444'],
    });
  }, 100);
}

// ─── Sound effects ───────────────────────────────────────

type SoundName = 'draw' | 'match' | 'nearBingo' | 'bingo' | 'fanfare';

class SoundEffects {
  private audioContext: AudioContext | null = null;
  private enabled = true;
  private volume = 0.5;

  private getContext(): AudioContext | null {
    if (!this.audioContext) {
      try {
        this.audioContext = new AudioContext();
      } catch {
        return null;
      }
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getVolume(): number {
    return this.volume;
  }

  /** Play a synthesized sound effect */
  play(name: SoundName): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Resume context if suspended (autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    switch (name) {
      case 'draw':
        this.playTone(ctx, 880, 0.08, 'sine');
        break;
      case 'match':
        this.playDoubleBeep(ctx);
        break;
      case 'nearBingo':
        this.playNearBingo(ctx);
        break;
      case 'bingo':
        this.playBingoFanfare(ctx);
        break;
      case 'fanfare':
        this.playBingoFanfare(ctx);
        break;
    }
  }

  private playTone(ctx: AudioContext, freq: number, duration: number, type: OscillatorType): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = this.volume * 0.3;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playDoubleBeep(ctx: AudioContext): void {
    // Two ascending tones for match
    const t = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.gain.value = this.volume * 0.25;
    osc1.type = 'sine';
    osc1.frequency.value = 660;
    osc2.type = 'sine';
    osc2.frequency.value = 880;

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(t);
    osc1.stop(t + 0.08);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.18);

    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  }

  private playNearBingo(ctx: AudioContext): void {
    // Suspenseful rising tones
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.4);
    gain.gain.value = this.volume * 0.2;
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  private playBingoFanfare(ctx: AudioContext): void {
    // Victory fanfare: C-E-G-C ascending
    const notes = [523, 659, 784, 1047];
    const t = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.value = this.volume * 0.15;

      const start = t + i * 0.15;
      gain.gain.setValueAtTime(this.volume * 0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }
}

export const soundEffects = new SoundEffects();
