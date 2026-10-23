import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PriceSourceBadge } from '../components/primitives.jsx';
import { api } from '../api.js';
import { money, date } from '../format.js';
import './copy.js';
import './pricing.css';

export function PriceMeta({ price }) {
  const { t } = useTranslation('pricing');
  if (!price) return null;
  return (
    <div className="price-meta">
      <div className="row">
        <PriceSourceBadge source={price.source} demo={price.demo} />
        {price.asOf && (
          <span>
            {t('asOf', {
              date: date(new Date(price.asOf), { day: 'numeric', month: 'short', year: 'numeric' }),
            })}
          </span>
        )}
      </div>
      {price.stale && <p className="warning-text">{t('stale')}</p>}
      {price.fallbackReason && <p>{t(price.fallbackReason)}</p>}
      {(price.nudges || []).map((nudge) => (
        <p className="warning-text" key={nudge}>
          {t(nudge)}
        </p>
      ))}
    </div>
  );
}
export default function PriceDetails({ itemId, price }) {
  const { t } = useTranslation('pricing');
  const [history, setHistory] = useState(null);
  useEffect(() => {
    let active = true;
    api(`/pricing/history/${itemId}`)
      .then((value) => {
        if (active) setHistory(value);
      })
      .catch(() => {
        if (active) setHistory({ error: true });
      });
    return () => {
      active = false;
    };
  }, [itemId, price?.asOf]);
  const points = history?.market || [],
    values = points.map((point) => point.retailEstimatePaise);
  const low = values.length ? Math.min(...values) : 0,
    high = values.length ? Math.max(...values) : 0;
  const path = points
    .map(
      (point, index) =>
        `${points.length === 1 ? 150 : 4 + (index / (points.length - 1)) * 292},${66 - ((point.retailEstimatePaise - low) / Math.max(1, high - low)) * 58}`,
    )
    .join(' ');
  return (
    <section className="price-details">
      <PriceMeta price={price} />
      <h3>{t('history')}</h3>
      {history?.error ? (
        <p>{t('error')}</p>
      ) : !history ? (
        <p aria-busy="true">{t('common:common.loading')}</p>
      ) : points.length ? (
        <>
          <svg
            className="price-sparkline"
            viewBox="0 0 300 72"
            role="img"
            aria-label={t('historyLabel', { count: points.length })}
          >
            <polyline
              points={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <p>{t('range', { low: money(low), high: money(high) })}</p>
          {points.some((point) => point.source === 'simulated') && (
            <PriceSourceBadge source="demo" />
          )}
        </>
      ) : (
        <p>{t('historyEmpty')}</p>
      )}
      <h3>{t('ownHistory')}</h3>
      {history?.own?.length ? (
        <ul>
          {history.own.slice(0, 5).map((change) => (
            <li key={change._id}>
              {t('priceChanged', {
                old: change.oldPaise == null ? t('unset') : money(change.oldPaise),
                next: change.newPaise == null ? t('unset') : money(change.newPaise),
              })}{' '}
              · {date(new Date(change.at), { day: 'numeric', month: 'short' })}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('noChanges')}</p>
      )}
    </section>
  );
}
