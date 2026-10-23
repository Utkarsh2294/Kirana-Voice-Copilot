import { startCapture } from './capture-control.js';
import { beforeEach, it, expect, vi } from 'vitest';
import { speak, stopSpeech, enqueueSpeech, useVoice, cancelCapture } from './control.js';
import { usePreferences } from '../preferences.js';
const engine = vi.hoisted(() => ({ playSpeech: vi.fn(async () => {}) }));
vi.mock('./speak.js', () => ({ playSpeech: (...args) => engine.playSpeech(...args) }));
beforeEach(async () => {
  await import('./speak.js');
  stopSpeech();
  engine.playSpeech.mockClear();
  usePreferences.setState({ voiceLanguage: 'en-IN' });
});
it('evaluates each dynamic readback at the press with the current voice language', async () => {
  let amount = 10;
  const snapshots = [];
  const first = speak(({ lang }) => {
    snapshots.push([amount, lang]);
    return `Total ${amount}`;
  });
  amount = 20;
  usePreferences.setState({ voiceLanguage: 'hi-IN' });
  const second = speak(({ lang }) => {
    snapshots.push([amount, lang]);
    return `Total ${amount}`;
  });
  await Promise.all([first, second]);
  expect(snapshots).toEqual([
    [10, 'en-IN'],
    [20, 'hi-IN'],
  ]);
});
it('queues readback in order and stop clears pending speech', async () => {
  let release;
  engine.playSpeech.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const first = speak('First');
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  enqueueSpeech('Second');
  expect(useVoice.getState().queue).toHaveLength(1);
  stopSpeech();
  release();
  await first;
  expect(useVoice.getState().queue).toEqual([]);
  expect(engine.playSpeech).toHaveBeenCalledTimes(1);
});
it('barge-in interrupts speech before requesting microphone resources', () => {
  const cancel = vi.fn();
  window.speechSynthesis = { cancel };
  window.isSecureContext = false;
  startCapture();
  expect(cancel).toHaveBeenCalled();
  expect(useVoice.getState().speech).toBe('idle');
  expect(useVoice.getState().error).toBe('insecure');
  cancelCapture();
});
