import { uiLanguageCodes, voiceLanguageCodes } from './languages.js';
export { voiceLanguageCodes } from './languages.js';

export const sarvamVoices = [
  'shubh',
  'aditya',
  'ritu',
  'priya',
  'neha',
  'rahul',
  'pooja',
  'rohan',
  'simran',
  'kavya',
  'amit',
  'dev',
  'ishita',
  'shreya',
  'ratan',
  'varun',
  'manan',
  'sumit',
  'roopa',
  'kabir',
  'aayan',
  'ashutosh',
  'advait',
  'anand',
  'tanya',
  'tarun',
  'sunny',
  'mani',
  'gokul',
  'vijay',
  'shruti',
  'suhani',
  'mohit',
  'kavitha',
  'rehan',
  'soham',
  'rupali',
];
export const voiceCapabilities = Object.fromEntries(
  voiceLanguageCodes.map((code) => [
    code,
    {
      stt: ['sarvam'],
      tts: uiLanguageCodes.includes(code) ? ['sarvam'] : [],
      voices: uiLanguageCodes.includes(code) ? { male: 'shubh', female: 'ishita' } : {},
      pace: 0.95,
      sttLanguage: code === 'od-IN' ? 'or-IN' : code,
      restLanguage: code,
    },
  ]),
);
export const normaliseSpeechText = (text) =>
  String(text).normalize('NFC').replace(/\s+/gu, ' ').trim();
export function splitSpeech(text, limit = 500, lang = 'en-IN') {
  const normalized = normaliseSpeechText(text),
    result = [];
  const sentences =
    typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter(lang, { granularity: 'sentence' }).segment(normalized)].map(
          (part) => part.segment,
        )
      : normalized.split(/(?<=[.!?।])\s+/u);
  let current = '';
  for (const sentence of sentences) {
    let rest = sentence.trim();
    if (current && current.length + rest.length + 1 <= limit) {
      current += ` ${rest}`;
      continue;
    }
    if (current) {
      result.push(current);
      current = '';
    }
    while (rest.length > limit) {
      let end = rest.lastIndexOf(' ', limit);
      if (end < 1) end = limit;
      if (/[\uDC00-\uDFFF]/u.test(rest[end])) end--;
      result.push(rest.slice(0, end));
      rest = rest.slice(end).trimStart();
    }
    current = rest;
  }
  if (current) result.push(current);
  return result;
}

export function voiceFallbackOrder(
  lang,
  { sarvam = false, bhashini = false, browser = false, kind = 'tts' } = {},
) {
  const capability = voiceCapabilities[lang];
  return [
    sarvam && capability?.[kind].includes('sarvam') ? 'sarvam' : null,
    bhashini ? 'bhashini' : null,
    browser ? 'browser' : null,
  ].filter(Boolean);
}
export const toAppLanguage = (lang) => (lang === 'or-IN' ? 'od-IN' : lang);
