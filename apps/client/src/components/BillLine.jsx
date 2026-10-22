import React, { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import {
  Candy,
  Coffee,
  Cookie,
  Droplet,
  Milk,
  Package,
  Pencil,
  ShoppingBag,
  Trash2,
  Wheat,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mulDivRound } from '@kirana/shared/money';
import { IconButton, PriceSourceBadge } from './primitives.jsx';
import { useReducedMotion } from './PreferencesProvider.jsx';
import { money, number } from '../format.js';

export function ProductMark({ item, small = false }) {
  const Icon =
    {
      rice: Wheat,
      milk: Milk,
      oil: Droplet,
      sugar: Candy,
      tea: Coffee,
      atta: Wheat,
      soap: Package,
      biscuits: Cookie,
    }[item.id] || ShoppingBag;
  return (
    <span
      className={`product-mark product-mark--${item.tone || 'blue'} ${small ? 'product-mark--small' : ''}`}
      aria-hidden="true"
    >
      <Icon size={small ? 20 : 24} strokeWidth={1.5} />
    </span>
  );
}

export function BillLine({ item, line, onRemove, onEdit, onQuantity, name }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const hold = useRef();
  const origin = useRef();
  const held = useRef(false);
  useEffect(() => () => clearTimeout(hold.current), []);
  const label = name || t(`items.${item.id}`);
  const amount = mulDivRound(line.qtyBase, line.pricePaise, item.size);
  return (
    <m.li
      layout={reduce ? false : 'position'}
      className="bill-line"
      initial={{ opacity: 0, transform: reduce ? 'none' : 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'none' }}
      exit={{ opacity: 0 }}
      transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="swipe-hints" aria-hidden="true">
        <Pencil size={20} />
        <Trash2 size={20} />
      </div>
      <m.div
        className="bill-line-content"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        dragSnapToOrigin
        onDragStart={() => clearTimeout(hold.current)}
        onDragEnd={(_event, info) => {
          if (held.current) return;
          if (info.offset.x < -70) onRemove();
          else if (info.offset.x > 70) onEdit();
        }}
        onPointerDown={(event) => {
          if (event.target.closest('button')) return;
          held.current = false;
          origin.current = [event.clientX, event.clientY];
          hold.current = setTimeout(() => {
            held.current = true;
            onEdit();
          }, 500);
        }}
        onPointerMove={(event) => {
          if (
            origin.current &&
            Math.hypot(event.clientX - origin.current[0], event.clientY - origin.current[1]) > 8
          )
            clearTimeout(hold.current);
        }}
        onPointerUp={() => clearTimeout(hold.current)}
        onPointerCancel={() => clearTimeout(hold.current)}
      >
        <ProductMark item={item} />
        <div className="bill-line-name">
          <p>{label}</p>
          <div className="bill-line-meta">
            <span>
              {money(line.pricePaise)} / {t(`units.${item.unit}`)}
            </span>
            <PriceSourceBadge source={line.source || 'demo'} />
          </div>
        </div>
        <button
          className="quantity-pill"
          type="button"
          onPointerDownCapture={(event) => event.stopPropagation()}
          onClick={onQuantity}
          aria-label={t('bill.quantityFor', { item: label })}
        >
          {number(line.qtyBase / item.size, { maximumFractionDigits: 3 })}
          <span>{t(`units.${item.unit}`)}</span>
        </button>
        <span className="bill-line-amount money">{money(amount)}</span>
        <div className="bill-line-actions">
          <IconButton
            icon={Pencil}
            label={t('bill.editItem', { item: label })}
            onPointerDownCapture={(event) => event.stopPropagation()}
            onClick={onEdit}
          />
          <IconButton
            icon={Trash2}
            label={t('bill.removeItem', { item: label })}
            onPointerDownCapture={(event) => event.stopPropagation()}
            onClick={onRemove}
          />
        </div>
      </m.div>
    </m.li>
  );
}
