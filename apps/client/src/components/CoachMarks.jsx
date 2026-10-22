import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, AudioLines, Hand, Headphones, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../preferences.js';
import { number } from '../format.js';
import { Button } from './primitives.jsx';
import { Sheet } from './overlays.jsx';

const steps = [
  { key: 'welcome', Icon: Store },
  { key: 'mic', Icon: AudioLines },
  { key: 'swipe', Icon: Hand },
  { key: 'listen', Icon: Headphones },
];
export default function CoachMarks() {
  const { t } = useTranslation();
  const { tourSeen, update } = usePreferences();
  const { pathname } = useLocation();
  const [index, setIndex] = useState(0);
  const open = !tourSeen && pathname === '/bill';
  const { key, Icon } = steps[index];
  useEffect(() => {
    if (!tourSeen) setIndex(0);
  }, [tourSeen]);
  useEffect(() => {
    if (open) document.documentElement.dataset.coachStep = key;
    else delete document.documentElement.dataset.coachStep;
    return () => {
      delete document.documentElement.dataset.coachStep;
    };
  }, [open, key]);
  function finish() {
    update({ tourSeen: true });
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) finish();
      }}
      title={t(`tour.${key}`)}
      description={t(`tour.${key}Body`)}
    >
      <div className="coach-content">
        <div className="coach-visual">
          <Icon size={48} strokeWidth={1.2} />
        </div>
        <div className="row between">
          <p className="muted">
            {t('tour.step', { current: number(index + 1), total: number(steps.length) })}
          </p>
          <div className="coach-dots" aria-hidden="true">
            {steps.map((step, position) => (
              <span className={position === index ? 'is-active' : ''} key={step.key} />
            ))}
          </div>
        </div>
        <p className="phase-note">{t('prototype.voice')}</p>
        <div className="row between">
          <Button variant="quiet" onClick={finish}>
            {t('common.skip')}
          </Button>
          <Button
            variant="action"
            icon={ArrowRight}
            onClick={() => (index === steps.length - 1 ? finish() : setIndex(index + 1))}
          >
            {t(index === steps.length - 1 ? 'tour.start' : 'common.continue')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
