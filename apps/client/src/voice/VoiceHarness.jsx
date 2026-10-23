import { startCapture, lockCapture, finishCapture } from './capture-control.js';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, GlassCard, PageHeading } from '../components/primitives.jsx';
import { useVoice, speak, enqueueSpeech, stopSpeech, cancelCapture } from './control.js';
import { voiceCopy } from './copy.js';
import VoiceSettings from './VoiceSettings.jsx';
import './voice.css';

export default function VoiceHarness() {
  const { i18n } = useTranslation(),
    c = voiceCopy(i18n.language),
    state = useVoice();
  const [text, setText] = useState(c.previewText),
    [fileBusy, setFileBusy] = useState(false);
  const active = ['preparing', 'listening'].includes(state.capture);
  async function fileTest(file) {
    if (!file) return;
    setFileBusy(true);
    useVoice.setState({
      active: true,
      error: '',
      capture: 'preparing',
      transcript: null,
      partial: '',
    });
    try {
      await import('./capture.js').then((engine) => engine.transcribeFile(file));
    } catch (error) {
      if (error.code === 'cancelled' || error.name === 'AbortError') return;
      if (import.meta.env.DEV) console.warn('VOICE_FILE_CHECK_FAILED', error.code || error.message);
      useVoice.setState({ capture: 'error', error: error.code || 'inputUnavailable' });
    } finally {
      setFileBusy(false);
    }
  }
  return (
    <div className="page voice-lab">
      <PageHeading eyebrow="PHASE 06" title={c.harness} description={c.labBody} />
      <div className="voice-lab-tools">
        <GlassCard>
          <h2>{c.subtitle}</h2>
          <p className="muted">{c.boundary}</p>
          <div className="voice-test-controls">
            <Button
              disabled={state.capture === 'processing' || fileBusy}
              onClick={() => {
                if (active) finishCapture();
                else {
                  startCapture();
                  lockCapture();
                }
              }}
            >
              {active ? c.finish : c.record}
            </Button>
            <Button variant="quiet" onClick={cancelCapture}>
              {c.cancel}
            </Button>
          </div>
          <p role="status">{c[state.capture] || c.states}</p>
          <p data-testid="lab-partial">{state.partial}</p>
          <p data-testid="lab-transcript">{state.transcript?.text}</p>
          <dl className="voice-metrics">
            <div>
              <dt>{c.first}</dt>
              <dd>{state.metrics?.firstPartialMs ?? '—'} ms</dd>
            </div>
            <div>
              <dt>{c.final}</dt>
              <dd>{state.metrics?.finalMs ?? '—'} ms</dd>
            </div>
            <div>
              <dt>{c.provider}</dt>
              <dd>{state.inputProvider || '—'}</dd>
            </div>
          </dl>
        </GlassCard>
        <GlassCard>
          <label>
            {c.text}
            <textarea value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="voice-test-controls">
            <Button onClick={() => speak(() => text, { owner: 'lab' })}>{c.play}</Button>
            <Button variant="quiet" onClick={() => enqueueSpeech(text, { owner: 'lab' })}>
              {c.queue}
            </Button>
            <Button variant="quiet" onClick={stopSpeech}>
              {c.stop}
            </Button>
          </div>
          <p role="status">
            {c.cache}: <span data-testid="voice-cache">{state.cache || '—'}</span> · {c.queued}:{' '}
            {state.queue.length}
          </p>
        </GlassCard>
        <GlassCard>
          <h2>{c.golden}</h2>
          <p className="muted">{c.goldenBody}</p>
          <label>
            {c.file}
            <input
              type="file"
              accept="audio/*"
              disabled={fileBusy}
              onChange={(e) => fileTest(e.target.files[0])}
            />
          </label>
        </GlassCard>
      </div>
      <VoiceSettings />
    </div>
  );
}
