import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { uiLanguageCodes } from '@kirana/shared/languages';
import en from './locales/en-IN/common.json';
import hi from './locales/hi-IN/common.json';
import ta from './locales/ta-IN/common.json';

const namespaces = import.meta.glob('./locales/*/common.json', { eager: true, import: 'default' });
const resources = Object.fromEntries(
  uiLanguageCodes.map((code) => [
    code,
    { common: namespaces[`./locales/${code}/common.json`] || {} },
  ]),
);
resources['en-IN'] = { common: en };
resources['hi-IN'] = { common: hi };
resources['ta-IN'] = { common: ta };

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

function updateDocumentLanguage(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language.startsWith('ur') ? 'rtl' : 'ltr';
}
i18n.on('languageChanged', updateDocumentLanguage);
updateDocumentLanguage(i18n.language);
