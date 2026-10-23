import React from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PriceSourceBadge } from '../components/primitives.jsx';
import { money } from '../format.js';
import './copy.js';

export function itemName(item, language) {
  return item.names[language.split('-')[0]] || item.names.en;
}
export default function FavouritesStrip({ items, onPick }) {
  const { t, i18n } = useTranslation('catalog');
  if (!items.length) return null;
  return (
    <section className="catalog-favourites">
      <div>
        <Star size={18} aria-hidden="true" />
        <h2>{t('favouritesTitle')}</h2>
      </div>
      <p>{t('favouritesHint')}</p>
      <div className="catalog-favourites-scroll">
        {items.map((item) => (
          <button type="button" key={item.id} onClick={() => onPick(item)}>
            <strong>{itemName(item, i18n.language)}</strong>
            <span>
              {money(item.pricePaise)} / {t(`units.${item.priceUnit}`)}
            </span>
            <PriceSourceBadge source={item.priceSource} demo={item.pricing?.demo} />
          </button>
        ))}
      </div>
    </section>
  );
}
