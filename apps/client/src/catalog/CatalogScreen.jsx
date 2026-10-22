import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  EyeOff,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Star,
  Volume2,
  Package,
  Wheat,
  Milk,
  Droplet,
  Leaf,
  Coffee,
  Cookie,
  Pencil,
} from 'lucide-react';
import { createCatalogSearch } from '@kirana/shared/catalog-search';
import {
  amountToQuantity,
  formatQty,
  lineAmount,
  parseQty,
  priceUnit,
  quantityImplausible,
} from '@kirana/shared/units';
import { fromPaise, toPaise } from '@kirana/shared/money';
import { api } from '../api.js';
import { useSession } from '../auth/Session.jsx';
import {
  Button,
  EmptyState,
  IconButton,
  ListenButton,
  PageHeading,
  PriceSourceBadge,
  Skeleton,
  Toggle,
} from '../components/primitives.jsx';
import { NumPad } from '../components/controls.jsx';
import { ConfirmDialog, Sheet, useUi } from '../components/overlays.jsx';
import { money, number } from '../format.js';
import { readCatalogCache, writeCatalogCache } from './cache.js';
import FavouritesStrip, { itemName } from './FavouritesStrip.jsx';
import './copy.js';
import './catalog.css';

const icons = {
  staples: Wheat,
  oils: Droplet,
  spices: Leaf,
  dairy: Milk,
  bakery: Cookie,
  snacks: Cookie,
  beverages: Coffee,
  vegetables: Leaf,
  stationery: Pencil,
};
const defaultCustom = {
  name: '',
  unit: 'kg',
  kind: 'loose',
  price: '',
  cost: '',
  favourite: false,
};
const emptyItems = Object.freeze([]);
export default function CatalogScreen() {
  const { t, i18n } = useTranslation('catalog');
  const { merchant } = useSession();
  const client = useQueryClient();
  const { notify, read } = useUi();
  const [cached, setCached] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showHidden, setShowHidden] = useState(false);
  const [limit, setLimit] = useState(24);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [custom, setCustom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [budget, setBudget] = useState('');
  const key = ['catalog', merchant.id];
  useEffect(() => {
    let active = true;
    readCatalogCache(merchant.id)
      .then((value) => {
        if (active && value) setCached({ ...value, cached: true, storageAvailable: true });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [merchant.id]);
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    return () => {
      window.removeEventListener('online', changed);
      window.removeEventListener('offline', changed);
    };
  }, []);
  const query = useQuery({
    queryKey: key,
    placeholderData: cached,
    staleTime: (query) => (query.state.data?.cached ? 0 : 60_000),
    queryFn: async ({ signal }) => {
      try {
        const response = await api('/merchant-items?includeHidden=true', { signal });
        let storageAvailable = true;
        try {
          await writeCatalogCache(merchant.id, response.items);
        } catch {
          storageAvailable = false;
        }
        return { ...response, cached: false, storageAvailable };
      } catch (error) {
        if (error.status && error.status < 500) throw error;
        const snapshot = await readCatalogCache(merchant.id).catch(() => null);
        if (snapshot) return { ...snapshot, cached: true, storageAvailable: true };
        throw error;
      }
    },
  });
  const items = query.data?.items || emptyItems;
  const index = useMemo(() => createCatalogSearch(items), [items]);
  const allCategories = [...new Set(items.map((item) => item.category))];
  const searched = search.trim() ? index.search(search, { limit: items.length }) : items;
  const filtered = searched.filter(
    (item) => (showHidden || !item.hidden) && (category === 'all' || item.category === category),
  );
  const visible = filtered.slice(0, limit);
  const item = items.find((item) => item.id === editing);
  const readonly = !online || Boolean(query.data?.cached) || query.isPlaceholderData;
  const errorText = error
    ? t(`auth:errors.${error}`, { defaultValue: t('auth:errors.fallback') })
    : '';
  function changeSearch(value) {
    setSearch(value.slice(0, 120));
    setLimit(24);
  }
  function openItem(item) {
    setEditing(item.id);
    setDraft({
      price: fromPaise(item.pricePaise),
      cost: item.costPricePaise === null ? '' : fromPaise(item.costPricePaise),
      unit: item.unit,
      hidden: item.hidden,
      favourite: item.favourite,
    });
    setQuantity('1');
    setBudget('');
    setError('');
  }
  function updateCachedItem(next, deleted = false) {
    client.setQueryData(key, (previous) => {
      const list = previous?.items || items;
      const existing = list.some((item) => item.id === next.id);
      const result = deleted
        ? list.filter((item) => item.id !== next.id)
        : existing
          ? list.map((item) => (item.id === next.id ? next : item))
          : [next, ...list];
      writeCatalogCache(merchant.id, result).catch(() => {});
      return { ...previous, items: result, cached: false };
    });
  }
  async function mutate(path, method, body, message, { close = true, deleted = false } = {}) {
    setBusy(true);
    setError('');
    try {
      await client.cancelQueries({ queryKey: key });
      const result = await api(path, { method, ...(body === undefined ? {} : { body }) });
      if (deleted) updateCachedItem(item, true);
      else if (result?.item) updateCachedItem(result.item);
      notify(t(message));
      if (close) {
        setEditing(null);
        setCustom(null);
      }
      return true;
    } catch (error) {
      setError(error.code);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function saveItem(event) {
    event.preventDefault();
    try {
      const price = toPaise(draft.price),
        cost = draft.cost === '' ? null : toPaise(draft.cost);
      const body = {
        unit: draft.unit,
        hidden: draft.hidden,
        favourite: draft.favourite,
        costPricePaise: cost,
      };
      if (price !== item.pricePaise) body.savedPricePaise = price;
      mutate(`/merchant-items/${item.id}`, 'PUT', body, 'saved');
    } catch {
      setError('VALIDATION_FAILED');
    }
  }
  async function favourite(item) {
    await mutate(`/merchant-items/${item.id}`, 'PUT', { favourite: !item.favourite }, 'saved', {
      close: false,
    });
  }
  function createItem(event) {
    event.preventDefault();
    try {
      mutate(
        '/merchant-items/custom',
        'POST',
        {
          name: custom.name,
          unit: custom.unit,
          kind: custom.kind,
          savedPricePaise: toPaise(custom.price),
          costPricePaise: custom.cost === '' ? null : toPaise(custom.cost),
          favourite: custom.favourite,
        },
        'created',
      );
    } catch {
      setError('VALIDATION_FAILED');
    }
  }
  function speakItem(item) {
    read(
      `${itemName(item, i18n.language)}. ${money(item.pricePaise)} / ${t(`units.${item.priceUnit}`)}. ${t('auth:speechNote')}`,
    );
  }
  const qtyText = (qty, base) =>
    formatQty(qty, base, { locale: i18n.language, unitLabel: (unit) => t(`units.${unit}`) });
  let preview = null,
    inversion = null,
    warning = false;
  if (item && draft)
    try {
      const qty = parseQty(quantity, draft.unit),
        price = toPaise(draft.price);
      preview = t('previewAmount', {
        quantity: qtyText(qty, item.baseUnit),
        amount: money(lineAmount(qty, price, item.unitSize)),
      });
      warning = quantityImplausible(qty, item);
      if (budget && price > 0)
        inversion = amountToQuantity(
          toPaise(budget),
          price,
          item.unitSize,
          item.baseUnit === 'pc' ? 1 : 10,
        );
    } catch {
      /* Invalid input remains editable; the save path validates it. */
    }

  return (
    <div className="live-catalog">
      <PageHeading
        eyebrow={t('eyebrow')}
        title={t('title')}
        accent={t('accent')}
        description={t('description')}
        action={
          <Button
            variant="action"
            icon={Plus}
            disabled={readonly || busy || !query.data}
            onClick={() => {
              setCustom({ ...defaultCustom });
              setError('');
            }}
          >
            {t('addCustom')}
          </Button>
        }
      />
      <p className="catalog-draft-notice">{t('draftNotice')}</p>
      {query.data?.cached && (
        <p className="catalog-cache-note" role="status">
          {t('cached')}
        </p>
      )}
      {query.data?.storageAvailable === false && (
        <p className="catalog-cache-note" role="status">
          {t('storageUnavailable')}
        </p>
      )}
      <div className="catalog-search-row">
        <label>
          <span className="sr-only">{t('search')}</span>
          <Search size={19} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder={t('searchHint')}
            type="search"
            maxLength={120}
          />
        </label>
        <IconButton icon={Mic} label={t('voice')} onClick={() => read(t('voiceNote'))} />
        <IconButton
          icon={RefreshCw}
          label={t('retry')}
          disabled={!online || query.isFetching}
          onClick={() => query.refetch()}
        />
      </div>
      {query.isPending && !query.data ? (
        <Skeleton lines={5} />
      ) : query.isError && !query.data ? (
        <EmptyState
          title={t('unavailable')}
          description={t('unavailableBody')}
          action={<Button onClick={() => query.refetch()}>{t('retry')}</Button>}
        />
      ) : (
        <>
          <FavouritesStrip
            items={items.filter((item) => item.favourite && !item.hidden)}
            onPick={openItem}
          />
          <div className="catalog-category-scroll" role="group" aria-label={t('categoriesLabel')}>
            <button
              type="button"
              aria-pressed={category === 'all'}
              onClick={() => {
                setCategory('all');
                setLimit(24);
              }}
            >
              {t('all')}
            </button>
            {allCategories.map((value) => (
              <span key={value}>
                <button
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => {
                    setCategory(value);
                    setLimit(24);
                  }}
                >
                  {t(`categories.${value}`)}
                </button>
                <IconButton
                  icon={Volume2}
                  label={t('categoryListen', { category: t(`categories.${value}`) })}
                  onClick={() => read(`${t(`categories.${value}`)}. ${t('draftNotice')}`)}
                />
              </span>
            ))}
          </div>
          <div className="catalog-results-heading">
            <p role="status">
              {t('count', { count: filtered.length, formattedCount: number(filtered.length) })}
            </p>
            <label>
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(event) => {
                  setShowHidden(event.target.checked);
                  setLimit(24);
                }}
              />
              {t('showHidden')}
            </label>
          </div>
          {query.isFetching && query.data && (
            <p className="catalog-fetching" role="status">
              {t('refreshing')}
            </p>
          )}
          {visible.length ? (
            <div className="catalog-product-grid">
              {visible.map((item) => {
                const Icon = icons[item.category] || Package;
                const name = itemName(item, i18n.language);
                return (
                  <article
                    key={item.id}
                    className={`catalog-product ${item.hidden ? 'is-hidden' : ''}`}
                  >
                    <button
                      type="button"
                      className="catalog-product-open"
                      aria-label={t('itemOpen', { name })}
                      onClick={() => openItem(item)}
                    >
                      <span className="catalog-product-icon">
                        <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span className="catalog-product-category">
                        {t(`categories.${item.category}`)}
                      </span>
                      <h2>{name}</h2>
                      <span className="catalog-product-price">
                        {money(item.pricePaise)}
                        <small> / {t(`units.${item.priceUnit}`)}</small>
                      </span>
                      <PriceSourceBadge source={item.priceSource} />
                      {item.hidden && (
                        <span className="catalog-hidden">
                          <EyeOff size={13} aria-hidden="true" />
                          {t('hidden')}
                        </span>
                      )}
                    </button>
                    <div className="catalog-product-actions">
                      <IconButton
                        icon={Star}
                        className={item.favourite ? 'is-favourite' : ''}
                        label={t(item.favourite ? 'unfavourite' : 'favourite', { name })}
                        aria-pressed={item.favourite}
                        disabled={readonly || busy}
                        onClick={() => favourite(item)}
                      />
                      <IconButton
                        icon={Volume2}
                        label={t('itemListen', { name })}
                        onClick={() => speakItem(item)}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title={t('empty')} description={t('emptyBody')} />
          )}
          {filtered.length > limit && (
            <div className="catalog-load-more">
              <Button variant="ghost" onClick={() => setLimit(limit + 24)}>
                {t('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
      {error && !editing && !custom && (
        <p className="error-text" role="alert">
          {errorText}
        </p>
      )}
      <Sheet
        open={Boolean(item && draft)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setError('');
          }
        }}
        title={item ? itemName(item, i18n.language) : t('editTitle')}
        description={t('editBody')}
      >
        {item && draft && (
          <form className="catalog-item-form" onSubmit={saveItem}>
            <div className="row between">
              <PriceSourceBadge source={item.priceSource} />
              <ListenButton onClick={() => speakItem(item)} />
            </div>
            <p className="catalog-review-label">
              {t(item.catalogItemId ? 'draftName' : 'merchantName')}
            </p>
            <fieldset disabled={busy || readonly} className="catalog-fieldset">
              <NumPad
                value={draft.price}
                onChange={(price) => setDraft({ ...draft, price })}
                label={t('price', { unit: t(`units.${item.priceUnit}`) })}
              />
              <label className="catalog-field">
                {t('cost', { unit: t(`units.${item.priceUnit}`) })}
                <input
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,2})?"
                  value={draft.cost}
                  onChange={(event) => setDraft({ ...draft, cost: event.target.value })}
                />
              </label>
              <label className="catalog-field">
                {t('preferredUnit')}
                <select
                  value={draft.unit}
                  onChange={(event) => {
                    setDraft({ ...draft, unit: event.target.value });
                    setQuantity('1');
                  }}
                >
                  {item.allowedUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`units.${unit}`)}
                    </option>
                  ))}
                </select>
              </label>
              <Toggle
                checked={draft.favourite}
                onChange={(favourite) => setDraft({ ...draft, favourite })}
                label={t('favouriteToggle')}
              />
              <Toggle
                checked={draft.hidden}
                onChange={(hidden) => setDraft({ ...draft, hidden })}
                label={t('hide')}
              />
            </fieldset>
            <section className="catalog-calculation">
              <h3>{t('preview')}</h3>
              <label className="catalog-field">
                {t('quantity')} ({t(`units.${draft.unit}`)})
                <input
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>
              {preview && <p className="money">{preview}</p>}
              {warning && <p className="warning-text">{t('implausible')}</p>}
              <label className="catalog-field">
                {t('budget')}
                <input
                  inputMode="decimal"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                />
              </label>
              {inversion && (
                <>
                  <p>{t('budgetExact', { quantity: qtyText(inversion.qtyBase, item.baseUnit) })}</p>
                  <p>
                    {t('budgetSuggestion', {
                      quantity: qtyText(inversion.suggestedQtyBase, item.baseUnit),
                      amount: money(inversion.suggestedAmountPaise),
                    })}
                  </p>
                  <p className="catalog-small">{t('budgetNote')}</p>
                </>
              )}
            </section>
            {item.packSizes.length > 0 && (
              <section className="catalog-packs">
                <h3>{t('packs')}</h3>
                {item.packSizes.map((pack, index) => (
                  <p key={index}>
                    {['small', 'standard'].includes(pack.label)
                      ? t(pack.label === 'small' ? 'packSmall' : 'packStandard')
                      : qtyText(pack.qtyBase, item.baseUnit)}{' '}
                    · {money(pack.mrpPaise)}
                  </p>
                ))}
              </section>
            )}
            {readonly && <p className="catalog-cache-note">{t('cached')}</p>}
            {error && (
              <p className="error-text" role="alert">
                {errorText}
              </p>
            )}
            <Button
              type="submit"
              variant="action"
              loading={busy}
              disabled={busy || readonly || !draft.price}
            >
              {t('save')}
            </Button>
            {item.catalogItemId && item.savedPricePaise !== null && (
              <Button
                variant="ghost"
                disabled={busy || readonly}
                onClick={() =>
                  mutate(`/merchant-items/${item.id}`, 'PUT', { savedPricePaise: null }, 'saved')
                }
              >
                {t('resetPrice')}
              </Button>
            )}
            {!item.catalogItemId && (
              <>
                <p className="catalog-small">{t('nominateNote')}</p>
                <Button
                  variant="ghost"
                  disabled={busy || readonly}
                  onClick={() =>
                    mutate(`/merchant-items/${item.id}/nominate`, 'POST', {}, 'nominated')
                  }
                >
                  {t('nominate')}
                </Button>
                <Button variant="quiet" disabled={busy || readonly} onClick={() => setRemove(true)}>
                  {t('delete')}
                </Button>
              </>
            )}
          </form>
        )}
      </Sheet>
      <Sheet
        open={Boolean(custom)}
        onOpenChange={(open) => {
          if (!open) {
            setCustom(null);
            setError('');
          }
        }}
        title={t('customTitle')}
        description={t('customBody')}
      >
        {custom && (
          <form className="catalog-custom-form" onSubmit={createItem}>
            <fieldset disabled={busy || readonly} className="catalog-fieldset">
              <label className="catalog-field">
                {t('name')}
                <input
                  required
                  maxLength={100}
                  value={custom.name}
                  onChange={(event) => setCustom({ ...custom, name: event.target.value })}
                />
              </label>
              <label className="catalog-field">
                {t('priceUnit')}
                <select
                  value={custom.unit}
                  onChange={(event) => setCustom({ ...custom, unit: event.target.value })}
                >
                  {['kg', 'L', 'pc'].map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`units.${unit}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="catalog-field">
                {t('kind')}
                <select
                  value={custom.kind}
                  onChange={(event) => setCustom({ ...custom, kind: event.target.value })}
                >
                  {['loose', 'packed'].map((kind) => (
                    <option key={kind} value={kind}>
                      {t(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <NumPad
                value={custom.price}
                onChange={(price) => setCustom({ ...custom, price })}
                label={t('price', {
                  unit: t(
                    `units.${priceUnit[custom.unit === 'kg' ? 'g' : custom.unit === 'L' ? 'ml' : 'pc']}`,
                  ),
                })}
              />
              <label className="catalog-field">
                {t('cost', { unit: t(`units.${custom.unit}`) })}
                <input
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,2})?"
                  value={custom.cost}
                  onChange={(event) => setCustom({ ...custom, cost: event.target.value })}
                />
              </label>
              <Toggle
                checked={custom.favourite}
                onChange={(favourite) => setCustom({ ...custom, favourite })}
                label={t('favouriteToggle')}
              />
            </fieldset>
            {error && (
              <p className="error-text" role="alert">
                {errorText}
              </p>
            )}
            <Button
              type="submit"
              variant="action"
              loading={busy}
              disabled={busy || readonly || !custom.name.trim() || !custom.price}
            >
              {t('create')}
            </Button>
          </form>
        )}
      </Sheet>
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title={t('deleteTitle')}
        description={t('deleteBody')}
        confirmLabel={t('delete')}
        onConfirm={() =>
          mutate(`/merchant-items/${item.id}`, 'DELETE', undefined, 'deleted', { deleted: true })
        }
      />
    </div>
  );
}
