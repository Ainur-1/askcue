import { app, utilityProcess, type UtilityProcess } from 'electron';
import path from 'node:path';

export class AudioTestService {
  private child: UtilityProcess | null = null;
  private cancelPending: (() => void) | null = null;

  constructor(private readonly onLevel: (level: number) => void, private readonly onError: (message: string) => void) {}

  start(deviceId?: string): Promise<{ fallbackUsed: boolean }> {
    this.stop();
    return new Promise((resolve, reject) => {
      const child = utilityProcess.fork(path.join(__dirname, 'audio-test-worker.js'), [app.getAppPath(), deviceId || ''], { serviceName: 'Pika microphone test', stdio: 'pipe' });
      child.stdout?.resume();
      child.stderr?.resume();
      this.child = child;
      let ready = false;
      const timeout = setTimeout(() => fail('Microphone test timed out. Try another input device.'), 8000);
      const clear = () => { clearTimeout(timeout); this.cancelPending = null; };
      const fail = (message: string) => {
        if (this.child !== child) return;
        clear();
        this.child = null; child.kill();
        if (!ready) reject(new Error(message)); else this.onError(message);
      };
      this.cancelPending = () => { clearTimeout(timeout); reject(new Error('Microphone test cancelled')); };
      child.on('message', (message: { type: string; level?: number; fallbackUsed?: boolean; message?: string }) => {
        if (this.child !== child) return;
        if (message.type === 'ready') { ready = true; clear(); resolve({ fallbackUsed: message.fallbackUsed === true }); }
        else if (message.type === 'level' && Number.isFinite(message.level)) this.onLevel(Math.max(0, Math.min(1, message.level!)));
        else if (message.type === 'error') fail(message.message || 'Microphone test failed');
      });
      child.on('exit', () => {
        if (this.child !== child) return;
        clear(); this.child = null;
        const message = 'Microphone test stopped unexpectedly. Try another input device.';
        if (!ready) reject(new Error(message)); else this.onError(message);
      });
    });
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    this.cancelPending?.(); this.cancelPending = null;
    child?.kill();
  }
}
