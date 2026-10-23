import { normaliseSpeechText, voiceCapabilities, splitSpeech } from '@kirana/shared/voice';
import { usePreferences } from '../preferences.js';
import { api } from '../api.js';
import { useVoice, registerSpeechStop, stopSpeech } from './control.js';
import { useDraftBill } from '../pricing/draft.js';

let audio = null,
  controller = null,
  objectUrl = null,
  finishDevice = null;
const notified = new Set();
function stop() {
  finishDevice?.();
  finishDevice = null;
  controller?.abort();
  if (audio) {
    audio.pause();
    audio.src = '';
    audio = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}
registerSpeechStop(stop);
function deviceVoice(lang) {
  const voices = window.speechSynthesis?.getVoices() || [],
    base = lang === 'od-IN' ? 'or' : lang.split('-')[0];
  return (
    voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find((voice) => voice.lang.split('-')[0] === base)
  );
}
export async function browserSpeak(text, { lang, pace, volume }, isCurrent) {
  const synth = window.speechSynthesis;
  if (!synth) throw new Error('unavailable');
  let voice = deviceVoice(lang);
  if (!voice)
    await new Promise((resolve) => {
      const timer = setTimeout(done, 700);
      function done() {
        clearTimeout(timer);
        synth.removeEventListener('voiceschanged', done);
        resolve();
      }
      synth.addEventListener('voiceschanged', done, { once: true });
    });
  voice = deviceVoice(lang);
  if (!voice) throw new Error('unsupported');
  if (!isCurrent()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.voice = voice;
  utterance.rate = pace;
  utterance.volume = volume;
  useVoice.setState({
    speech: 'playing',
    notice: notified.has(lang) ? '' : 'browserOutput',
    cache: '',
  });
  notified.add(lang);
  await new Promise((resolve, reject) => {
    finishDevice = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(
      () => {
        synth.cancel();
        reject(new Error('timeout'));
      },
      Math.min(300000, Math.max(30000, text.length * 130)),
    );
    utterance.onend = () => {
      clearTimeout(timer);
      resolve();
    };
    utterance.onerror = (event) => {
      clearTimeout(timer);
      if (event.error === 'canceled' || event.error === 'interrupted') resolve();
      else reject(new Error('unavailable'));
    };
    synth.speak(utterance);
  });
}
const cacheName = (owner) => `kirana-voice-${owner}`;
export async function voiceCacheKey(text, options) {
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      'bulbul:v3',
      options.lang,
      options.voice,
      options.pace,
      options.format || 'mp3',
      normaliseSpeechText(text),
    ]),
  );
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
async function audioFor(text, options, signal, prewarm = false) {
  const owner = usePreferences.getState().voiceMerchantId;
  if (!owner) throw new Error('notSignedIn');
  const key = await voiceCacheKey(text, options),
    url = `${location.origin}/api/v1/voice/cache/${owner}/${key}`;
  const clientBillId =
    !prewarm && useDraftBill.getState().merchantId === owner
      ? useDraftBill.getState().clientBillId
      : undefined;
  let cache;
  try {
    cache = await caches.open(cacheName(owner));
    const match = await cache.match(url);
    if (match) {
      const serverKey = match.headers.get('x-voice-key');
      if (serverKey && !prewarm)
        api('/voice/cache-hit', {
          method: 'POST',
          body: { key: serverKey, characters: text.length, clientBillId },
        }).catch(() => {});
      return {
        blob: await match.blob(),
        cache: 'browser',
        provider: match.headers.get('x-voice-provider'),
      };
    }
  } catch {
    /* Online playback works without Cache Storage. */
  }
  const response = await api('/voice/tts', {
    method: 'POST',
    body: {
      text,
      ...options,
      clientBillId,
    },
    signal,
    responseType: 'response',
  });
  const blob = await response.blob();
  signal.throwIfAborted();
  if (cache)
    try {
      await cache.put(
        url,
        new Response(blob, {
          headers: {
            'Content-Type': blob.type,
            'x-voice-provider': response.headers.get('x-voice-provider') || 'sarvam',
            'x-voice-key': response.headers.get('x-voice-key') || '',
          },
        }),
      );
      const keys = await cache.keys();
      for (const old of keys.slice(0, Math.max(0, keys.length - 50))) await cache.delete(old);
    } catch {
      /* Playback remains available if a cache write fails. */
    }
  return {
    blob,
    cache: response.headers.get('x-voice-cache') === 'hit' ? 'server' : 'miss',
    provider: response.headers.get('x-voice-provider'),
  };
}
export async function playSpeech(builder, options = {}, isCurrent = () => true) {
  const prefs = usePreferences.getState(),
    lang = options.lang || prefs.voiceLanguage || prefs.language;
  const text = normaliseSpeechText(
    typeof builder === 'function' ? await builder({ lang }) : builder,
  );
  if (!text || !isCurrent()) return;
  useVoice.setState({ text });
  if (prefs.voiceMuted) {
    useVoice.setState({ speech: 'idle', notice: 'muted' });
    return;
  }
  const pace = options.pace ?? prefs.voicePace ?? 0.95,
    voice =
      options.voice ||
      voiceCapabilities[lang]?.voices[prefs.voicePreference || 'female'] ||
      'ishita';
  controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
  try {
    for (const chunk of splitSpeech(text, 6000, lang)) {
      const result = await audioFor(chunk, { lang, voice, pace, format: 'mp3' }, signal);
      if (!isCurrent()) return;
      objectUrl = URL.createObjectURL(result.blob);
      audio = new Audio(objectUrl);
      audio.volume = prefs.voiceVolume ?? 0.8;
      useVoice.setState({
        speech: 'playing',
        cache: result.cache,
        notice: result.provider === 'bhashini' && !notified.has(lang) ? 'bhashiniOutput' : '',
      });
      if (result.provider === 'bhashini') notified.add(lang);
      await new Promise((resolve, reject) => {
        const target = audio;
        target.onended = resolve;
        target.onerror = () => reject(new Error('playback'));
        signal.addEventListener(
          'abort',
          () => {
            target.pause();
            resolve();
          },
          { once: true },
        );
        target.play().catch(() => reject(new Error('playback')));
      });
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      audio = null;
      if (!isCurrent()) return;
    }
    useVoice.setState({ speech: 'idle' });
  } catch {
    if (!isCurrent() || signal.aborted) return;
    if (audio) {
      audio.pause();
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    try {
      await browserSpeak(text, { lang, pace, volume: prefs.voiceVolume ?? 0.8 }, isCurrent);
      if (isCurrent()) useVoice.setState({ speech: 'idle' });
    } catch {
      if (isCurrent())
        useVoice.setState({ speech: 'error', error: 'outputUnavailable', notice: 'textAvailable' });
    }
  }
}
export async function clearVoiceCache(owner) {
  if (owner && typeof caches !== 'undefined') await caches.delete(cacheName(owner));
}
export async function prewarmSpeech(lang, phrases) {
  const prefs = usePreferences.getState();
  if (!prefs.voiceMerchantId || prefs.voiceMuted) return;
  for (const text of phrases)
    try {
      await audioFor(
        text,
        {
          lang,
          voice: voiceCapabilities[lang]?.voices[prefs.voicePreference || 'female'] || 'ishita',
          pace: prefs.voicePace ?? 0.95,
          format: 'mp3',
        },
        AbortSignal.timeout(15000),
        true,
      );
    } catch {
      return;
    }
}
usePreferences.subscribe((prefs) => {
  if (prefs.voiceMuted) stopSpeech();
  else if (audio) audio.volume = prefs.voiceVolume ?? 0.8;
});
