import React, { useEffect, useId, useState } from 'react';
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
  return result > 0n && result <= 1_000_000n ? Number(result) : null;
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
          onClick={() => onChange(Math.min(1_000_000, valueBase + step))}
          disabled={valueBase >= 1_000_000}
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
