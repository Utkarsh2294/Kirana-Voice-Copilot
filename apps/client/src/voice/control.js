import { create } from 'zustand';
import { usePreferences } from '../preferences.js';

export const useVoice = create(() => ({
  active: false,
  speech: 'idle',
  speechOwner: null,
  text: '',
  notice: '',
  cache: '',
  queue: [],
  capture: 'idle',
  partial: '',
  transcript: null,
  metrics: null,
  error: '',
  level: 0,
}));
let epoch = 0,
  cancelSpeech = () => {},
  owner = null;
const queued = [];
export const registerSpeechStop = (handler) => {
  cancelSpeech = handler;
};
export function stopSpeech() {
  epoch++;
  queued.length = 0;
  cancelSpeech();
  globalThis.speechSynthesis?.cancel();
  useVoice.setState({ speech: 'idle', queue: [] });
}
export function withSpeechOwner(id, action) {
  const previous = owner;
  owner = id;
  try {
    return action();
  } finally {
    owner = previous;
  }
}
async function play(text, options = {}, interrupt = true) {
  options = { ...options, lang: options.lang || usePreferences.getState().voiceLanguage };
  if (interrupt) stopSpeech();
  const id = ++epoch,
    selectedOwner = options.owner || owner;
  useVoice.setState({
    active: true,
    speech: 'loading',
    speechOwner: selectedOwner,
    notice: '',
    error: '',
  });
  try {
    const prepared =
      typeof text === 'function'
        ? text({ lang: options.lang || usePreferences.getState().voiceLanguage })
        : text;
    const [engine, resolved] = await Promise.all([import('./speak.js'), Promise.resolve(prepared)]);
    if (id !== epoch) return;
    await engine.playSpeech(resolved, options, () => id === epoch);
  } catch {
    if (id === epoch) useVoice.setState({ speech: 'error', error: 'unavailable' });
  } finally {
    if (id === epoch && queued.length) {
      const next = queued.shift();
      useVoice.setState({ queue: [...queued] });
      play(next.text, next.options, false);
    }
  }
}
export const speak = (text, options) => play(text, options);
export function enqueueSpeech(text, options = {}) {
  if (['idle', 'error'].includes(useVoice.getState().speech)) return play(text, options);
  options = { ...options, lang: options.lang || usePreferences.getState().voiceLanguage };
  let prepared;
  try {
    prepared = typeof text === 'function' ? text({ lang: options.lang }) : text;
  } catch {
    return;
  }
  queued.push({ text: Promise.resolve(prepared).catch(() => ''), options });
  useVoice.setState({ queue: [...queued] });
}
const captureStops = new Set();
export const registerCaptureStop = (handler) => {
  captureStops.add(handler);
  return () => captureStops.delete(handler);
};
export function cancelCapture() {
  for (const stop of captureStops) stop();
  useVoice.setState({ capture: 'idle', level: 0 });
}
export function closeVoice(preserveCapabilities = false) {
  stopSpeech();
  cancelCapture();
  useVoice.setState({
    active: false,
    partial: '',
    text: '',
    transcript: null,
    metrics: null,
    error: '',
    ...(preserveCapabilities ? {} : { capabilities: null }),
  });
}
