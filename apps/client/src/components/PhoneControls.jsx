import React, { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { number } from '../format.js';

export function PhoneInput({ value, onChange, disabled = false }) {
  const { t } = useTranslation();
  const id = useId();
  const invalid = value.length > 0 && !/^[6-9]\d{9}$/.test(value);
  return (
    <div className="field">
      <label htmlFor={id}>{t('controls.phone')}</label>
      <div className="phone-input">
        <span aria-hidden="true">+91</span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          disabled={disabled}
          maxLength={10}
          placeholder={t('controls.phoneHint')}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
        />
      </div>
      <p id={`${id}-hint`} className={invalid ? 'error-text' : 'muted'}>
        {t(invalid ? 'controls.phoneError' : 'controls.phoneHint')}
      </p>
    </div>
  );
}

export function OtpInput({ value, onChange, disabled = false }) {
  const { t } = useTranslation();
  const refs = useRef([]);
  const id = useId();
  function insert(text, index) {
    const digits = text.replace(/\D/g, '').slice(0, 6 - index);
    const chars = Array.from({ length: 6 }, (_, i) => value[i] || ' ');
    chars.splice(index, digits.length || 1, ...(digits || ' '));
    onChange(chars.join('').trimEnd());
    if (digits) refs.current[Math.min(5, index + digits.length)]?.focus();
  }
  return (
    <fieldset className="otp-field" aria-describedby={`${id}-hint`}>
      <legend>{t('controls.otp')}</legend>
      <div className="otp-input">
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            aria-label={t('controls.otpDigit', { digit: number(index + 1) })}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            disabled={disabled}
            value={value[index]?.trim() || ''}
            onChange={(event) => insert(event.target.value, index)}
            onPaste={(event) => {
              event.preventDefault();
              insert(event.clipboardData.getData('text'), index);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Backspace' && !value[index]?.trim())
                refs.current[Math.max(0, index - 1)]?.focus();
              if (event.key === 'ArrowLeft') refs.current[Math.max(0, index - 1)]?.focus();
              if (event.key === 'ArrowRight') refs.current[Math.min(5, index + 1)]?.focus();
            }}
          />
        ))}
      </div>
      <p id={`${id}-hint`} className="muted">
        {t('controls.otpHint')}
      </p>
    </fieldset>
  );
}
