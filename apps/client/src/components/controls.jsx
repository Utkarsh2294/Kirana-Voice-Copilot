import React, { useEffect, useId, useRef, useState } from 'react';
import { Delete, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from './primitives.jsx';
import { number } from '../format.js';

export function parseDisplayQuantity(text, size) {
  if (!/^\d+(?:\.\d{0,3})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const divisor = 10n ** BigInt(fraction.length);
  const scaled = BigInt(whole + fraction) * BigInt(size);
  if (scaled % divisor !== 0n) return null;
  const result = scaled / divisor;
  return result > 0n && result <= 1_000_000_000n ? Number(result) : null;
}

export function QuantityStepper({ valueBase, onChange, size = 1000, unit = 'kg' }) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState(String(valueBase / size));
  useEffect(() => setDraft(String(valueBase / size)), [valueBase, size]);
  const valid = parseDisplayQuantity(draft, size) !== null;
  const step = size === 1 ? 1 : Math.max(1, size / 4);
  return (
    <div className="quantity-control">
      <label htmlFor={id}>
        {t('bill.quantity')} <span className="muted">({t(`units.${unit}`)})</span>
      </label>
      <div className="stepper">
        <IconButton
          icon={Minus}
          label={t('controls.decrease')}
          onClick={() => onChange(Math.max(1, valueBase - step))}
          disabled={valueBase <= 1}
        />
        <input
          id={id}
          inputMode="decimal"
          value={draft}
          aria-invalid={!valid}
          aria-describedby={!valid ? `${id}-error` : undefined}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            const parsed = parseDisplayQuantity(value, size);
            if (parsed !== null) onChange(parsed);
          }}
          onBlur={() => {
            if (!valid) setDraft(String(valueBase / size));
          }}
        />
        <IconButton
          icon={Plus}
          label={t('controls.increase')}
          onClick={() => onChange(Math.min(1_000_000_000, valueBase + step))}
          disabled={valueBase >= 1_000_000_000}
        />
      </div>
      {!valid && (
        <p id={`${id}-error`} className="error-text">
          {t('bill.invalidQty')}
        </p>
      )}
      <div className="quantity-chips">
        {(size === 1 ? [1, 2] : [0.25, 0.5, 1, 2]).map((fraction) => (
          <Button
            key={fraction}
            variant={valueBase === fraction * size ? 'primary' : 'ghost'}
            onClick={() => onChange(fraction * size)}
            aria-pressed={valueBase === fraction * size}
          >
            {number(fraction, { maximumFractionDigits: 2 })} {t(`units.${unit}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function NumPad({ value, onChange, label }) {
  const { t } = useTranslation();
  const id = useId();
  const change = (next) => {
    if (/^\d{0,5}(?:\.\d{0,2})?$/.test(next)) onChange(next);
  };
  function append(digit) {
    if (digit === '.') {
      if (!value.includes('.')) change(`${value || '0'}.`);
      return;
    }
    change(value === '0' ? digit : value + digit);
  }
  return (
    <div className="numpad">
      <label htmlFor={id}>{label || t('controls.amount')}</label>
      <input
        id={id}
        className="money numpad-display"
        value={value}
        inputMode="decimal"
        autoComplete="off"
        onChange={(event) => change(event.target.value)}
      />
      <div className="numpad-grid" role="group" aria-label={t('controls.keypad')}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => (digit === 'delete' ? change(value.slice(0, -1)) : append(digit))}
            aria-label={
              digit === 'delete'
                ? t('common.removeDigit')
                : digit === '.'
                  ? new Intl.NumberFormat()
                      .formatToParts(1.1)
                      .find((part) => part.type === 'decimal')?.value
                  : number(Number(digit))
            }
          >
            {digit === 'delete' ? (
              <Delete size={22} />
            ) : digit === '.' ? (
              '.'
            ) : (
              number(Number(digit))
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

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
