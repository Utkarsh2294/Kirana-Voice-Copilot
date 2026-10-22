import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Monitor, Moon, Play, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  GlassCard,
  LanguagePicker,
  ListenButton,
  PageHeading,
  Toggle,
} from '../components/primitives.jsx';
import { usePreferences } from '../preferences.js';
import { useUi } from '../components/overlays.jsx';

export default function Settings() {
  const { t } = useTranslation();
  const prefs = usePreferences();
  const { read } = useUi();
  const navigate = useNavigate();
  const themes = [
    { value: 'dark', Icon: Moon },
    { value: 'day', Icon: Sun },
    { value: 'auto', Icon: Monitor },
  ];
  return (
    <>
      <PageHeading
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        accent={t('settings.titleAccent')}
        description={t('settings.subtitle')}
        action={
          <ListenButton
            onClick={() =>
              read(
                `${t('settings.appearance')}. ${t('settings.language')}. ${t('settings.feedback')}. ${t('prototype.voice')}`,
              )
            }
          />
        }
      />
      <div className="settings-layout">
        <div className="stack">
          <GlassCard>
            <h2>{t('settings.appearance')}</h2>
            <p className="muted section-description">{t('settings.appearanceHint')}</p>
            <div className="theme-options" role="group" aria-label={t('settings.theme')}>
              {themes.map(({ value, Icon }) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={prefs.theme === value}
                  onClick={() => prefs.update({ theme: value })}
                >
                  <Icon size={22} />
                  <span>{t(`settings.${value}`)}</span>
                  <span className="theme-check" aria-hidden="true" />
                </button>
              ))}
            </div>
            <Toggle
              checked={prefs.reduceMotion}
              onChange={(value) => prefs.update({ reduceMotion: value })}
              label={t('settings.motion')}
              description={t('settings.motionHint')}
            />
          </GlassCard>
          <GlassCard>
            <h2>{t('settings.language')}</h2>
            <p className="muted section-description">{t('settings.languageHint')}</p>
            <LanguagePicker
              value={prefs.language}
              onChange={(value) => prefs.update({ language: value })}
            />
          </GlassCard>
          <GlassCard>
            <h2>{t('settings.feedback')}</h2>
            <Toggle
              checked={prefs.haptics}
              onChange={(value) => prefs.update({ haptics: value })}
              label={t('settings.haptics')}
              description={t('settings.hapticsHint')}
            />
            <Toggle
              checked={prefs.earcons}
              onChange={(value) => prefs.update({ earcons: value })}
              label={t('settings.earcons')}
              description={t('settings.earconsHint')}
            />
          </GlassCard>
        </div>
        <div className="settings-side">
          <GlassCard>
            <Play size={24} className="muted" />
            <h2>{t('settings.coach')}</h2>
            <p className="muted section-description">{t('settings.coachHint')}</p>
            <Button
              variant="ghost"
              onClick={() => {
                prefs.update({ tourSeen: false });
                navigate('/bill');
              }}
            >
              {t('settings.coach')}
            </Button>
          </GlassCard>
          {import.meta.env.DEV && (
            <GlassCard>
              <BookOpen size={24} className="muted" />
              <h2>{t('settings.dev')}</h2>
              <p className="muted section-description">{t('settings.devHint')}</p>
              <Link to="/dev/ui" className="button button--ghost">
                {t('nav.gallery')}
                <ArrowUpRight size={16} />
              </Link>
            </GlassCard>
          )}
          <div className="about-note">
            <h3>{t('settings.about')}</h3>
            <p>{t('settings.aboutBody')}</p>
            <small>{t('brand.version')}</small>
          </div>
        </div>
      </div>
      <p
        className={`settings-save-note ${prefs.storageError ? 'error-text' : 'muted'}`}
        role="status"
      >
        {t(prefs.storageError ? 'settings.storageError' : 'settings.preferencesSaved')}
      </p>
    </>
  );
}
