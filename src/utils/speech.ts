import { getLetterForNumber } from '@/utils/constants';

// ─── Speech configuration ────────────────────────────────

export interface SpeechConfig {
  enabled: boolean;
  voiceURI: string | null;  // null = browser default
  rate: number;             // 0.5 - 2.0, default 0.9
  volume: number;           // 0.0 - 1.0, default 1.0
}

export const DEFAULT_SPEECH_CONFIG: SpeechConfig = {
  enabled: true,
  voiceURI: null,
  rate: 0.9,
  volume: 1.0,
};

// ─── Singleton speech manager ────────────────────────────

class BingoSpeech {
  private synth: SpeechSynthesis | null = null;
  private config: SpeechConfig = DEFAULT_SPEECH_CONFIG;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
      // Voices load async in some browsers
      this.synth.onvoiceschanged = () => {
        this.cachedVoices = this.synth?.getVoices() ?? [];
      };
      // Try to load immediately too
      this.cachedVoices = this.synth.getVoices();
    }
  }

  /** Update speech configuration */
  setConfig(config: Partial<SpeechConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SpeechConfig {
    return { ...this.config };
  }

  /** Get available voices, preferring Norwegian */
  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    // Refresh cache
    this.cachedVoices = this.synth.getVoices();
    return this.cachedVoices;
  }

  /** Get Norwegian voices (nb-NO, no-NO, nn-NO) */
  getNorwegianVoices(): SpeechSynthesisVoice[] {
    return this.getVoices().filter(
      (v) => v.lang.startsWith('nb') || v.lang.startsWith('no') || v.lang.startsWith('nn')
    );
  }

  /** Find the configured voice, or best Norwegian fallback */
  private resolveVoice(): SpeechSynthesisVoice | null {
    const voices = this.getVoices();
    if (voices.length === 0) return null;

    // Try configured voice
    if (this.config.voiceURI) {
      const match = voices.find((v) => v.voiceURI === this.config.voiceURI);
      if (match) return match;
    }

    // Fallback: prefer Norwegian
    const norwegian = this.getNorwegianVoices();
    if (norwegian.length > 0) return norwegian[0]!;

    // Last resort: default voice
    return null;
  }

  /** Cancel any ongoing speech immediately */
  cancel() {
    if (!this.synth) return;
    this.synth.cancel();
  }

  /** Speak text, cancelling any previous utterance first (queue-safe) */
  speak(text: string) {
    if (!this.synth || !this.config.enabled) return;

    // Cancel previous to avoid queue buildup
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.resolveVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'nb-NO';
    }
    utterance.rate = this.config.rate;
    utterance.volume = this.config.volume;

    this.synth.speak(utterance);
  }

  /** Announce a bingo number in Norwegian: "B 7" → "B. sju" */
  announceNumber(num: number) {
    const letter = getLetterForNumber(num);
    // Spell out for clarity
    this.speak(`${letter}. ${num}`);
  }

  /** Announce bingo claim */
  announceBingo(playerName: string) {
    this.speak(`Bingo! ${playerName} har ropt bingo!`);
  }

  /** Announce winner */
  announceWinner(playerName: string) {
    this.speak(`Vi har en vinner! Gratulerer ${playerName}!`);
  }

  /** Test voice with a sample */
  test() {
    this.speak('B. 7. Bingo!');
  }

  /** Check if speech synthesis is available */
  isAvailable(): boolean {
    return this.synth !== null;
  }
}

// Export singleton
export const bingoSpeech = new BingoSpeech();

// ─── Background music ────────────────────────────────────

class BackgroundMusic {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private playing = false;
  private interval: ReturnType<typeof setInterval> | null = null;

  /** Start ambient background music (simple generative tones) */
  start(volume = 0.08) {
    if (this.playing) return;
    this.playing = true;

    try {
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = volume;
      this.gainNode.connect(this.audioContext.destination);

      this.playChord();
      // Change chord every 4 seconds
      this.interval = setInterval(() => this.playChord(), 4000);
    } catch {
      this.playing = false;
    }
  }

  private playChord() {
    if (!this.audioContext || !this.gainNode) return;

    // Stop previous oscillators
    for (const osc of this.oscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.oscillators = [];

    // Simple pleasant chord frequencies (C major, F major, G major, Am)
    const chords = [
      [261.63, 329.63, 392.00], // C major
      [349.23, 440.00, 523.25], // F major
      [392.00, 493.88, 587.33], // G major
      [220.00, 261.63, 329.63], // A minor
    ];

    const chord = chords[Math.floor(Math.random() * chords.length)]!;

    for (const freq of chord) {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const noteGain = this.audioContext.createGain();
      noteGain.gain.value = 0;
      // Fade in
      noteGain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.5);
      // Fade out
      noteGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 3.8);

      osc.connect(noteGain);
      noteGain.connect(this.gainNode);
      osc.start();
      osc.stop(this.audioContext.currentTime + 4);

      this.oscillators.push(osc);
    }
  }

  /** Stop background music */
  stop() {
    this.playing = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    for (const osc of this.oscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.oscillators = [];
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.gainNode = null;
  }

  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }
}

export const backgroundMusic = new BackgroundMusic();
