import t from 'tap';
import { EventEmitter } from 'node:events';
import { mockRequire } from '../../node_modules/@tapjs/mock/dist/esm/mock-require.js';
import path from 'node:path';

class FakeChild extends EventEmitter {
  killed = false;
  kill() { this.killed = true; return true; }
}

t.test('audio test isolates crashes, ignores stale callbacks and cancels pending starts', async t => {
  const children: FakeChild[] = [];
  const levels: number[] = [];
  const errors: string[] = [];
  const { AudioTestService } = mockRequire(path.resolve('electron/audio/AudioTestService.ts'), {
    electron: { app: { getAppPath: () => '/app' }, utilityProcess: { fork: () => { const child = new FakeChild(); children.push(child); return child; } } },
  });
  const service = new AudioTestService((value: number) => levels.push(value), (message: string) => errors.push(message));
  const first = service.start('first');
  children[0].emit('message', { type: 'ready', fallbackUsed: false });
  t.same(await first, { fallbackUsed: false });
  children[0].emit('message', { type: 'level', level: .25 });
  t.same(levels, [.25]);
  children[0].emit('exit', 1);
  t.equal(errors.length, 1, 'driver exit becomes an error notification');

  const second = service.start();
  children[1].emit('message', { type: 'ready', fallbackUsed: true });
  t.same(await second, { fallbackUsed: true });
  service.stop();
  children[1].emit('message', { type: 'level', level: .9 });
  t.same(levels, [.25], 'stopped worker cannot publish levels');
  t.ok(children[1].killed);

  const third = service.start();
  const cancelled = t.rejects(third, /cancelled/);
  service.stop();
  await cancelled;
  const fourth = service.start();
  const failed = t.rejects(fourth, /stopped unexpectedly/);
  children[3].emit('exit', 1);
  await failed;
  service.stop();
});
