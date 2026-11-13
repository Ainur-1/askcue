import { fork, type ChildProcess, type ForkOptions } from 'node:child_process';
import path from 'node:path';
import type { SpeechTestResult } from '../../shared/localSpeech';

/** Native inference is isolated in a child process, so a model error cannot crash the UI. */
export class SpeechWorker {
  private child: ChildProcess | null = null;
  private sequence = 0;
  private pending = new Map<number, {resolve: (value: SpeechTestResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  constructor(private modelId: string, private directory: string, private language: string) {}
  recognize(samples: Float32Array, sampleRate: number): Promise<SpeechTestResult> {
    if (!this.child) {
      const options: ForkOptions & {windowsHide: boolean} = {
        execArgv: [], env: {...process.env, ELECTRON_RUN_AS_NODE: '1'}, windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'], serialization: 'advanced',
      };
      const child = fork(path.join(__dirname, '../workers/local-speech.js'), [], options);
      this.child = child;
      child.on('message', (message: any) => {
        const request = this.pending.get(message.id);
        if (!request) return;
        clearTimeout(request.timer); this.pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error)); else request.resolve(message.result);
      });
      child.on('error', error => this.close(error));
      child.on('exit', () => { if (this.child === child) { this.child = null; this.fail(new Error('Local recognition worker stopped')); } });
      // Drain stderr. Raw engine diagnostics are not displayed as application copy.
      child.stderr?.on('data', () => {});
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.close(new Error('Local recognition timed out')); }, 120_000);
      this.pending.set(id, {resolve, reject, timer});
      this.child!.send({id, modelId: this.modelId, directory: this.directory, language: this.language, samples, sampleRate}, error => { if (error) this.close(error); });
    });
  }
  private fail(error: Error): void {
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
  }
  close(error = new Error('Local recognition cancelled')): void {
    const child = this.child; this.child = null; child?.kill(); this.fail(error);
  }
}
