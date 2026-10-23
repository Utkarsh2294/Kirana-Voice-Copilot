import { expect, it } from 'vitest';
import {
  voiceCapabilities,
  voiceFallbackOrder,
  splitSpeech,
  normaliseSpeechText,
  toAppLanguage,
} from './voice.js';
import { PcmResampler, pcm16, wavFromPcm } from './audio.js';
it('distinguishes 23 input languages from 11 cloud output languages and preserves Odia protocol mapping', () => {
  expect(Object.keys(voiceCapabilities)).toHaveLength(23);
  expect(Object.values(voiceCapabilities).filter((row) => row.tts.length)).toHaveLength(11);
  expect(voiceCapabilities['od-IN'].sttLanguage).toBe('or-IN');
  expect(toAppLanguage('or-IN')).toBe('od-IN');
  expect(voiceFallbackOrder('hi-IN', { sarvam: true, bhashini: true, browser: true })).toEqual([
    'sarvam',
    'bhashini',
    'browser',
  ]);
  expect(voiceFallbackOrder('as-IN', { sarvam: true, bhashini: true, browser: true })).toEqual([
    'bhashini',
    'browser',
  ]);
  expect(voiceFallbackOrder('unsupported', { sarvam: true })).toEqual([]);
});
it('splits sentence and long-token input without duplicating or losing text', () => {
  const text = 'Hello. ' + 'x'.repeat(1500) + ' नमस्ते। ' + 'word '.repeat(100);
  const chunks = splitSpeech(text, 500);
  expect(chunks.every((chunk) => chunk.length <= 500)).toBe(true);
  expect(chunks.join('').replace(/\s/gu, '')).toBe(normaliseSpeechText(text).replace(/\s/gu, ''));
  expect(splitSpeech('  One   kilo. Two litres. ', 20)).toEqual(['One kilo.', 'Two litres.']);
});
it('resamples statefully across worklet blocks and emits little-endian PCM16 and valid WAV', () => {
  for (const rate of [8000, 16000, 44100, 48000]) {
    const blocks = [],
      resampler = new PcmResampler(rate, (block) => blocks.push(block));
    for (let offset = 0; offset < rate; offset += 128)
      resampler.push(new Float32Array(Math.min(128, rate - offset)).fill(0.5));
    resampler.flush();
    const count = blocks.reduce((sum, block) => sum + block.length / 2, 0);
    expect(Math.abs(count - 16000)).toBeLessThanOrEqual(1);
  }
  const pcm = pcm16([-1, 0, 1]),
    view = new DataView(pcm.buffer);
  expect([view.getInt16(0, true), view.getInt16(2, true), view.getInt16(4, true)]).toEqual([
    -32768, 0, 32767,
  ]);
  const wav = wavFromPcm(pcm);
  expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF');
  expect(new DataView(wav.buffer).getUint32(40, true)).toBe(6);
  expect(() => wavFromPcm(new Uint8Array(480002))).toThrow();
});
