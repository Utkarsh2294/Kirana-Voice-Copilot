import { create } from 'zustand';
import { uiLanguageCodes } from '@kirana/shared/languages';

const defaults = {
  theme: 'dark',
  language: 'en-IN',
  reduceMotion: false,
  haptics: false,
  earcons: false,
  tourSeen: false,
};
const key = 'kirana-ui-preferences-v1';

export function validatePreferences(value) {
  const result = { ...defaults };
  if (!value || typeof value !== 'object') return result;
  if (['dark', 'day', 'auto'].includes(value.theme)) result.theme = value.theme;
  if (uiLanguageCodes.includes(value.language)) result.language = value.language;
  for (const field of ['reduceMotion', 'haptics', 'earcons', 'tourSeen'])
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
