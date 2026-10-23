import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ReceiptText, ShoppingBasket } from 'lucide-react';
import { addPaise } from '@kirana/shared/money';
import { formatQty, lineAmount } from '@kirana/shared/units';
import { api } from '../api.js';
import { useSession } from '../auth/Session.jsx';
import { BillLine } from '../components/BillLine.jsx';
import {
  Button,
  EmptyState,
  ListenButton,
  PageHeading,
  PriceSourceBadge,
  Skeleton,
} from '../components/primitives.jsx';
import { ConfirmDialog, useUi } from '../components/overlays.jsx';
import { money, date } from '../format.js';
import { useDraftBill } from './draft.js';
import './copy.js';
import './pricing.css';
import '../pages/bill.css';

const BillPriceSheet = lazy(() => import('./BillPriceSheet.jsx'));
const nameFor = (item, lang) => item.names[lang.split('-')[0]] || item.names.en;
export default function PriceBill() {
  const { t, i18n } = useTranslation('pricing');
  const { merchant } = useSession();
  const draft = useDraftBill();
  const lines = draft.merchantId === merchant.id ? draft.lines : [];
  const { notify, read } = useUi();
  const [items, setItems] = useState([]),
    [index, setIndex] = useState(null),
    [search, setSearch] = useState('');
  const searchRequest = useRef(null);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [editing, setEditing] = useState(null),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    useDraftBill.getState().open(merchant.id);
  }, [merchant.id]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    searchRequest.current = null;
    setIndex(null);
    api('/merchant-items')
      .then(async (response) => {
        if (!active) return;
        setItems(response.items);
      })
      .catch(() => {
        if (active) setError('load');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [merchant.id, reload]);
  function loadSearch() {
    if (items.length && !searchRequest.current)
      searchRequest.current = import('@kirana/shared/catalog-search')
        .then(({ createCatalogSearch }) => setIndex(createCatalogSearch(items)))
        .catch(() => {
          searchRequest.current = null;
          setError('load');
        });
  }
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const results = (
    search.trim()
      ? index?.search(search, { limit: 12 }) || []
      : items.filter((item) => item.favourite).slice(0, 8)
  ).map((item) => byId.get(item.id) || item);
  const total = addPaise(
    ...lines.map((line) => lineAmount(line.qtyBase, line.pricePaise, line.unitSize)),
  );
  const current = lines.find((line) => line.id === editing?.id),
    item = current && byId.get(current.id);
  async function add(item) {
    setBusy(true);
    setError('');
    try {
      const { prices } = await api('/pricing/resolve', {
        method: 'POST',
        body: { itemIds: [item.id] },
      });
      const quote = prices[0];
      draft.update((lines) =>
        lines.some((line) => line.id === item.id)
          ? lines.map((line) =>
              line.id === item.id ? { ...line, qtyBase: line.qtyBase + line.unitSize } : line,
            )
          : [
              ...lines,
              {
                id: item.id,
                qtyBase: quote.unitSize,
                pricePaise: quote.pricePerBasePaise,
                unitSize: quote.unitSize,
                unit: quote.unit,
                source: quote.source,
                demo: quote.demo,
                quote,
              },
            ],
      );
      notify(t('added', { name: nameFor(item, i18n.language) }));
    } catch {
      setError('load');
    } finally {
      setBusy(false);
    }
  }
  function edit(line, mode) {
    setEditing({ id: line.id, mode });
  }
  function remove(line, index) {
    draft.update((lines) => lines.filter((row) => row.id !== line.id));
    notify(t('common:bill.removed', { item: nameFor(byId.get(line.id), i18n.language) }), () =>
      draft.update((lines) =>
        lines.some((row) => row.id === line.id)
          ? lines
          : [...lines.slice(0, index), line, ...lines.slice(index)],
      ),
    );
  }
  const speech = () =>
    lines
      .map(
        (line) =>
          `${nameFor(byId.get(line.id), i18n.language)}. ${formatQty(line.qtyBase, byId.get(line.id).baseUnit, { locale: i18n.language })}. ${money(lineAmount(line.qtyBase, line.pricePaise, line.unitSize))}`,
      )
      .join('. ') + `. ${t('total')}: ${money(total)}`;
  return (
    <>
      <PageHeading
        eyebrow={t('common:bill.eyebrow')}
        title={t('title')}
        description={t('description')}
        action={
          <Button variant="ghost" icon={Plus} disabled={busy} onClick={() => setConfirm(true)}>
            {t('nextBill')}
          </Button>
        }
      />
      <p className="price-bill-notice">{t('draftNotice')}</p>
      <div className="bill-layout">
        <div className="bill-main">
          <section className="bill-panel" aria-label={t('common:bill.current')}>
            <div className="bill-panel-heading">
              <div className="row">
                <ReceiptText size={18} />
                <h2>{t('common:bill.current')}</h2>
              </div>
            </div>
            {lines.length && items.length ? (
              <ul className="bill-lines">
                {lines.map((line, index) => {
                  const item = byId.get(line.id);
                  if (!item) return null;
                  return (
                    <React.Fragment key={line.id}>
                      <BillLine
                        item={{ ...item, size: line.unitSize, unit: line.unit }}
                        line={line}
                        name={nameFor(item, i18n.language)}
                        onRemove={() => remove(line, index)}
                        onEdit={() => edit(line, 'price')}
                        onQuantity={() => edit(line, 'quantity')}
                      />
                      <li className="price-bill-line-meta">
                        <PriceSummary price={line.quote} />
                      </li>
                    </React.Fragment>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={ShoppingBasket} title={t('empty')} description={t('emptyBody')} />
            )}
          </section>
          <label className="price-bill-search">
            {t('search')}
            <input
              type="search"
              maxLength={120}
              placeholder={t('searchHint')}
              onFocus={loadSearch}
              disabled={loading}
              value={search}
              onChange={(event) => {
                loadSearch();
                setSearch(event.target.value);
              }}
            />
          </label>
          {loading ? (
            <Skeleton lines={3} />
          ) : error === 'load' ? (
            <div>
              <p className="error-text" role="alert">
                {t('unavailable')}
              </p>
              <Button onClick={() => setReload((value) => value + 1)}>{t('retry')}</Button>
            </div>
          ) : (
            <div className="price-bill-results">
              {results.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  disabled={busy}
                  onClick={() => add(item)}
                  aria-label={t('add', { name: nameFor(item, i18n.language) })}
                >
                  <strong>{nameFor(item, i18n.language)}</strong>
                  <small>
                    {money(item.pricePaise)} / {t(`common:units.${item.priceUnit}`)}
                  </small>
                  <PriceSourceBadge source={item.priceSource} demo={item.pricing?.demo} />
                </button>
              ))}
            </div>
          )}
          {search && !results.length && !loading && <p className="muted">{t('noResults')}</p>}
        </div>
        <aside className="price-bill-total">
          <span>{t('total')}</span>
          <strong>{money(total)}</strong>
          <ListenButton onClick={() => read(speech)} label={t('read')} />
          <p>{t('futurePayments')}</p>
        </aside>
      </div>
      {current && item && (
        <Suspense fallback={<Skeleton lines={2} />}>
          <BillPriceSheet
            item={item}
            line={current}
            mode={editing.mode}
            onClose={() => setEditing(null)}
            onResolved={(quote) =>
              setItems((items) =>
                items.map((item) =>
                  item.id === quote.itemId
                    ? {
                        ...item,
                        pricePaise: quote.pricePerBasePaise,
                        priceSource: quote.source,
                        pricing: quote,
                      }
                    : item,
                ),
              )
            }
            onChange={(changes) =>
              draft.update((lines) =>
                lines.map((line) => (line.id === current.id ? { ...line, ...changes } : line)),
              )
            }
          />
        </Suspense>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('newTitle')}
        description={t('newBody')}
        confirmLabel={t('nextBill')}
        onConfirm={() => draft.update(() => [])}
      />
    </>
  );
}
function PriceSummary({ price }) {
  const { t } = useTranslation('pricing');
  const parts = [
    price?.asOf
      ? t('asOf', {
          date: date(new Date(price.asOf), { day: 'numeric', month: 'short', year: 'numeric' }),
        })
      : '',
    price?.stale ? t('stale') : price?.fallbackReason ? t(price.fallbackReason) : '',
  ];
  return <span className="muted">{parts.filter(Boolean).join(' · ')}</span>;
}
