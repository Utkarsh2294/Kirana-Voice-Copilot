import { PhoneInput, OtpInput } from '../components/PhoneControls.jsx';
import '../locales/insights.js';
import '../locales/gallery.js';
import './gallery.css';
import React, { useState } from 'react';
import { Check, CircleAlert, Headphones, Plus, Trash2, Volume2, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { languages } from '@kirana/shared/languages';
import {
  Button,
  Chip,
  EmptyState,
  GlassCard,
  IconButton,
  LanguagePicker,
  ListenButton,
  OfflineBanner,
  PageHeading,
  PriceSourceBadge,
  Skeleton,
  Sparkline,
  Stat,
  Toggle,
} from '../components/primitives.jsx';
import { ConfirmDialog, Sheet, useUi } from '../components/overlays.jsx';
import { NumPad, QuantityStepper } from '../components/controls.jsx';
import { MicButton, Waveform } from '../components/Voice.jsx';
import { BillLine } from '../components/BillLine.jsx';
import { usePreferences } from '../preferences.js';
import { itemById, initialSampleLines } from '../prototype/sample-data.js';
import { number } from '../format.js';

function Section({ name, children }) {
  const { t } = useTranslation();
  return (
    <section className="gallery-section" aria-labelledby={`gallery-${name}`}>
      <h2 id={`gallery-${name}`}>{t(`gallery.${name}`)}</h2>
      {children}
    </section>
  );
}
export default function Gallery() {
  const { t } = useTranslation();
  const prefs = usePreferences();
  const { notify, read } = useUi();
  const [worst, setWorst] = useState(false);
  const [audio, setAudio] = useState(false);
  const [qty, setQty] = useState(1500);
  const [count, setCount] = useState(1);
  const [price, setPrice] = useState('52.00');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [line, setLine] = useState(initialSampleLines[0]);
  const [stat, setStat] = useState(22850);
  const [toggle, setToggle] = useState(false);
  const action = () => notify(t('gallery.result'));
  const remove = () => {
    const previous = line;
    setLine(null);
    notify(t('gallery.toast'), () => setLine(previous));
  };
  return (
    <div className="gallery" data-dev-gallery="true">
      <PageHeading
        eyebrow={t('prototype.badge')}
        title={t('gallery.title')}
        description={t('gallery.subtitle')}
      />
      <div className="gallery-controls">
        <h2>{t('gallery.appearance')}</h2>
        <div className="row">
          <div className="row" role="group" aria-label={t('settings.theme')}>
            {['dark', 'day'].map((theme) => (
              <Button
                key={theme}
                variant={prefs.theme === theme ? 'primary' : 'ghost'}
                aria-pressed={prefs.theme === theme}
                onClick={() => prefs.update({ theme })}
              >
                {t(`settings.${theme}`)}
              </Button>
            ))}
          </div>
          <LanguagePicker
            value={prefs.language}
            onChange={(language) => prefs.update({ language })}
            options={languages.filter((language) =>
              ['en-IN', 'hi-IN', 'ta-IN'].includes(language.code),
            )}
          />
        </div>
        <Toggle
          label={t('settings.motion')}
          checked={prefs.reduceMotion}
          onChange={(reduceMotion) => prefs.update({ reduceMotion })}
        />
        <Toggle
          label={t('gallery.worst')}
          description={t('gallery.worstHint')}
          checked={worst}
          onChange={setWorst}
        />
      </div>
      <Section name="buttons">
        <div className="gallery-row">
          {['primary', 'action', 'ghost', 'quiet'].map((variant) => (
            <Button variant={variant} key={variant} icon={Plus} onClick={action}>
              {t('common.add')}
            </Button>
          ))}
          <Button disabled>{t('common.unavailable')}</Button>
          <Button loading>{t('common.loading')}</Button>
          <IconButton icon={Plus} label={t('common.add')} onClick={action} />
          <IconButton icon={Trash2} label={t('common.delete')} disabled />
        </div>
      </Section>
      <Section name="feedback">
        <div className="gallery-row">
          {['neutral', 'blue', 'rose', 'success', 'warning', 'danger'].map((tone) => (
            <Chip
              key={tone}
              tone={tone}
              icon={tone === 'warning' || tone === 'danger' ? CircleAlert : Check}
            >
              {t(
                tone === 'success'
                  ? 'gallery.successSample'
                  : tone === 'warning'
                    ? 'gallery.warningSample'
                    : tone === 'danger'
                      ? 'gallery.errorSample'
                      : 'gallery.chip',
              )}
            </Chip>
          ))}
        </div>
        <div className="gallery-row">
          {['demo', 'merchant', 'market', 'mrp', 'manual'].map((source) => (
            <PriceSourceBadge key={source} source={source} />
          ))}
        </div>
        <div className="stack">
          <OfflineBanner offline />
          <OfflineBanner state="syncing" />
          <OfflineBanner state="synced" />
        </div>
        <div className="gallery-columns">
          <div>
            <Toggle label={t('settings.haptics')} checked={toggle} onChange={setToggle} />
            <Toggle label={t('common.disabled')} checked={false} onChange={() => {}} disabled />
          </div>
          <Button variant="ghost" onClick={() => notify(t('gallery.toast'), action)}>
            {t('gallery.showToast')}
          </Button>
        </div>
      </Section>
      <Section name="inputs">
        <div className="gallery-columns">
          <div className="stack">
            <QuantityStepper valueBase={qty} onChange={setQty} />
            <QuantityStepper valueBase={count} onChange={setCount} size={1} unit="pc" />
          </div>
          <NumPad value={price} onChange={setPrice} />
        </div>
        <div className="gallery-columns">
          <div className="stack">
            <PhoneInput value={phone} onChange={setPhone} />
            <PhoneInput value={worst ? '123' : '9876543210'} onChange={() => {}} disabled />
          </div>
          <div className="stack">
            <OtpInput value={otp} onChange={setOtp} />
            <OtpInput value="123456" onChange={() => {}} disabled />
          </div>
        </div>
        <LanguagePicker
          value={prefs.language}
          onChange={(language) => prefs.update({ language })}
        />
      </Section>
      <Section name="voice">
        <p className="phase-note">{t('gallery.deferred')}</p>
        <div className="gallery-row">
          {['idle', 'loading', 'playing', 'error'].map((state) => (
            <ListenButton
              key={state}
              state={state}
              progress={60}
              onClick={() => read(t('prototype.voice'))}
            />
          ))}
          <ListenButton compact onClick={() => read(t('prototype.voice'))} />
          <IconButton
            icon={Volume2}
            label={t('voice.listen')}
            onClick={() => read(t('prototype.voice'))}
          />
        </div>
        <Toggle
          label={t('voice.permission')}
          description={t('voice.previewNote')}
          checked={audio}
          onChange={setAudio}
        />
        <MicButton enableAudio={audio} onComplete={() => notify(t('prototype.voice'))} />
        <div className="gallery-mics">
          {['idle', 'listening', 'locked', 'processing', 'error'].map((state) => (
            <div key={state}>
              <MicButton previewState={state} />
              <p className="muted">{t(`voice.${state}Short`)}</p>
            </div>
          ))}
        </div>
        <Waveform level={0.65} active label={t('voice.sampleLevel')} />
        <Waveform />
      </Section>
      <Section name="bill">
        {line ? (
          <ul className="gallery-bill">
            <BillLine
              line={worst ? { ...line, pricePaise: 999999999 } : line}
              item={itemById.rice}
              name={worst ? `${t('gallery.longItem')} ${t('gallery.longToken')}` : undefined}
              onRemove={remove}
              onEdit={() => setSheet(true)}
              onQuantity={() => setSheet(true)}
            />
          </ul>
        ) : (
          <EmptyState
            icon={Trash2}
            title={t('bill.empty')}
            action={
              <Button variant="ghost" onClick={() => setLine(initialSampleLines[0])}>
                {t('common.reset')}
              </Button>
            }
          />
        )}
      </Section>
      <Section name="overlays">
        <div className="gallery-row">
          <Button variant="ghost" onClick={() => setSheet(true)}>
            {t('gallery.openSheet')}
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(true)}>
            {t('gallery.openConfirm')}
          </Button>
          <Button variant="ghost" onClick={() => notify(t('gallery.toast'), action)}>
            {t('gallery.showToast')}
          </Button>
        </div>
        <Sheet
          open={sheet}
          onOpenChange={setSheet}
          title={t('gallery.sheetTitle')}
          description={t('gallery.sheetBody')}
        >
          <div className="stack">
            <QuantityStepper valueBase={qty} onChange={setQty} />
            <Button
              variant="action"
              onClick={() => {
                setSheet(false);
                action();
              }}
            >
              {t('common.done')}
            </Button>
          </div>
        </Sheet>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={t('gallery.confirmTitle')}
          description={t('gallery.confirmBody')}
          onConfirm={action}
        />
      </Section>
      <Section name="display">
        <div className="gallery-columns">
          <GlassCard>
            <h3>{t('gallery.card')}</h3>
            <p className="muted">{worst ? t('gallery.longItem') : t('gallery.cardBody')}</p>
          </GlassCard>
          <div className="stack">
            <Stat label={t('gallery.stat')} value={worst ? 999999999 : stat} currency icon={Wifi} />
            <Button variant="ghost" icon={Plus} onClick={() => setStat((value) => value + 1050)}>
              {t('common.add')} {number(1050)}
            </Button>
          </div>
        </div>
        <Sparkline values={[5, 8, 4, 9, 7, 12, 15, 13, 18]} label={t('insights.chart')} />
        <Sparkline values={[]} label={t('controls.empty')} />
        <Skeleton lines={3} />
        <EmptyState
          icon={Headphones}
          title={t('controls.empty')}
          description={t('controls.emptyBody')}
          action={
            <Button variant="ghost" onClick={action}>
              {t('common.done')}
            </Button>
          }
        />
      </Section>
    </div>
  );
}
