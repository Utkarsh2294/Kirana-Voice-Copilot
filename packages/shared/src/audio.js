export function pcm16(samples) {
  const bytes = new Uint8Array(samples.length * 2),
    view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}
export function wavFromPcm(bytes, sampleRate = 16000) {
  if (bytes.length % 2 || bytes.length > 480000)
    throw new RangeError('Audio must be at most 15 seconds of mono PCM16');
  const wav = new Uint8Array(44 + bytes.length),
    view = new DataView(wav.buffer);
  const put = (offset, text) =>
    [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  put(0, 'RIFF');
  view.setUint32(4, 36 + bytes.length, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  put(36, 'data');
  view.setUint32(40, bytes.length, true);
  wav.set(bytes, 44);
  return wav;
}
// Stateful averaging resampler: fractional frame position survives worklet blocks.
export class PcmResampler {
  constructor(rate, emit, chunkSize = 3200) {
    this.ratio = rate / 16000;
    this.emit = emit;
    this.chunkSize = chunkSize;
    this.position = 0;
    this.sum = 0;
    this.count = 0;
    this.output = [];
  }
  push(input) {
    for (const sample of input) {
      this.sum += sample;
      this.count++;
      this.position++;
      if (this.position >= this.ratio) {
        const value = this.sum / this.count;
        while (this.position >= this.ratio) {
          this.output.push(value);
          this.position -= this.ratio;
          if (this.output.length === this.chunkSize) {
            this.emit(pcm16(this.output));
            this.output = [];
          }
        }
        this.sum = 0;
        this.count = 0;
      }
    }
  }
  flush() {
    if (this.output.length) {
      this.emit(pcm16(this.output));
      this.output = [];
    }
  }
}
