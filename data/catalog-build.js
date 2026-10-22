import { createHash } from 'node:crypto';
import Sanscript from '@indic-transliteration/sanscript';
import { catalogGroups } from './catalog-draft.js';
import { unitBase } from '../packages/shared/src/units.js';

const schemes = {
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
// Small draft lexicon improves common nouns; all output still requires a native-speaker pass.
const nouns = [
  ['चावल', 'চাল', 'அரிசி', 'బియ్యం', 'ચોખા', 'ಅಕ್ಕಿ', 'അരി', 'तांदूळ', 'ਚੌਲ', 'ଚାଉଳ'],
  ['दूध', 'দুধ', 'பால்', 'పాలు', 'દૂધ', 'ಹಾಲು', 'പാൽ', 'दूध', 'ਦੁੱਧ', 'ଦୁଧ'],
  ['चीनी', 'চিনি', 'சர்க்கரை', 'చక్కెర', 'ખાંડ', 'ಸಕ್ಕರೆ', 'പഞ്ചസാര', 'साखर', 'ਖੰਡ', 'ଚିନି'],
  ['तेल', 'তেল', 'எண்ணெய்', 'నూనె', 'તેલ', 'ಎಣ್ಣೆ', 'എണ്ണ', 'तेल', 'ਤੇਲ', 'ତେଲ'],
  ['आटा', 'আটা', 'மாவு', 'పిండి', 'લોટ', 'ಹಿಟ್ಟು', 'മാവ്', 'पीठ', 'ਆਟਾ', 'ଅଟା'],
  ['नमक', 'লবণ', 'உப்பு', 'ఉప్పు', 'મીઠું', 'ಉಪ್ಪು', 'ഉപ്പ്', 'मीठ', 'ਲੂਣ', 'ଲୁଣ'],
  ['चाय', 'চা', 'தேநீர்', 'టీ', 'ચા', 'ಚಹಾ', 'ചായ', 'चहा', 'ਚਾਹ', 'ଚା'],
  [
    'प्याज़',
    'পেঁয়াজ',
    'வெங்காயம்',
    'ఉల్లిపాయ',
    'ડુંગળી',
    'ಈರುಳ್ಳಿ',
    'ഉള്ളി',
    'कांदा',
    'ਪਿਆਜ਼',
    'ପିଆଜ',
  ],
  [
    'आलू',
    'আলু',
    'உருளைக்கிழங்கு',
    'బంగాళాదుంప',
    'બટાકા',
    'ಆಲೂಗಡ್ಡೆ',
    'ഉരുളക്കിഴങ്ങ്',
    'बटाटा',
    'ਆਲੂ',
    'ଆଳୁ',
  ],
  ['टमाटर', 'টমেটো', 'தக்காளி', 'టమాటా', 'ટામેટા', 'ಟೊಮೇಟೊ', 'തക്കാളി', 'टोमॅटो', 'ਟਮਾਟਰ', 'ଟମାଟୋ'],
  ['अंडे', 'ডিম', 'முட்டை', 'గుడ్లు', 'ઇંડાં', 'ಮೊಟ್ಟೆ', 'മുട്ട', 'अंडी', 'ਅੰਡੇ', 'ଅଣ୍ଡା'],
  ['पानी', 'জল', 'தண்ணீர்', 'నీరు', 'પાણી', 'ನೀರು', 'വെള്ളം', 'पाणी', 'ਪਾਣੀ', 'ପାଣି'],
  [
    'नारियल',
    'নারকেল',
    'தேங்காய்',
    'కొబ్బరి',
    'નાળિયેર',
    'ತೆಂಗಿನಕಾಯಿ',
    'തേങ്ങ',
    'नारळ',
    'ਨਾਰੀਅਲ',
    'ନଡ଼ିଆ',
  ],
  ['साबुन', 'সাবান', 'சோப்பு', 'సబ్బు', 'સાબુ', 'ಸಾಬೂನು', 'സോപ്പ്', 'साबण', 'ਸਾਬਣ', 'ସାବୁନ'],
  [
    'मूंगफली',
    'চিনাবাদাম',
    'நிலக்கடலை',
    'వేరుశెనగ',
    'મગફળી',
    'ಕಡಲೆಕಾಯಿ',
    'നിലക്കടല',
    'शेंगदाणा',
    'ਮੂੰਗਫਲੀ',
    'ଚିନାବାଦାମ',
  ],
];
export function draftNames(en, hi) {
  const names = { en, hi };
  for (const [index, [lang, scheme]] of Object.entries(schemes).entries()) {
    // Substitute noun segments after transliterating the surrounding draft descriptor.
    let result = Sanscript.t(hi, 'devanagari', scheme);
    for (const row of nouns)
      result = result.replaceAll(Sanscript.t(row[0], 'devanagari', scheme), row[index + 1]);
    names[lang] = result;
  }
  return names;
}
const aliases = {
  rice: ['chawal', 'chaawal', 'chaval'],
  sugar: ['cheeni', 'chini', 'shakkar'],
  'mustard-oil': ['sarson ka tel', 'sarso tel', 'tel'],
  'wheat-flour': ['atta', 'aata', 'gehun atta'],
  milk: ['doodh', 'dudh'],
  tea: ['chai'],
  onion: ['pyaz', 'pyaaz'],
  potato: ['aloo', 'alu'],
  tomato: ['tamatar'],
  'bath-soap': ['sabun', 'saboon'],
};
const liquids = new Set([
  'Milk',
  'Full cream milk',
  'Toned milk',
  'Double toned milk',
  'Skimmed milk',
  'Cow milk',
  'Buffalo milk',
  'Lactose free milk',
  'UHT milk',
  'Chocolate milk',
  'Strawberry milk',
  'Rose milk',
  'Badam milk',
  'Buttermilk',
  'Masala buttermilk',
  'Sweet lassi',
  'Mango lassi',
  'Fresh cream',
  'Whipping cream',
]);
const weighedDairy = new Set([
  'Plain curd',
  'Set curd',
  'Greek yogurt',
  'Strawberry yogurt',
  'Mango yogurt',
  'Paneer',
  'Salted butter',
  'Unsalted butter',
  'Cheese slices',
  'Cheese cubes',
  'Cheese spread',
  'Mozzarella cheese',
  'Cream cheese',
  'Milk powder',
  'Skimmed milk powder',
  'Khoya',
  'Tofu',
]);

export function buildCatalog() {
  return catalogGroups.flatMap((group) =>
    group.rows
      .trim()
      .split('\n')
      .map((row, index) => {
        const [en, hi] = row.split('|');
        const slug = en
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const unit =
          group.category === 'dairy'
            ? liquids.has(en)
              ? 'L'
              : weighedDairy.has(en)
                ? 'kg'
                : group.unit
            : group.unit;
        const baseUnit = unitBase[unit];
        const price = slug === 'bath-soap' ? 1000 : group.price + (index % 5) * 100;
        const names = draftNames(en, hi);
        return {
          _id: createHash('sha256').update(`kirana-catalog-v1:${slug}`).digest('hex').slice(0, 24),
          slug,
          names,
          aliases: [
            ...new Set([en, hi, ...(aliases[slug] || []), Sanscript.t(hi, 'devanagari', 'iast')]),
          ].map((text) => ({ lang: /[\u0900-\u097f]/.test(text) ? 'hi' : 'en', text })),
          category: group.category,
          subcategory: group.category,
          brand: '',
          kind: group.kind,
          baseUnit,
          allowedUnits:
            baseUnit === 'g'
              ? ['kg', 'g']
              : baseUnit === 'ml'
                ? ['L', 'ml']
                : ['pc', 'dozen', 'packet'],
          packSizes:
            group.kind === 'loose'
              ? []
              : slug === 'bath-soap'
                ? [
                    { label: 'small', qtyBase: 1, mrpPaise: 1000 },
                    { label: 'standard', qtyBase: 1, mrpPaise: 2000 },
                  ]
                : [
                    {
                      label: `${unit === 'kg' || unit === 'L' ? '1 ' + unit : '1 pc'}`,
                      qtyBase: unit === 'pc' ? 1 : 1000,
                      mrpPaise: price,
                    },
                  ],
          defaultPricePaise: price,
          priceClass: group.kind === 'loose' ? 'commodity' : 'packaged',
          mrpPaise: group.kind === 'packed' ? price : null,
          gstRate: null,
          icon: group.category,
          tags: [group.category, group.kind],
          active: true,
          nameReview: Object.fromEntries(Object.keys(names).map((lang) => [lang, 'machine'])),
          nameMethods: Object.fromEntries(
            Object.keys(names).map((lang) => [
              lang,
              ['en', 'hi'].includes(lang) ? 'codex-draft' : 'dictionary-and-transliteration-draft',
            ]),
          ),
          priceProvenance: 'synthetic',
          maxQtyBase: baseUnit === 'g' ? 25000 : baseUnit === 'ml' ? 20000 : 100,
        };
      }),
  );
}
