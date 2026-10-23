import { useEffect, useRef } from 'react';
import { useVoice, speak, stopSpeech, enqueueSpeech } from './control.js';
let screen = null;
export function useSpeak() {
  const state = useVoice((value) => value.speech),
    preview = useVoice((value) => value.text),
    queue = useVoice((value) => value.queue);
  return { speak, stop: stopSpeech, state, preview, queue, enqueue: enqueueSpeech };
}
export function useReadScreen(builder) {
  const latest = useRef(builder);
  latest.current = builder;
  useEffect(() => {
    const registered = (context) => latest.current(context);
    screen = registered;
    return () => {
      if (screen === registered) screen = null;
    };
  }, []);
}
export function readCurrentScreen() {
  const registered = screen;
  if (registered) return speak((context) => registered(context));
}
