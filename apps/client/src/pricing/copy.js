import i18n from '../i18n.js';
import en from './en.json';
i18n.addResourceBundle('en-IN', 'pricing', en, true, false);
let hindi;
function loadSelected(language) {
  if (language !== 'hi-IN' || hindi) return;
  hindi = import('./hi.json')
    .then((module) => {
      i18n.addResourceBundle('hi-IN', 'pricing', module.default, true, false);
      i18n.emit('languageChanged', i18n.language);
    })
    .catch(() => {
      hindi = null;
    });
}
i18n.on('languageChanged', loadSelected);
loadSelected(i18n.language);
