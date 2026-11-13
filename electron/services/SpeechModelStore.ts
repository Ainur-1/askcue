import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { SPEECH_MODELS, getSpeechModel, type SpeechAsset, type SpeechModelStatus } from '../../shared/localSpeech';

/** Only catalog IDs are accepted: a renderer never supplies a URL or filesystem path. */
export class SpeechModelStore extends EventEmitter {
  private jobs = new Map<string, { controller: AbortController; done: Promise<void> }>();
  private phases = new Map<string, SpeechModelStatus>();
  constructor(readonly root: string, private fetchFile: typeof fetch = fetch) { super(); }

  directory(id: string): string { getSpeechModel(id); return path.join(this.root, id); }
  private size(file: string): number { try { return fs.statSync(file).size; } catch { return 0; } }
  isInstalled(id: string): boolean {
    const model = getSpeechModel(id), dir = this.directory(id);
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'installed.json'), 'utf8'));
      return model.files.every(file => manifest[file.name] === file.sha256 && this.size(path.join(dir, file.name)) === file.bytes);
    } catch { return false; }
  }
  status(id: string): SpeechModelStatus {
    const model = getSpeechModel(id), dir = this.directory(id), phase = this.phases.get(id);
    const received = model.files.reduce((sum, file) => sum + (this.size(path.join(dir, file.name)) || this.size(path.join(dir, file.name + '.part'))), 0);
    return { id, phase: this.isInstalled(id) ? 'installed' : phase?.phase || (received ? 'paused' : 'available'), received, total: model.files.reduce((sum, file) => sum + file.bytes, 0), ...(phase?.error ? {error: phase.error} : {}) };
  }
  statuses(): SpeechModelStatus[] { return SPEECH_MODELS.map(model => this.status(model.id)); }
  private publish(id: string, phase: SpeechModelStatus['phase'], error?: string): void {
    this.phases.set(id, {id, phase, received: 0, total: 0, error});
    this.emit('change');
  }
  async verify(id: string): Promise<void> {
    if (!this.isInstalled(id)) throw new Error('Download the model first');
    for (const file of getSpeechModel(id).files) {
      if (!(await this.matches(path.join(this.directory(id), file.name), file))) throw new Error('Model file is damaged. Remove it and download again.');
    }
  }
  private async matches(filename: string, asset: SpeechAsset): Promise<boolean> {
    if (this.size(filename) !== asset.bytes) return false;
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
    return hash.digest('hex') === asset.sha256;
  }
  download(id: string): void {
    getSpeechModel(id);
    if (this.jobs.has(id) || this.isInstalled(id)) return;
    const controller = new AbortController();
    // Defer work until the job is registered, including synchronous filesystem errors.
    const done = Promise.resolve().then(() => this.run(id, controller.signal)).catch(error => {
      this.publish(id, controller.signal.aborted ? 'paused' : 'error', controller.signal.aborted ? undefined : String(error.message || error));
    }).finally(() => { this.jobs.delete(id); this.emit('change'); });
    this.jobs.set(id, {controller, done});
    this.publish(id, 'downloading');
  }
  async pause(id: string): Promise<void> {
    getSpeechModel(id);
    const job = this.jobs.get(id);
    if (job) { job.controller.abort(); await job.done; }
  }
  async remove(id: string): Promise<void> {
    await this.pause(id);
    // directory validates an allowlisted ID and is always an immediate child of root.
    await fs.promises.rm(this.directory(id), {recursive: true, force: true});
    this.phases.delete(id); this.emit('change');
  }
  async close(): Promise<void> { await Promise.all([...this.jobs.keys()].map(id => this.pause(id))); }
  private async run(id: string, signal: AbortSignal): Promise<void> {
    const model = getSpeechModel(id), dir = this.directory(id);
    await fs.promises.mkdir(dir, {recursive: true});
    for (const file of model.files) {
      signal.throwIfAborted();
      const final = path.join(dir, file.name), partial = final + '.part';
      if (await this.matches(final, file)) continue;
      await fs.promises.rm(final, {force: true});
      let offset = this.size(partial);
      if (offset > file.bytes) { await fs.promises.rm(partial, {force: true}); offset = 0; }
      if (offset < file.bytes) {
        const response = await this.fetchFile(file.url, {signal, headers: offset ? {Range: `bytes=${offset}-`} : {}});
        if (!response.ok || !response.body) throw new Error(`Download failed (HTTP ${response.status})`);
        if (response.status === 206 && !response.headers.get('content-range')?.startsWith(`bytes ${offset}-`)) throw new Error('Invalid download resume response');
        const append = offset > 0 && response.status === 206;
        let written = append ? offset : 0, lastProgress = 0;
        const source = Readable.fromWeb(response.body as any);
        source.on('data', (chunk: Buffer) => {
          written += chunk.length;
          if (written > file.bytes) source.destroy(new Error('Download exceeded expected model size'));
          if (Date.now() - lastProgress > 150) { lastProgress = Date.now(); this.emit('change'); }
        });
        await pipeline(source, fs.createWriteStream(partial, {flags: append ? 'a' : 'w'}), {signal});
      }
      signal.throwIfAborted(); this.publish(id, 'verifying');
      if (!(await this.matches(partial, file))) {
        await fs.promises.rm(partial, {force: true});
        throw new Error('Model checksum mismatch. Please retry the download.');
      }
      await fs.promises.rename(partial, final);
      this.publish(id, 'downloading');
    }
    signal.throwIfAborted();
    await fs.promises.writeFile(path.join(dir, 'installed.json'), JSON.stringify(Object.fromEntries(model.files.map(file => [file.name, file.sha256]))));
    this.publish(id, 'installed');
  }
}
