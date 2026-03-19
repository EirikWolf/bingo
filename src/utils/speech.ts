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

const MUSIC_SRC = '/audio/background-music.mp3';

class BackgroundMusic {
  private audio: HTMLAudioElement | null = null;
  private playing = false;

  /** Start background music from MP3 file */
  start(volume = 0.15) {
    if (this.playing) return;

    try {
      if (!this.audio) {
        this.audio = new Audio(MUSIC_SRC);
        this.audio.loop = true;
        this.audio.preload = 'auto';
      }
      this.audio.volume = Math.max(0, Math.min(1, volume));
      this.audio.play().catch((err) => {
        console.warn('Could not start background music:', err);
      });
      this.playing = true;
    } catch {
      this.playing = false;
    }
  }

  /** Stop background music */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.playing = false;
  }

  /** Set playback volume (0.0 - 1.0) */
  setVolume(volume: number) {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }
}

export const backgroundMusic = new BackgroundMusic();
