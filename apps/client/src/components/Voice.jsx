import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUp, LoaderCircle, LockKeyhole, Mic, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from './PreferencesProvider.jsx';

export function micGestureResult(duration, offsetY) {
  return offsetY <= -60 || duration < 180 ? 'locked' : 'processing';
}

export function useMicLevel(onSilence) {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(false);
  const resources = useRef({ generation: 0 });
  const silenceCallback = useRef(onSilence);
  useEffect(() => {
    silenceCallback.current = onSilence;
  }, [onSilence]);
  const stop = useCallback(() => {
    const current = resources.current;
    current.generation += 1;
    cancelAnimationFrame(current.frame);
    current.stream?.getTracks().forEach((track) => track.stop());
    current.context?.close().catch(() => {});
    current.stream = null;
    current.context = null;
    setLevel(0);
  }, []);
  const start = useCallback(async () => {
    stop();
    setError(false);
    const current = resources.current;
    const generation = current.generation;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('MIC_UNAVAILABLE');
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      current.context = new AudioContext();
      await current.context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (generation !== current.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      current.stream = stream;
      const analyser = current.context.createAnalyser();
      analyser.fftSize = 256;
      current.context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let silenceAt = performance.now();
      let lastUpdate = 0;
      function tick(now) {
        if (generation !== current.generation) return;
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length,
        );
        if (rms > 0.018) silenceAt = now;
        if (now - lastUpdate > 65) {
          setLevel(Math.min(1, rms * 8));
          lastUpdate = now;
        }
        if (now - silenceAt > 1800) {
          silenceCallback.current?.();
          silenceAt = now;
        }
        current.frame = requestAnimationFrame(tick);
      }
      current.frame = requestAnimationFrame(tick);
    } catch {
      if (generation === current.generation) {
        stop();
        setError(true);
      }
    }
  }, [stop]);
  useEffect(() => () => stop(), [stop]);
  return { level, start, stop, error };
}

export function Waveform({ level = 0, active = false, label }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  return (
    <div
      className={`waveform ${active ? 'is-active' : ''}`}
      role="img"
      aria-label={label || t('voice.level')}
    >
      {[0.35, 0.6, 0.85, 0.5, 1, 0.7, 0.4, 0.8, 0.5].map((height, index) => (
        <span
          key={index}
          style={{ transform: `scaleY(${active && !reduce ? 0.2 + level * height * 0.8 : 0.2})` }}
        />
      ))}
    </div>
  );
}

export function MicButton({ onComplete, enableAudio = false, previewState, docked = false }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [state, setState] = useState('idle');
  const stateRef = useRef(state);
  stateRef.current = state;
  const timers = useRef({});
  const pressed = useRef({});
  const { level, start, stop, error } = useMicLevel(() => {
    if (stateRef.current === 'locked') finish();
  });
  const shown = previewState || (error && state === 'idle' ? 'error' : state);
  const active = shown === 'listening' || shown === 'locked';
  function clearTimers() {
    for (const timer of Object.values(timers.current)) clearTimeout(timer);
  }
  function finish() {
    clearTimers();
    stop();
    setState('processing');
    onComplete?.();
    timers.current.reset = setTimeout(() => setState('idle'), 800);
  }
  function lock() {
    setState('locked');
    stateRef.current = 'locked';
    timers.current.silence = setTimeout(finish, enableAudio ? 15_000 : 5000);
  }
  function pointerDown(event) {
    if (previewState || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pressed.current = {
      stop: stateRef.current === 'locked',
      locked: false,
      y: event.clientY,
      at: performance.now(),
    };
    clearTimers();
    if (!pressed.current.stop) {
      if (enableAudio) start();
      timers.current.hold = setTimeout(() => {
        setState('listening');
        stateRef.current = 'listening';
      }, 180);
      timers.current.limit = setTimeout(finish, 15_000);
    }
  }
  function pointerMove(event) {
    if (!pressed.current.at || previewState) return;
    if (
      event.clientY - pressed.current.y <= -60 &&
      !pressed.current.stop &&
      !pressed.current.locked
    ) {
      clearTimeout(timers.current.hold);
      pressed.current.locked = true;
      lock();
    }
  }
  function pointerUp(event) {
    if (!pressed.current.at || previewState) return;
    clearTimeout(timers.current.hold);
    if (pressed.current.stop) finish();
    else if (!pressed.current.locked) {
      if (
        micGestureResult(
          performance.now() - pressed.current.at,
          event.clientY - pressed.current.y,
        ) === 'locked'
      )
        lock();
      else finish();
    }
    pressed.current.at = null;
  }
  function cancel() {
    clearTimers();
    stop();
    pressed.current.at = null;
    setState('idle');
  }
  useEffect(
    () => () => {
      for (const timer of Object.values(timers.current)) clearTimeout(timer);
    },
    [],
  );
  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape') {
        clearTimers();
        stop();
        setState('idle');
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [stop]);
  const Icon = {
    idle: Mic,
    listening: Mic,
    locked: Square,
    processing: LoaderCircle,
    error: AlertCircle,
  }[shown];
  return (
    <div className={`mic-wrap ${docked ? 'mic-wrap--docked' : ''} ${active ? 'is-active' : ''}`}>
      {active && !docked && (
        <div className="mic-lock-hint">
          <ArrowUp size={16} />
          <LockKeyhole size={16} />
        </div>
      )}
      <span
        className="mic-ring"
        aria-hidden="true"
        style={{ transform: `scale(${active && !reduce ? 1.08 + level * 0.16 : 1})` }}
      />
      <button
        type="button"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={cancel}
        className={`mic-button mic-button--${shown}`}
        aria-label={t(active ? 'voice.finish' : 'voice.button')}
        aria-pressed={active}
        disabled={Boolean(previewState)}
        onClick={(event) => {
          if (event.detail === 0 && !previewState) {
            if (active) finish();
            else {
              if (enableAudio) start();
              lock();
            }
          }
        }}
      >
        <Icon size={28} className={shown === 'processing' ? 'spin' : ''} />
        {shown === 'locked' && <LockKeyhole size={12} className="mic-lock-icon" />}
      </button>
      {!docked && (
        <>
          <p className="mic-state" role="status">
            {t(`voice.${shown}`)}
          </p>
          <Waveform level={level} active={active} />
          {error && (
            <p className="error-text" role="alert">
              {t('voice.denied')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
