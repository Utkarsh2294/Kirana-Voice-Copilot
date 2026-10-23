import { useReadScreen } from '../voice/useSpeak.js';
import '../locales/insights.js';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDrag } from '@use-gesture/react';
import {
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronDown,
  Lightbulb,
  ReceiptText,
  RefreshCw,
  ShoppingBasket,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Chip,
  GlassCard,
  ListenButton,
  PageHeading,
  Skeleton,
  Sparkline,
  Stat,
} from '../components/primitives.jsx';
import { ProductMark } from '../components/BillLine.jsx';
import { useUi } from '../components/overlays.jsx';
import { sampleItems, samplePeriods } from '../prototype/sample-data.js';
import { number } from '../format.js';

const periods = ['day', 'week', 'month'];
export function nextPeriod(current, direction) {
  return periods[Math.max(0, Math.min(2, periods.indexOf(current) + direction))];
}
export default function Insights() {
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/demo/') ? '/demo' : '';
  const { t } = useTranslation();
  const { read, notify } = useUi();
  const [period, setPeriod] = useState('day');
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef();
  const tabs = useRef([]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const data = samplePeriods[period];
  const labels = t(
    `insights.${period === 'day' ? 'chartLabels' : period === 'week' ? 'weekLabels' : 'monthLabels'}`,
    { returnObjects: true },
  );
  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    timer.current = setTimeout(() => {
      setRefreshing(false);
      notify(t('insights.updated'));
    }, 550);
  }
  const swipe = useDrag(
    ({ last, movement: [x] }) => {
      if (last && Math.abs(x) > 55) setPeriod((value) => nextPeriod(value, x < 0 ? 1 : -1));
    },
    { axis: 'x', filterTaps: true },
  );
  const pull = useDrag(
    ({ last, movement: [, y] }) => {
      if (last && y > 65) refresh();
    },
    { axis: 'y', filterTaps: true },
  );
  const speech = ({ lang }) =>
    import('../voice/readback.js').then((module) => module.buildInsightReadback({ data, lang }));
  useReadScreen(speech);
  return (
    <>
      <PageHeading
        eyebrow={t('insights.eyebrow')}
        title={t('insights.title')}
        accent={t('insights.titleAccent')}
        description={t('insights.subtitle')}
        action={<ListenButton onClick={() => read(speech)} />}
      />
      <div className="insight-toolbar">
        <div className="period-tabs" role="tablist" aria-label={t('nav.insights')}>
          <span
            className="period-indicator"
            style={{ transform: `translateX(${periods.indexOf(period) * 100}%)` }}
            aria-hidden="true"
          />
          {periods.map((value, index) => (
            <button
              ref={(element) => {
                tabs.current[index] = element;
              }}
              key={value}
              type="button"
              id={`tab-${value}`}
              role="tab"
              aria-selected={period === value}
              aria-controls="insight-panel"
              tabIndex={period === value ? 0 : -1}
              onClick={() => setPeriod(value)}
              onKeyDown={(event) => {
                const target =
                  event.key === 'ArrowRight'
                    ? nextPeriod(period, 1)
                    : event.key === 'ArrowLeft'
                      ? nextPeriod(period, -1)
                      : event.key === 'Home'
                        ? 'day'
                        : event.key === 'End'
                          ? 'month'
                          : null;
                if (target) {
                  event.preventDefault();
                  setPeriod(target);
                  tabs.current[periods.indexOf(target)]?.focus();
                }
              }}
            >
              {t(`insights.${value}`)}
            </button>
          ))}
        </div>
        <Button variant="ghost" icon={RefreshCw} loading={refreshing} onClick={refresh}>
          {t('common.refresh')}
        </Button>
      </div>
      <div className="pull-handle" {...pull()}>
        <ChevronDown size={14} />
        <span>{t('insights.pull')}</span>
      </div>
      <section
        id="insight-panel"
        role="tabpanel"
        aria-labelledby={`tab-${period}`}
        aria-busy={refreshing}
        {...swipe()}
        className="insight-panel"
      >
        <p className="data-label">{t('prototype.synthetic')}</p>
        {refreshing ? (
          <Skeleton lines={6} />
        ) : (
          <>
            <div className="stats-grid">
              <GlassCard>
                <Stat
                  label={t('insights.revenue')}
                  value={data.revenue}
                  currency
                  icon={TrendingUp}
                  detail={
                    <>
                      <ArrowUpRight size={14} /> {number(data.trend)}% · {t('insights.trend')}
                    </>
                  }
                />
              </GlassCard>
              <GlassCard>
                <Stat label={t('insights.bills')} value={data.bills} icon={ReceiptText} />
              </GlassCard>
              <GlassCard>
                <Stat
                  label={t('insights.average')}
                  value={data.average}
                  currency
                  icon={ShoppingBasket}
                />
              </GlassCard>
            </div>
            <div className="insight-grid">
              <GlassCard className="chart-panel">
                <div className="row between">
                  <div>
                    <h2>{t('insights.chart')}</h2>
                    <p className="muted">{t('insights.chartHint')}</p>
                  </div>
                  <ChartNoAxesCombined size={22} className="muted" />
                </div>
                <div
                  className="bar-chart"
                  role="img"
                  aria-label={t('insights.sampleChart', { period: t(`insights.${period}`) })}
                >
                  {data.points.map((value, index) => (
                    <div key={index}>
                      <span
                        className={index === data.points.length - 1 ? 'is-latest' : ''}
                        style={{ blockSize: `${value}%` }}
                      />
                      <small>{labels[index]}</small>
                    </div>
                  ))}
                </div>
                <Sparkline
                  values={data.points}
                  label={t('insights.sampleChart', { period: t(`insights.${period}`) })}
                  className="chart-sparkline"
                />
              </GlassCard>
              <GlassCard className="top-items">
                <h2>{t('insights.top')}</h2>
                <p className="muted">{t('insights.topHint')}</p>
                {sampleItems.slice(0, 3).map((item, index) => (
                  <div className="top-item" key={item.id}>
                    <span className="top-rank">{number(index + 1)}</span>
                    <ProductMark item={item} small />
                    <span>{t(`items.${item.id}`)}</span>
                    <Chip>{t('prototype.short')}</Chip>
                  </div>
                ))}
              </GlassCard>
            </div>
            <div className="insight-nudge">
              <Lightbulb size={26} />
              <div>
                <p className="eyebrow">{t('insights.next')}</p>
                <h2>{t('insights.nextTitle')}</h2>
                <p>{t('insights.nextBody')}</p>
              </div>
              <Link to={`${prefix}/catalog`} className="button button--ghost">
                {t('insights.nextAction')}
                <ArrowRight size={18} />
              </Link>
            </div>
          </>
        )}
      </section>
    </>
  );
}
