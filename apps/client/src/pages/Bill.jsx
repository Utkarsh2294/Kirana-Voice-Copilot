import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  AudioLines,
  ChevronRight,
  CircleHelp,
  CornerDownLeft,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBasket,
  UserRound,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mulDivRound, toPaise, fromPaise } from '@kirana/shared/money';
import { BillLine, ProductMark } from '../components/BillLine.jsx';
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  ListenButton,
  PageHeading,
  AnimatedNumber,
} from '../components/primitives.jsx';
import { ConfirmDialog, Sheet, useUi } from '../components/overlays.jsx';
import { NumPad, QuantityStepper } from '../components/controls.jsx';
import { sampleItems, itemById } from '../prototype/sample-data.js';
import { sampleTotal, useSampleBill } from '../prototype/store.js';
import { money, number } from '../format.js';
import { feedback } from '../feedback.js';

export default function Bill() {
  const { t } = useTranslation();
  const { lines, add, remove, restore, edit, clear, reset } = useSampleBill();
  const { notify, read } = useUi();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('0');
  const [confirm, setConfirm] = useState(false);
  const [payment, setPayment] = useState(false);
  const searchRef = useRef();
  useEffect(() => {
    function shortcut(event) {
      if (
        event.key === '/' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  const total = sampleTotal(lines);
  const filtered = sampleItems.filter((item) =>
    [t(`items.${item.id}`), item.id].some((name) =>
      name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    ),
  );
  function addItem(item) {
    add(item.id);
    feedback();
    notify(t('bill.added', { item: t(`items.${item.id}`) }));
  }
  function deleteLine(line, index) {
    remove(line.id);
    notify(t('bill.removed', { item: t(`items.${line.id}`) }), () => restore(line, index));
  }
  function openEdit(line, mode) {
    setQty(line.qtyBase);
    setPrice(fromPaise(line.pricePaise));
    setEditing({ id: line.id, mode });
  }
  const editingItem = editing && itemById[editing.id];
  let validPrice = null;
  try {
    if (price !== '') {
      const parsed = toPaise(price);
      if (parsed <= 9999999) validPrice = parsed;
    }
  } catch {
    /* Keep the last valid stored price until Apply. */
  }
  const speech = () =>
    `${lines.map((line) => `${t(`items.${line.id}`)}, ${number(line.qtyBase / itemById[line.id].size)} ${t(`units.${itemById[line.id].unit}`)}, ${money(mulDivRound(line.qtyBase, line.pricePaise, itemById[line.id].size))}`).join('.\n')}\n${t('bill.total')}: ${money(total)}.`;
  return (
    <>
      <PageHeading
        eyebrow={t('bill.eyebrow')}
        title={t('bill.title')}
        accent={t('bill.titleAccent')}
        description={t('bill.subtitle')}
        action={
          <Button variant="ghost" icon={Plus} onClick={() => setConfirm(true)}>
            {t('bill.new')}
          </Button>
        }
      />
      <div className="bill-layout">
        <div className="bill-main">
          <section className="bill-panel" aria-label={t('bill.current')}>
            <div className="bill-panel-heading">
              <div className="row">
                <ReceiptText size={18} />
                <h2>{t('bill.current')}</h2>
                <Chip>
                  {t('bill.lineCount', {
                    count: lines.length,
                    formattedCount: number(lines.length),
                  })}
                </Chip>
              </div>
              <span className="sample-number">{t('bill.number')}</span>
            </div>
            <button
              className="customer-strip"
              type="button"
              onClick={() => notify(t('bill.customerHint'))}
            >
              <UserRound size={18} />
              <span>{t('bill.customer')}</span>
              <span className="customer-add">
                {t('bill.addCustomer')}
                <Plus size={14} />
              </span>
            </button>
            <div className="line-columns" aria-hidden="true">
              <span>{t('bill.item')}</span>
              <span>{t('bill.quantity')}</span>
              <span>{t('bill.amount')}</span>
            </div>
            {lines.length ? (
              <ul className="bill-lines">
                <AnimatePresence initial={false}>
                  {lines.map((line, index) => (
                    <BillLine
                      key={line.id}
                      item={itemById[line.id]}
                      line={line}
                      onRemove={() => deleteLine(line, index)}
                      onEdit={() => openEdit(line, 'price')}
                      onQuantity={() => openEdit(line, 'quantity')}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <EmptyState
                icon={ShoppingBasket}
                title={t('bill.empty')}
                description={t('bill.emptyBody')}
              />
            )}
            <div className="bill-panel-footer">
              <CircleHelp size={14} />
              <span>{t('bill.gestureHint')}</span>
            </div>
          </section>
          <div className="search-field">
            <Search size={19} />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('bill.search')}
              aria-label={t('bill.search')}
              aria-describedby="search-hint"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && filtered[0]) {
                  addItem(filtered[0]);
                  setSearch('');
                }
                if (event.key === 'Escape') {
                  setSearch('');
                  event.target.blur();
                }
              }}
            />
            {search ? (
              <IconButton icon={X} label={t('bill.clearSearch')} onClick={() => setSearch('')} />
            ) : (
              <kbd>/</kbd>
            )}
          </div>
          <span id="search-hint" className="sr-only">
            {t('bill.enterToAdd')}
          </span>
          <section className="quick-add">
            <div className="row between">
              <h2>{t('bill.quickAdd')}</h2>
              <Link to="/catalog">
                {t('bill.allItems')}
                <ChevronRight size={14} />
              </Link>
            </div>
            <div className="quick-grid">
              {filtered.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="quick-item"
                  onClick={() => addItem(item)}
                  aria-label={t('bill.selectItem', { item: t(`items.${item.id}`) })}
                >
                  <ProductMark item={item} small />
                  <span>
                    <strong>{t(`items.${item.id}`)}</strong>
                    <small>
                      {money(item.pricePaise)} / {t(`units.${item.unit}`)}
                    </small>
                  </span>
                  <Plus size={15} />
                </button>
              ))}
            </div>
            {filtered.length === 0 && (
              <EmptyState
                icon={Search}
                title={t('bill.noResults')}
                description={t('catalog.emptyBody')}
              />
            )}
          </section>
        </div>
        <aside className="bill-aside">
          <section className="summary-panel">
            <div className="row between">
              <h2>{t('bill.summary')}</h2>
              <ReceiptText size={18} className="muted" />
            </div>
            <div className="summary-divider" />
            <div className="summary-row">
              <span>{t('bill.subtotal')}</span>
              <span className="money">{money(total)}</span>
            </div>
            <div className="summary-row">
              <span>{t('bill.discount')}</span>
              <span className="muted">{t('bill.discountValue')}</span>
            </div>
            <div className="summary-total">
              <p>{t('bill.total')}</p>
              <AnimatedNumber className="hero-total" value={total} currency />
              <p className="summary-caption">{t('bill.including')}</p>
            </div>
            <Button
              variant="action"
              className="button--full"
              icon={ArrowRight}
              onClick={() => setPayment(true)}
              disabled={!lines.length}
            >
              {t('bill.payment')}
            </Button>
            <p className="payment-hint">
              <ShieldCheck size={13} />
              {t('bill.paymentHint')}
            </p>
            <div className="summary-listen">
              <ListenButton label={t('bill.read')} onClick={() => read(speech)} />
            </div>
          </section>
          <section className="voice-tip">
            <span className="tip-icon">
              <AudioLines size={22} />
            </span>
            <h3>{t('bill.tipTitle')}</h3>
            <p>{t('bill.tip')}</p>
            <p className="voice-tip-label">
              <CornerDownLeft size={14} />
              {t('prototype.voice')}
            </p>
          </section>
          <button
            className="reset-sample"
            type="button"
            onClick={() => {
              reset();
              notify(t('bill.changed'));
            }}
          >
            {t('common.reset')}
          </button>
        </aside>
      </div>
      <p className="bill-disclaimer">
        <FlaskIcon />
        {t('prototype.noPersistence')}
      </p>
      <Sheet
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={
          editingItem
            ? t(editing.mode === 'price' ? 'bill.priceFor' : 'bill.quantityFor', {
                item: t(`items.${editingItem.id}`),
              })
            : ''
        }
        description={
          editingItem && editing.mode === 'price'
            ? t('bill.priceHint', { unit: t(`units.${editingItem.unit}`) })
            : t('prototype.priceNotSaved')
        }
      >
        {editingItem && (
          <div className="stack">
            {editing.mode === 'price' ? (
              <NumPad
                value={price}
                onChange={setPrice}
                label={`${t('bill.unitPrice')} / ${t(`units.${editingItem.unit}`)}`}
              />
            ) : (
              <QuantityStepper
                valueBase={qty}
                onChange={setQty}
                size={editingItem.size}
                unit={editingItem.unit}
              />
            )}
            <div className="row between">
              <span className="muted">{t('bill.lineTotal')}</span>
              <strong className="money">
                {money(mulDivRound(qty, validPrice ?? 0, editingItem.size))}
              </strong>
            </div>
            {validPrice === null && (
              <p className="error-text" role="alert">
                {t('bill.invalidPrice')}
              </p>
            )}
            <Button
              variant="action"
              onClick={() => {
                edit(
                  editing.id,
                  editing.mode === 'price'
                    ? { pricePaise: validPrice, source: 'manual' }
                    : { qtyBase: qty },
                );
                setEditing(null);
                feedback();
                notify(t('bill.changed'));
              }}
              disabled={validPrice === null}
            >
              {t('bill.applyBill')}
            </Button>
            <ListenButton
              onClick={() =>
                read(
                  `${t(`items.${editingItem.id}`)}, ${t('bill.lineTotal')}: ${money(mulDivRound(qty, validPrice ?? 0, editingItem.size))}`,
                )
              }
            />
          </div>
        )}
      </Sheet>
      <Sheet
        open={payment}
        onOpenChange={setPayment}
        title={t('bill.payment')}
        description={t('prototype.noPayments')}
      >
        <div className="stack">
          <strong className="money hero-total">{money(total)}</strong>
          <p className="phase-note">{t('prototype.noPayments')}</p>
          <Button onClick={() => setPayment(false)}>{t('common.back')}</Button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('bill.newConfirm')}
        description={t('bill.newBody')}
        onConfirm={() => {
          clear();
          notify(t('bill.changed'));
        }}
        confirmLabel={t('bill.new')}
      />
    </>
  );
}

function FlaskIcon() {
  return <CircleHelp size={14} />;
}
