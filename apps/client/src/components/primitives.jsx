import { useVoice, speak, stopSpeech, withSpeechOwner } from '../voice/control.js';
import React, { forwardRef, useLayoutEffect, useRef } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleHelp,
  Headphones,
  LoaderCircle,
  Pause,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { languages } from '@kirana/shared/languages';
import { useReducedMotion } from './PreferencesProvider.jsx';
import { money, number } from '../format.js';

export const Button = forwardRef(function Button(
  { variant = 'primary', icon: Icon, children, className = '', loading = false, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`button button--${variant} ${className}`}
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <LoaderCircle className="spin" size={18} /> : Icon && <Icon size={18} />}
      <span>{children}</span>
    </button>
  );
});

export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={20} />
    </button>
  );
});

export function Chip({ children, tone = 'neutral', icon: Icon, ...props }) {
  return (
    <span className={`chip chip--${tone}`} {...props}>
      {Icon && <Icon size={14} />}
      <span>{children}</span>
    </span>
  );
}

export function PriceSourceBadge({ source = 'demo', demo = false }) {
  const { t } = useTranslation();
  return (
    <span className="row price-source-group">
      <Chip
        tone={source === 'merchant' ? 'blue' : source === 'manual' ? 'rose' : 'neutral'}
        icon={source === 'demo' ? CircleHelp : Check}
      >
        {t(`price.${source}`)}
      </Chip>
      {demo && source !== 'demo' && <Chip icon={CircleHelp}>{t('price.demo')}</Chip>}
    </span>
  );
}

export function ListenButton({
  state: previewState,
  progress = 0,
  label,
  onClick,
  text,
  getText,
  compact = false,
}) {
  const id = React.useId(),
    current = useVoice((s) => s.speech),
    owner = useVoice((s) => s.speechOwner);
  const state = previewState || (owner === id ? current : 'idle');
  const handle = () => {
    if (['playing', 'loading'].includes(state)) {
      stopSpeech();
      return;
    }
    withSpeechOwner(id, () => {
      if (getText || text !== undefined) speak(getText || text);
      else onClick?.();
    });
  };
  const { t } = useTranslation();
  const labels = {
    idle: 'voice.listen',
    loading: 'voice.listenLoading',
    playing: 'voice.listenPlaying',
    error: 'voice.listenError',
  };
  const Icon = { idle: Volume2, loading: LoaderCircle, playing: Pause, error: AlertCircle }[state];
  return (
    <button
      type="button"
      className={`listen-button ${compact ? 'listen-button--compact' : ''}`}
      aria-label={label || t(labels[state])}
      onClick={handle}
      aria-busy={state === 'loading' || undefined}
    >
      <span className="listen-symbol">
        <Icon size={18} className={state === 'loading' ? 'spin' : ''} />
        {state === 'playing' && (
          <svg className="progress-ring" viewBox="0 0 32 32" aria-hidden="true">
            <circle
              cx="16"
              cy="16"
              r="14"
              pathLength="100"
              strokeDasharray={`${Math.max(0, Math.min(100, progress))} 100`}
            />
          </svg>
        )}
      </span>
      {!compact && <span>{label || t(labels[state])}</span>}
    </button>
  );
}

export function Toggle({ checked, onChange, label, description, disabled = false }) {
  const id = React.useId();
  return (
    <div className="toggle-row">
      <div>
        <label id={id}>{label}</label>
        {description && <p className="muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        className="toggle"
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export function LanguagePicker({ value, onChange, compact = false, options = languages }) {
  const { t } = useTranslation();
  return (
    <label className={`language-picker ${compact ? 'language-picker--compact' : ''}`}>
      <span className="sr-only">{t('settings.selectLanguage')}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}

export function OfflineBanner({ offline, state }) {
  const { t } = useTranslation();
  if (!offline && !state) return null;
  const label = offline ? 'offline' : state;
  const Icon = offline ? WifiOff : state === 'syncing' ? LoaderCircle : Wifi;
  return (
    <div className={`offline-banner ${offline ? 'is-offline' : ''}`} role="status">
      <Icon size={18} />
      <span>
        {t(`status.${label}`)}
        {offline && <> · {t('status.offlineBody')}</>}
      </span>
    </div>
  );
}

export function GlassCard({ children, className = '', as: Element = 'section', ...props }) {
  return (
    <Element className={`glass-card ${className}`} {...props}>
      {children}
    </Element>
  );
}

export function AnimatedNumber({ value, currency = false, className = '' }) {
  const reduce = useReducedMotion();
  const { i18n } = useTranslation();
  const visible = useRef(null);
  const current = useRef(value);
  const initial = useRef(value);
  const language = i18n.language;
  useLayoutEffect(() => {
    const format = (amount) => (currency ? money(amount) : number(amount));
    if (reduce || current.current === value) {
      current.current = value;
      visible.current.textContent = format(value);
      return;
    }
    const startValue = current.current;
    const start = performance.now();
    let frame;
    function tick(now) {
      const progress = Math.min(1, (now - start) / 220);
      current.current = Math.round(startValue + (value - startValue) * (1 - (1 - progress) ** 3));
      visible.current.textContent = format(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, currency, reduce, language]);
  return (
    <span className={`money ${className}`}>
      <span ref={visible} aria-hidden="true">
        {currency ? money(initial.current) : number(initial.current)}
      </span>
      <span className="sr-only">{currency ? money(value) : number(value)}</span>
    </span>
  );
}

export function Stat({ label, value, currency = false, detail, icon: Icon }) {
  return (
    <div className="stat">
      <div className="row between">
        <p>{label}</p>
        {Icon && <Icon size={18} className="muted" />}
      </div>
      <AnimatedNumber value={value} currency={currency} />
      {detail && <p className="stat-detail">{detail}</p>}
    </div>
  );
}

export function Sparkline({ values = [], label, className = '' }) {
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(1, values.length - 1)) * 300},${75 - ((value - min) / (max - min)) * 65}`,
    )
    .join(' ');
  return (
    <svg className={`sparkline ${className}`} viewBox="0 0 300 80" role="img" aria-label={label}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Skeleton({ lines = 3, className = '' }) {
  const { t } = useTranslation();
  return (
    <div
      className={`skeleton-group ${className}`}
      role="status"
      aria-label={t('controls.loadingLabel')}
    >
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className="skeleton"
          style={{ inlineSize: index === lines - 1 ? '65%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Headphones, title, description, action }) {
  const { t } = useTranslation();
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={30} strokeWidth={1.4} />
      </div>
      <h3>{title || t('controls.empty')}</h3>
      <p>{description || t('controls.emptyBody')}</p>
      {action}
    </div>
  );
}

export function PageHeading({ eyebrow, title, accent, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>
          {title}
          {accent && (
            <>
              <br />
              <span>{accent}</span>
            </>
          )}
        </h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}
