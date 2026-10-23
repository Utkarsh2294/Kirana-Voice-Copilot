import { startCapture, lockCapture, finishCapture } from './capture-control.js';
import React, { useRef } from 'react';
import { Mic, Square, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useVoice, cancelCapture } from './control.js';

export default function LiveMic() {
  const { t } = useTranslation();
  const press = useRef(null);
  const capture = useVoice((s) => s.capture),
    level = useVoice((s) => s.level);
  const active = ['preparing', 'listening'].includes(capture),
    busy = capture === 'processing';
  const Icon = busy || capture === 'preparing' ? LoaderCircle : active ? Square : Mic;
  return (
    <div className="mic-wrap mic-wrap--docked">
      <span
        className="mic-ring"
        aria-hidden="true"
        style={{ transform: `scale(${active ? 1.08 + level * 0.16 : 1})` }}
      />
      <button
        type="button"
        className={`mic-button mic-button--${busy ? 'processing' : active ? 'locked' : 'idle'}`}
        aria-label={t(active ? 'voice.finish' : 'voice.button')}
        aria-pressed={active}
        disabled={busy}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          press.current = { at: performance.now(), y: event.clientY, stop: active, locked: false };
          if (!active) startCapture();
        }}
        onPointerMove={(event) => {
          if (press.current && !press.current.stop && event.clientY - press.current.y <= -60) {
            press.current.locked = true;
            lockCapture();
          }
        }}
        onPointerUp={() => {
          const current = press.current;
          press.current = null;
          if (!current) return;
          if (current.stop) finishCapture();
          else if (!current.locked) {
            if (performance.now() - current.at < 180) lockCapture();
            else finishCapture();
          }
        }}
        onPointerCancel={() => {
          press.current = null;
          cancelCapture();
        }}
        onClick={(event) => {
          if (event.detail !== 0) return;
          if (active) finishCapture();
          else {
            startCapture();
            lockCapture();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancelCapture();
        }}
      >
        <Icon size={28} className={busy || capture === 'preparing' ? 'spin' : ''} />
      </button>
    </div>
  );
}
