import t from 'tap';
import { microphoneLevel } from '../../electron/audio/microphoneLevel';

t.test('audio test tolerates empty, short and odd-length PCM without a RangeError', t => {
  t.equal(microphoneLevel(Buffer.alloc(0)), 0);
  t.equal(microphoneLevel(Buffer.alloc(1)), 0);
  t.equal(microphoneLevel(Buffer.from([0, 0, 255])), 0);
  const chunk = Buffer.alloc(43);
  for (let index = 0; index + 1 < chunk.length; index += 2) chunk.writeInt16LE(5000, index);
  t.equal(microphoneLevel(chunk), .5);
  chunk.writeInt16LE(32767, 0);
  t.ok(microphoneLevel(chunk) <= 1);
  t.end();
});
