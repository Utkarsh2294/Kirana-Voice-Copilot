import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fromPaise, toPaise } from '@kirana/shared/money';
import { convertQty, parseQty, lineAmount } from '@kirana/shared/units';
import { api } from '../api.js';
import { Button } from '../components/primitives.jsx';
import { Sheet, useUi } from '../components/overlays.jsx';
import { NumPad } from '../components/controls.jsx';
import { money } from '../format.js';
import { useDraftBill } from './draft.js';
import PriceDetails from './PriceDetails.jsx';
import './copy.js';

export default function BillPriceSheet({ item, line, mode, onClose, onChange, onResolved }) {
  const { t, i18n } = useTranslation('pricing'),
    { notify } = useUi();
  const [price, setPrice] = useState(fromPaise(line.pricePaise));
  const [quantity, setQuantity] = useState(convertQty(line.qtyBase, item.baseUnit, line.unit));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  let edited = null,
    qtyBase = null,
    amount = null;
  try {
    edited = toPaise(price);
    qtyBase = parseQty(quantity, line.unit);
    if (qtyBase) amount = lineAmount(qtyBase, edited, line.unitSize);
  } catch {
    /* Keep invalid input editable. */
  }
  function apply(changes) {
    onChange(changes);
    onClose();
  }
  async function save(value) {
    setBusy(true);
    setError('');
    try {
      const result = await api(`/merchant-items/${line.id}/price`, {
        method: 'PUT',
        body: { savedPricePaise: value },
      });
      const fields = (quote) => ({
        pricePaise: quote.pricePerBasePaise,
        source: quote.source,
        demo: quote.demo,
        quote,
      });
      onResolved?.(result.price);
      apply(fields(result.price));
      notify(
        t('saved'),
        result.undoId
          ? async () => {
              try {
                const undone = await api(`/merchant-items/${line.id}/price`, {
                  method: 'PUT',
                  body: { undoOf: result.undoId },
                });
                useDraftBill
                  .getState()
                  .update((lines) =>
                    lines.map((row) =>
                      row.id === line.id &&
                      row.quote?.asOf === result.price.asOf &&
                      row.source === result.price.source
                        ? { ...row, ...fields(undone.price) }
                        : row,
                    ),
                  );
                onResolved?.(undone.price);
                notify(t('undone'));
              } catch (error) {
                notify(t(error.code === 'PRICE_CHANGED' ? 'conflict' : 'error'));
              }
            }
          : undefined,
      );
    } catch (error) {
      setError(error.code === 'PRICE_CHANGED' ? 'conflict' : 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('titlePrice', { name: item.names[i18n.language.split('-')[0]] || item.names.en })}
      description={t('priceHint', { unit: t(`common:units.${line.unit}`) })}
    >
      <div className="stack">
        {mode === 'price' ? (
          <NumPad
            value={price}
            onChange={setPrice}
            label={`${t('common:bill.unitPrice')} / ${t(`common:units.${line.unit}`)}`}
          />
        ) : (
          <label className="price-quantity">
            {t('quantity', { unit: t(`common:units.${line.unit}`) })}
            <input
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
        )}
        {amount !== null ? (
          <strong className="money">{t('preview', { amount: money(amount) })}</strong>
        ) : (
          <p className="error-text">{t('invalid')}</p>
        )}
        {error && (
          <p className="error-text" role="alert">
            {t(error)}
          </p>
        )}
        {mode === 'price' ? (
          <>
            <Button
              disabled={busy || amount === null}
              onClick={() => {
                apply({
                  pricePaise: edited,
                  source: 'manual',
                  demo: false,
                  quote: {
                    ...line.quote,
                    source: 'manual',
                    demo: false,
                    asOf: new Date().toISOString(),
                    nudges: [],
                    fallbackReason: null,
                  },
                });
                notify(t('changed'));
              }}
            >
              {t('thisBill')}
            </Button>
            <Button
              variant="action"
              disabled={busy || amount === null}
              onClick={() => save(edited)}
            >
              {t('save')}
            </Button>
            {item.catalogItemId && (
              <Button variant="ghost" disabled={busy} onClick={() => save(null)}>
                {t('reset')}
              </Button>
            )}
          </>
        ) : (
          <Button disabled={busy || amount === null} onClick={() => apply({ qtyBase })}>
            {t('saveQuantity')}
          </Button>
        )}
        <PriceDetails itemId={item.id} price={line.quote} />
      </div>
    </Sheet>
  );
}
