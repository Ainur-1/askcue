/** Sparse RMS over signed 16-bit PCM, including short/odd final buffers. */
export function microphoneLevel(chunk: Buffer): number {
  let energy = 0;
  let count = 0;
  for (let offset = 0; offset + 1 < chunk.length; offset += 20) {
    const value = chunk.readInt16LE(offset);
    energy += value * value;
    count++;
  }
  return count ? Math.min(Math.sqrt(energy / count) / 10000, 1) : 0;
}
