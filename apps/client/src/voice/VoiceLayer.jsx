import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../preferences.js';
import { Button } from '../components/primitives.jsx';
import { useVoice, stopSpeech, cancelCapture } from './control.js';
import { voiceCopy } from './copy.js';
import { startCapture, lockCapture } from './capture-control.js';
import './voice.css';

export default function VoiceLayer() {
  const state = useVoice(),
    prefs = usePreferences(),
    { i18n } = useTranslation(),
    c = voiceCopy(i18n.language);
  const recording = ['preparing', 'listening', 'processing'].includes(state.capture);
  const visible =
    recording ||
    state.transcript ||
    state.partial ||
    state.error ||
    state.notice ||
    ['loading', 'playing'].includes(state.speech);
  if (!visible) return null;
  const error = c[state.error] || c.error;
  return (
    <aside className="voice-status" aria-label={c.title}>
      <div className="voice-status-head">
        <strong>{recording ? c[state.capture] : state.transcript ? c.transcript : c.title}</strong>
        <button
          className="icon-button"
          aria-label={c.dismiss}
          onClick={() => {
            cancelCapture();
            stopSpeech();
            useVoice.setState({ transcript: null, partial: '', error: '', notice: '', text: '' });
          }}
        >
          ×
        </button>
      </div>
      <div role="status" aria-live="polite">
        {state.partial && <p className="muted">{state.partial}</p>}
        {state.transcript && (
          <p className="voice-transcript" data-testid="voice-transcript">
            {state.transcript.text}
          </p>
        )}
        {state.text && <p className="voice-caption">{state.text}</p>}
        {state.notice && <p className="muted">{c[state.notice] || c.device}</p>}
      </div>
      {state.error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {state.capture === 'error' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition) &&
        !['denied', 'microphone', 'insecure'].includes(state.error) && (
          <div>
            <p className="muted">{c.browserInput}</p>
            <Button
              variant="quiet"
              onClick={() => {
                startCapture({ browser: true });
                lockCapture();
              }}
            >
              {c.browserRetry}
            </Button>
          </div>
        )}
      {state.transcript && <p className="muted">{c.boundary}</p>}
      {state.transcript?.lang && state.transcript.lang !== prefs.voiceLanguage && (
        <div>
          <p>{c.offer}</p>
          <Button onClick={() => prefs.update({ voiceLanguage: state.transcript.lang })}>
            {c.switch}
          </Button>
        </div>
      )}
      <div className="row">
        {recording && (
          <Button variant="quiet" onClick={cancelCapture}>
            {c.cancel}
          </Button>
        )}
        {['loading', 'playing'].includes(state.speech) && (
          <Button variant="quiet" onClick={stopSpeech}>
            {c.stop}
          </Button>
        )}
      </div>
    </aside>
  );
}
