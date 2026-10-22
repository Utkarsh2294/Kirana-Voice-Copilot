import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { uiLanguageCodes } from '@kirana/shared/languages';
import en from './locales/en-IN/common.json';
const namespaces = import.meta.glob(['./locales/*/common.json', '!./locales/en-IN/common.json']);
const resources = Object.fromEntries(uiLanguageCodes.map((code) => [code, { common: {} }]));
resources['en-IN'] = { common: en };

i18n.use(initReactI18next).init({
  resources,
  lng: 'en-IN',
  fallbackLng: 'en-IN',
  supportedLngs: uiLanguageCodes,
  load: 'currentOnly',
  ns: ['common'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});
export default i18n;

let selection = 0;
const loaded = new Set(['en-IN']);
export async function selectLanguage(language) {
  if (!uiLanguageCodes.includes(language)) return;
  const request = ++selection;
  if (!loaded.has(language)) {
    try {
      const module = await namespaces[`./locales/${language}/common.json`]();
      i18n.addResourceBundle(language, 'common', module.default, true, true);
      loaded.add(language);
    } catch {
      /* English fallback remains usable if a language chunk cannot load. */
    }
  }
  if (request === selection) await i18n.changeLanguage(language);
}

function updateDocumentLanguage(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language.startsWith('ur') ? 'rtl' : 'ltr';
}
i18n.on('languageChanged', updateDocumentLanguage);
updateDocumentLanguage(i18n.language);
