import i18n from './i18n.js';
import { formatINR } from '@kirana/shared/money';

export const money = (paise) => formatINR(paise, i18n.language);
export const number = (value, options = {}) =>
  new Intl.NumberFormat(i18n.language, options).format(value);
export const date = (value, options = {}) =>
  new Intl.DateTimeFormat(i18n.language, { timeZone: 'Asia/Kolkata', ...options }).format(value);
