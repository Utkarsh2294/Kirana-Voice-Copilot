import MiniSearch from 'minisearch';
import Sanscript from '@indic-transliteration/sanscript';

const schemes = {
  hi: 'devanagari',
  bn: 'bengali',
  ta: 'tamil',
  te: 'telugu',
  gu: 'gujarati',
  kn: 'kannada',
  ml: 'malayalam',
  mr: 'devanagari',
  pa: 'gurmukhi',
  od: 'oriya',
};
export function normaliseSearch(text) {
  return String(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
export function toLatin(text, lang) {
  return schemes[lang] ? Sanscript.t(text, schemes[lang], 'iast') : text;
}
export function createCatalogSearch(items) {
  const byId = new Map(items.map((item) => [String(item.id || item._id), item]));
  const index = new MiniSearch({
    fields: ['names', 'aliases', 'latin'],
    processTerm: normaliseSearch,
    tokenize: (text) => text.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean),
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
      boost: { names: 3, aliases: 2 },
    },
  });
  index.addAll(
    [...byId].map(([id, item]) => ({
      id,
      names: Object.values(item.names || { en: item.name }).join(' '),
      aliases: (item.aliases || []).map((alias) => alias.text).join(' '),
      latin: Object.entries(item.names || {})
        .map(([lang, text]) => toLatin(text, lang))
        .join(' '),
    })),
  );
  function scored(query, { limit = 50, stats = new Map() } = {}) {
    const normalized = normaliseSearch(query);
    if (!normalized) return [];
    return index
      .search(query, { fuzzy: normalized.length < 4 ? false : 0.2 })
      .map((hit) => {
        const item = byId.get(String(hit.id));
        const values = [
          ...Object.values(item.names || { en: item.name }),
          ...(item.aliases || []).map((alias) => alias.text),
        ].map(normaliseSearch);
        const exact = values.includes(normalized);
        const prefix = values.some((value) => value.startsWith(normalized));
        return { item, score: hit.score + (exact ? 1000 : prefix ? 150 : 0) };
      })
      .sort(compareCatalogHits(stats))
      .slice(0, limit);
  }
  return {
    search: (query, options) => scored(query, options).map((hit) => hit.item),
    scored,
    byId,
    index,
  };
}
export function compareCatalogHits(stats = new Map()) {
  return (a, b) =>
    b.score - a.score ||
    (stats.get(String(b.item.id || b.item._id))?.frequency ?? b.item.salesFrequency30d ?? 0) -
      (stats.get(String(a.item.id || a.item._id))?.frequency ?? a.item.salesFrequency30d ?? 0) ||
    new Date(stats.get(String(b.item.id || b.item._id))?.lastSoldAt || b.item.lastSoldAt || 0) -
      new Date(stats.get(String(a.item.id || a.item._id))?.lastSoldAt || a.item.lastSoldAt || 0) ||
    String(a.item.id || a.item._id).localeCompare(String(b.item.id || b.item._id));
}
