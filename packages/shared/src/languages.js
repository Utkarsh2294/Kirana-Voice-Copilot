export const languages = Object.freeze([
  { code: 'hi-IN', name: 'हिन्दी', script: 'Devanagari' },
  { code: 'bn-IN', name: 'বাংলা', script: 'Bengali' },
  { code: 'ta-IN', name: 'தமிழ்', script: 'Tamil' },
  { code: 'te-IN', name: 'తెలుగు', script: 'Telugu' },
  { code: 'gu-IN', name: 'ગુજરાતી', script: 'Gujarati' },
  { code: 'kn-IN', name: 'ಕನ್ನಡ', script: 'Kannada' },
  { code: 'ml-IN', name: 'മലയാളം', script: 'Malayalam' },
  { code: 'mr-IN', name: 'मराठी', script: 'Devanagari' },
  { code: 'pa-IN', name: 'ਪੰਜਾਬੀ', script: 'Gurmukhi' },
  { code: 'od-IN', name: 'ଓଡ଼ିଆ', script: 'Oriya' },
  { code: 'en-IN', name: 'English', script: 'Latin' },
]);

// Input capability is provisional; verify providers against their current docs in Phase 6.
export const extraInputLanguages = Object.freeze([
  'as-IN',
  'ur-IN',
  'ne-IN',
  'sa-IN',
  'ks-IN',
  'kok-IN',
  'mai-IN',
  'mni-IN',
  'brx-IN',
  'doi-IN',
  'sat-IN',
  'sd-IN',
]);
export const uiLanguageCodes = languages.map(({ code }) => code);
