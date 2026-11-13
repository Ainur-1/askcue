import { EventEmitter } from 'node:events';
import { SpeechWorker } from '../services/SpeechWorker';
import { pcm16Samples } from './localSpeechAudio';
import { RECOGNITION_LANGUAGES } from '../config/languages';

/** Bounded phrase buffering; all PCM remains on this computer. No cloud fallback. */
export class LocalSTT extends EventEmitter {
  private sampleRate = 16000;
  private channels = 1;
  private language = '';
  private running = false;
  private chunks: Buffer[] = [];
  private bytes = 0;
  private worker: SpeechWorker | null = null;
  private busy = false;
  private epoch = 0;
  constructor(private modelId: string, private directory: string) { super(); }
  setSampleRate(value: number): void { this.sampleRate = value; }
  setCredentials(_path: string): void { /* Google credentials do not apply to local recognition. */ }
  setAudioChannelCount(value: number): void { this.channels = Math.max(1, value); }
  setRecognitionLanguage(value: string): void {
    const next = value === 'auto' ? '' : RECOGNITION_LANGUAGES[value]?.iso639 || '';
    if (next === this.language) return;
    this.language = next;
    if (this.running) { this.stop(); this.start(); }
  }
  start(): void { if (this.running) return; this.running = true; this.epoch++; this.worker = new SpeechWorker(this.modelId, this.directory, this.language); }
  stop(): void { this.running = false; this.epoch++; this.chunks = []; this.bytes = 0; this.busy = false; this.worker?.close(); this.worker = null; }
  write(chunk: Buffer): void {
    if (!this.running) return;
    const limit = this.sampleRate * this.channels * 2 * 20;
    if (this.bytes + chunk.length > limit) {
      this.emit('error', new Error('Local recognition cannot keep up. Choose a smaller model.')); this.stop(); return;
    }
    this.chunks.push(Buffer.from(chunk)); this.bytes += chunk.length;
    if (this.bytes >= this.sampleRate * this.channels * 2 * 6) void this.flush();
  }
  notifySpeechEnded(): void { void this.flush(); }
  finalize(): void { void this.flush(); }
  private async flush(): Promise<void> {
    if (!this.running || this.busy || this.bytes < this.sampleRate * this.channels * 2 * 0.2) return;
    const samples = pcm16Samples(Buffer.concat(this.chunks), this.channels), epoch = this.epoch;
    // Skip silence rather than asking Whisper to hallucinate a transcript.
    let energy = 0; for (const sample of samples) energy += sample * sample;
    this.chunks = []; this.bytes = 0;
    if (Math.sqrt(energy / samples.length) < 0.002) return;
    this.busy = true;
    try {
      const result = await this.worker!.recognize(samples, this.sampleRate);
      if (this.running && epoch === this.epoch && result.text) this.emit('transcript', {text: result.text, isFinal: true, confidence: 0, boundary: true, detectedLanguage: this.modelId === 'zipformer-ru' ? 'ru' : this.language || undefined});
    } catch (error) { if (this.running && epoch === this.epoch) this.emit('error', error instanceof Error ? error : new Error(String(error))); }
    finally { if (epoch === this.epoch) { this.busy = false; if (this.bytes >= this.sampleRate * this.channels * 2 * 0.2) void this.flush(); } }
  }
}
