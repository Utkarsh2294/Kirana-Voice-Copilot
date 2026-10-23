import { PcmResampler } from '@kirana/shared/audio';
class KiranaPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.resampler = new PcmResampler(sampleRate, (bytes) =>
      this.port.postMessage(bytes.buffer, [bytes.buffer]),
    );
    this.port.onmessage = (event) => {
      if (event.data === 'flush') {
        this.resampler.flush();
        this.port.postMessage('flushed');
      }
    };
  }
  process(inputs) {
    if (inputs[0]?.[0]) this.resampler.push(inputs[0][0]);
    return true;
  }
}
registerProcessor('kirana-pcm16', KiranaPcm);
