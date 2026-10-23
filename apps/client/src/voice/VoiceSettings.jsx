import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { languages, voiceLanguageCodes } from '@kirana/shared/languages';
import { api } from '../api.js';
import { usePreferences } from '../preferences.js';
import { useSession } from '../auth/Session.jsx';
import { Button, GlassCard, Toggle } from '../components/primitives.jsx';
import { speak, useVoice } from './control.js';
import { voiceCopy } from './copy.js';
import { voiceGreetings } from './readback.js';
import './voice.css';

export default function VoiceSettings() {
  const prefs = usePreferences(),
    { i18n } = useTranslation(),
    session = useSession(),
    c = voiceCopy(i18n.language);
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [usage, setUsage] = useState(null);
  const caps = useVoice((s) => s.capabilities);
  const merchantId = session?.merchant?.id;
  useEffect(() => {
    if (merchantId)
      api('/voice/usage')
        .then(setUsage)
        .catch(() => {});
  }, [merchantId]);
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      await api('/merchants/me/language', {
        method: 'PUT',
        body: {
          uiLanguage: prefs.language,
          voiceLanguage: prefs.voiceLanguage,
          voicePreference: prefs.voicePreference,
        },
      });
      const result = await api('/merchants/me', {
        method: 'PATCH',
        body: {
          settings: {
            voiceMuted: prefs.voiceMuted,
            voiceVolume: prefs.voiceVolume,
            voicePace: prefs.voicePace,
            voiceAutoDetect: prefs.voiceAutoDetect,
            voiceTranscriptOptIn: prefs.voiceTranscriptOptIn,
          },
        },
      });
      session.setMerchant(result.merchant);
      setMessage(c.saved);
    } catch {
      setMessage(c.error);
    } finally {
      setBusy(false);
    }
  }
  function selectLanguage(lang) {
    prefs.update({ voiceLanguage: lang });
    if (caps?.[lang]?.configuredTts.length)
      import('./speak.js').then((engine) =>
        engine.prewarmSpeech(lang, [voiceGreetings[lang] || c.previewText]),
      );
  }
  return (
    <GlassCard className="voice-settings">
      <div>
        <h2>{c.settings}</h2>
        <p className="muted">{c.separate}</p>
      </div>
      <label>
        {c.language}
        <select value={prefs.voiceLanguage} onChange={(e) => selectLanguage(e.target.value)}>
          {voiceLanguageCodes.map((code) => (
            <option key={code} value={code}>
              {languages.find((item) => item.code === code)?.name || code}
            </option>
          ))}
        </select>
      </label>
      <label>
        {c.voice}
        <select
          value={prefs.voicePreference}
          onChange={(e) => prefs.update({ voicePreference: e.target.value })}
        >
          <option value="female">{c.female}</option>
          <option value="male">{c.male}</option>
        </select>
      </label>
      <label>
        {c.pace} · {prefs.voicePace}×
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.05"
          value={prefs.voicePace}
          onChange={(e) => prefs.update({ voicePace: Number(e.target.value) })}
        />
      </label>
      <label>
        {c.volume} · {Math.round(prefs.voiceVolume * 100)}%
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={prefs.voiceVolume}
          onChange={(e) => prefs.update({ voiceVolume: Number(e.target.value) })}
        />
      </label>
      <Toggle
        label={c.mute}
        checked={prefs.voiceMuted}
        onChange={(value) => prefs.update({ voiceMuted: value })}
      />
      <Toggle
        label={c.auto}
        checked={prefs.voiceAutoDetect}
        onChange={(value) => prefs.update({ voiceAutoDetect: value })}
      />
      <Toggle
        label={c.optin}
        description={c.privacy}
        checked={prefs.voiceTranscriptOptIn}
        onChange={(value) => prefs.update({ voiceTranscriptOptIn: value })}
      />
      <p className="muted">
        {caps?.[prefs.voiceLanguage]?.configuredTts.length ? c.cloud : c.device}
      </p>
      <div className="row">
        <Button onClick={() => speak(voiceGreetings[prefs.voiceLanguage] || c.previewText)}>
          {c.preview}
        </Button>
        <Button variant="quiet" loading={busy} onClick={save}>
          {c.save}
        </Button>
      </div>
      <p className="muted">{c.retention}</p>
      <Button
        variant="quiet"
        onClick={async () => {
          await import('./speak.js').then((engine) =>
            engine.clearVoiceCache(session?.merchant?.id),
          );
          setMessage(c.cleared);
        }}
      >
        {c.clear}
      </Button>
      {usage && (
        <div>
          <h3>{c.usage}</h3>
          <dl className="voice-metrics">
            <div>
              <dt>{c.budget}</dt>
              <dd>
                ₹{((usage.spentPaise || 0) / 100).toFixed(2)} / ₹
                {((usage.budgetPaise || 0) / 100).toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>{c.hits}</dt>
              <dd>{usage.cacheHits || 0}</dd>
            </div>
          </dl>
        </div>
      )}
      {import.meta.env.DEV && <Link to="/dev/voice">{c.harness} ↗</Link>}
      {message && <p role="status">{message}</p>}
    </GlassCard>
  );
}
