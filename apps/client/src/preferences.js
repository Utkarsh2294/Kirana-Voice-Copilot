import { create } from 'zustand';
import { uiLanguageCodes, voiceLanguageCodes } from '@kirana/shared/languages';

const defaults = {
  theme: 'dark',
  language: 'en-IN',
  reduceMotion: false,
  haptics: false,
  earcons: false,
  tourSeen: false,
  voiceLanguage: 'hi-IN',
  voicePreference: 'female',
  voiceMuted: false,
  voiceVolume: 0.8,
  voicePace: 0.95,
  voiceAutoDetect: false,
  voiceTranscriptOptIn: false,
};
const key = 'kirana-ui-preferences-v1';

export function validatePreferences(value) {
  const result = { ...defaults };
  if (!value || typeof value !== 'object') return result;
  if (['dark', 'day', 'auto'].includes(value.theme)) result.theme = value.theme;
  if (uiLanguageCodes.includes(value.language)) result.language = value.language;
  if (voiceLanguageCodes.includes(value.voiceLanguage)) result.voiceLanguage = value.voiceLanguage;
  if (['male', 'female'].includes(value.voicePreference))
    result.voicePreference = value.voicePreference;
  if (typeof value.voiceVolume === 'number' && value.voiceVolume >= 0 && value.voiceVolume <= 1)
    result.voiceVolume = value.voiceVolume;
  if (typeof value.voicePace === 'number' && value.voicePace >= 0.5 && value.voicePace <= 2)
    result.voicePace = value.voicePace;
  for (const field of [
    'reduceMotion',
    'haptics',
    'earcons',
    'tourSeen',
    'voiceMuted',
    'voiceAutoDetect',
    'voiceTranscriptOptIn',
  ])
    if (typeof value[field] === 'boolean') result[field] = value[field];
  return result;
}

function load() {
  try {
    return validatePreferences(JSON.parse(localStorage.getItem(key)));
  } catch {
    return { ...defaults };
  }
}

export const usePreferences = create((set, get) => ({
  ...load(),
  storageError: false,
  update: (changes) => {
    const next = validatePreferences({ ...get(), ...changes });
    let storageError = false;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      storageError = true;
    }
    set({ ...next, storageError });
  },
}));
