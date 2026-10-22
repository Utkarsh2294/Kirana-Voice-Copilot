import { usePreferences } from './preferences.js';

export function feedback(kind = 'added') {
  const { haptics, earcons } = usePreferences.getState();
  if (haptics && navigator.vibrate)
    navigator.vibrate(kind === 'success' ? [20, 60, 20] : kind === 'error' ? [80, 40, 80] : 12);
  if (earcons && kind !== 'error') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = kind === 'success' ? 880 : 660;
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.1);
      oscillator.onended = () => context.close();
    } catch {
      /* Optional feedback must never block an edit. */
    }
  }
}
