import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Plus, Search, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sampleItems } from '../prototype/sample-data.js';
import { useSampleBill } from '../prototype/store.js';
import {
  Button,
  EmptyState,
  ListenButton,
  PageHeading,
  PriceSourceBadge,
} from '../components/primitives.jsx';
import { ProductMark } from '../components/BillLine.jsx';
import { useUi } from '../components/overlays.jsx';
import { money, number } from '../format.js';
import { feedback } from '../feedback.js';

export default function Catalog() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const { add, lines } = useSampleBill();
  const { notify, read } = useUi();
  const items = sampleItems.filter(
    (item) =>
      (category === 'all' || item.category === category) &&
      [t(`items.${item.id}`), item.id].some((name) =>
        name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      ),
  );
  return (
    <>
      <PageHeading
        eyebrow={t('catalog.eyebrow')}
        title={t('catalog.title')}
        accent={t('catalog.titleAccent')}
        description={t('catalog.subtitle')}
        action={
          <ListenButton
            onClick={() =>
              read(() =>
                items
                  .map(
                    (item) =>
                      `${t(`items.${item.id}`)}, ${money(item.pricePaise)} ${t('bill.perUnit', { unit: t(`units.${item.unit}`) })}`,
                  )
                  .join('.\n'),
              )
            }
          />
        }
      />
      <div className="catalog-toolbar">
        <div className="search-field">
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('bill.search')}
            aria-label={t('bill.search')}
          />
        </div>
        <Link to="/bill" className="button button--ghost">
          {t('catalog.openBill')}
          <ArrowRight size={18} />
        </Link>
      </div>
      <div className="category-tabs" role="group" aria-label={t('nav.catalog')}>
        {['all', 'staples', 'dairy', 'pantry', 'care'].map((value) => (
          <Button
            key={value}
            variant={category === value ? 'primary' : 'ghost'}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {t(`catalog.${value}`)}
          </Button>
        ))}
      </div>
      <p className="muted catalog-count" role="status">
        {t('catalog.count', { count: items.length, formattedCount: number(items.length) })}
      </p>
      <div className="catalog-grid">
        {items.map((item) => (
          <article className="catalog-item" key={item.id}>
            <div className="row between">
              <ProductMark item={item} />
              <ListenButton
                compact
                label={`${t('voice.listen')}: ${t(`items.${item.id}`)}`}
                onClick={() =>
                  read(
                    `${t(`items.${item.id}`)}, ${money(item.pricePaise)} ${t('bill.perUnit', { unit: t(`units.${item.unit}`) })}`,
                  )
                }
              />
            </div>
            <h2>{t(`items.${item.id}`)}</h2>
            <p className="muted">{t(`items.${item.id}Detail`)}</p>
            <div className="row between">
              <strong className="money">
                {money(item.pricePaise)}
                <span> / {t(`units.${item.unit}`)}</span>
              </strong>
              <PriceSourceBadge source="demo" />
            </div>
            <Button
              variant="ghost"
              icon={lines.some((line) => line.id === item.id) ? Check : Plus}
              onClick={() => {
                add(item.id);
                feedback();
                notify(t('bill.added', { item: t(`items.${item.id}`) }));
              }}
            >
              {t('catalog.add')}
            </Button>
          </article>
        ))}
      </div>
      {!items.length && (
        <EmptyState
          icon={ShoppingBag}
          title={t('catalog.empty')}
          description={t('catalog.emptyBody')}
        />
      )}
    </>
  );
}
