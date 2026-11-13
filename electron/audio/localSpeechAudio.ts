/** Strict WAV parser for test files. RIFF PCM16 / float32, mono or stereo. */
export function readSpeechWave(buffer: Buffer): {samples: Float32Array; sampleRate: number} {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Select a PCM16 or float32 WAV file');
  let format = 0, channels = 0, sampleRate = 0, bits = 0, data: Buffer | undefined;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const size = buffer.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > buffer.length) throw new Error('Truncated WAV file');
    const kind = buffer.toString('ascii', offset, offset + 4);
    if (kind === 'fmt ' && size >= 16) { format = buffer.readUInt16LE(start); channels = buffer.readUInt16LE(start + 2); sampleRate = buffer.readUInt32LE(start + 4); bits = buffer.readUInt16LE(start + 14); }
    if (kind === 'data') data = buffer.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!data || ![1,2].includes(channels) || sampleRate < 8000 || sampleRate > 96000 || !((format === 1 && bits === 16) || (format === 3 && bits === 32))) throw new Error('Supported audio: PCM16 / float32 WAV, mono or stereo, 8–96 kHz');
  const stride = bits / 8, frames = Math.floor(data.length / stride / channels);
  if (frames < sampleRate / 10 || frames > sampleRate * 120) throw new Error('Choose a recording between 0.1 and 120 seconds');
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) {
    const offset = (i * channels + c) * stride;
    const value = format === 1 ? data.readInt16LE(offset) / 32768 : data.readFloatLE(offset);
    if (!Number.isFinite(value)) throw new Error('Invalid WAV sample');
    samples[i] += Math.max(-1, Math.min(1, value)) / channels;
  }
  return {samples, sampleRate};
}

export function pcm16Samples(buffer: Buffer, channels = 1): Float32Array {
  const result = new Float32Array(Math.floor(buffer.length / 2 / channels));
  for (let i = 0; i < result.length; i++) for (let c = 0; c < channels; c++) result[i] += buffer.readInt16LE((i * channels + c) * 2) / 32768 / channels;
  return result;
}
