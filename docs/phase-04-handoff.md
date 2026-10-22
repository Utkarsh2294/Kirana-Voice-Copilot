# Phase 4 — catalog and exact units

Read the complete 46-page plan, its global preamble, and the Phase 4 master prompt and acceptance list (pages 14–15). This phase follows the separately committed public website and Phase 3 accounts. Stop here; the Phase 5 pricing engine is not implemented.

## Implementation

- Shared: exact quantity parsing/conversion/formatting, one BigInt-backed line-amount helper, affordable quantity and separate shop suggestion; validated catalog/request schemas; one shared MiniSearch implementation.
- Data/server: 758 generic everyday items in 13 categories, 11 draft name fields and aliases, deterministic IDs, idempotent seeding, global and merchant collections, authenticated catalog APIs, per-store overrides/custom items, and a private review queue.
- Client: lazy catalog route, English/Hindi interface, multilingual typed search, swipeable category strip, item cards, reusable favourites shelf, NumPad editing, cost/price/unit/favourite/hidden controls, custom creation/removal/nomination, and per-merchant IndexedDB search cache.

## Run and inspect

Start the API, database and client as in [Phase 3](phase-03-handoff.md). Seed once with the same `MONGO_URI` as the API:

```powershell
$env:MONGO_URI='mongodb://127.0.0.1:27018/kirana-preview?replicaSet=testset'
npm run seed
```

For Compose: `docker compose -f infra/docker-compose.yml exec server node scripts/seed.js`. Restart the API after the first seed, or press Refresh catalog if its index was still empty. Existing global documents and merchant prices survive repeat seeds (`$setOnInsert`). To regenerate the checked-in draft JSON, run `npm run gen:catalog`; regeneration does not change an existing database. Reviewed corrections need an explicit migration rather than a destructive re-seed.

Sign in, complete onboarding and open `/catalog`. `/demo/catalog` remains the original public sample. Search `rice`, `chawal`, `चावल`, `chaaw`, or `chawel`; Rice ranks first. Generated scripts and a small noun lexicon enable additional script searches, including `அரிசி`. Search uses names, aliases, Latin transliteration, Unicode normalization, prefix and fuzzy matching. Equal text scores break ties using the store's own distinct paid bills from the last 30 days, then recency. Cold stores have no fabricated sales history.

## API and later-phase contracts

All routes require an authenticated merchant with completed onboarding. Merchant identity comes from the session. IDs and strict Zod bodies/queries are checked; no caller-supplied merchant ID is accepted.

| Method | Route under `/api/v1`                       | Result                                                             |
| ------ | ------------------------------------------- | ------------------------------------------------------------------ |
| GET    | `/catalog/search?q=...&lang=hi-IN&limit=30` | Visible global and own custom matches                              |
| GET    | `/catalog/items/:id`                        | Global item merged with own overrides                              |
| GET    | `/catalog/categories`                       | Global categories and counts                                       |
| GET    | `/catalog/frequent`                         | Own paid-sale items, else favourites, else catalog; explicit basis |
| GET    | `/merchant-items?includeHidden=true`        | Full own merged snapshot and search-ranking history                |
| PUT    | `/merchant-items/:id`                       | Own price/cost/unit/favourite/hidden patch                         |
| POST   | `/merchant-items/custom`                    | Private custom item                                                |
| DELETE | `/merchant-items/:id`                       | Soft-delete an own custom item                                     |
| POST   | `/merchant-items/:id/nominate`              | Idempotent private review submission                               |

Global row IDs are catalog IDs; custom row IDs are merchant-item IDs. Global overrides have a unique merchant/catalog pair with a partial non-null index; several custom rows with null catalog IDs are allowed. A custom item's price basis is fixed when created. Later preferred quantity units do not silently convert its stored price. Nominations never change the global catalog; an administration/review interface is not part of this phase.

Prices use integer paise per canonical kg/L/pc. Quantities use integer g/ml/pc. `lineAmount(qtyBase, pricePaise, unitSize)` is the shared calculation. `parseQty` rejects fractional base units and unsafe integers. `convertQty` returns an exact decimal string and rejects non-terminating piece-to-dozen fractions. ₹50 at ₹52/kg yields 961 g affordable; the separate conservative suggestion is 960 g for ₹49.92. No bill is created by this preview. See [ADR-007](adr/007-catalog-and-quantity-contracts.md).

`FavouritesStrip` accepts items and an `onPick` callback for Phase 8 reuse. Paid-bill ranking only reads the future `bills` contract (`merchantId`, `createdAt`, `payment.status`, `lines.catalogItemId`/`merchantItemId`); it creates no billing or payment implementation. Phase 8 must retain these fields and add the corresponding query index when bills become writable. Phase 5 can resolve actual price sources around these catalog IDs and integer units.

IndexedDB stores one snapshot per merchant and clears that merchant's snapshot on sign-out. During an API outage, an already open authenticated workspace can search its cache; writes are disabled with an explicit banner. Session verification still needs the API after a full reload, and service-worker installation, offline billing, mutation outboxes and cross-device sync remain Phase 14. Browser storage failure falls back to online use. Cached prices are private browser data; use sign-out on a shared device.

## Verification and evidence

- Actual Mongo replica-set integration checks seed schemas, 758 items, 13 categories, 11 name fields, script/alias/fuzzy searches, store isolation, concurrent first overrides, hide/favourite/price/unit/cost edits, custom rows, soft deletion, nominations and 30-day history.
- 10,000 deterministic quantity/price combinations compare shared amounts with an independent BigInt quotient/remainder reference, including products above JavaScript's safe intermediate range. Edge cases cover fractional bases, pieces/dozens, overflow and the PDF's rice example.
- Client tests cover editing, alias search, favourites, hidden items, custom creation, cache fallback, disabled offline writes, tenant-separated snapshots and axe accessibility. English/Hindi namespace parity and existing public/account flows remain covered.
- Live browser: development sign-in and completed store setup; saved ₹60/kg Rice and a favourite survive refresh; Hindi/Latin search works; hide/show/unhide and private custom creation work. An actual API restart exercised cached read-only search, then Refresh restored writes. Only synthetic local merchant details were used.
- Browser layout checks cover six combinations of 360/768/1280 px and English/Hindi with no horizontal page overflow; day mode is also visually checked. Screenshots: [desktop](screenshots/phase-04-catalog-desktop.png), [Hindi mobile](screenshots/phase-04-catalog-hindi-mobile.png), [cached search](screenshots/phase-04-cached-search.png), [Hindi item sheet](screenshots/phase-04-item-hindi-mobile.png).
- `npm run bench:catalog` asserts p95 <30 ms and incremental index heap <40 MiB. [Recorded measurement](catalog-benchmark.json): 758 items, 240 warm queries, p95 1.171 ms, 5.759 MiB on Node 22.23/Windows. These are in-process measurements, excluding HTTP, database, network and preloaded library memory; device performance can differ.
- All 61 JavaScript tests, lint, formatting, production build and dependency audit pass locally.
- Production bill route remains within the original 180 KiB gzip limit. Catalog search, database cache and query libraries load only on the catalog path. Phone/gallery/demo translations are split into their own routes; real microphone-level capture remains a development gallery capability until Phase 6.

## Outstanding acceptance and deliberate limits

All 11 name fields are marked `machine`, with generation methods recorded. English/Hindi source drafts were authored with Codex; the other nine use a small noun lexicon plus script transliteration. **Sarvam Translate was not called, and native-speaker review has not occurred.** Transliteration is not a substitute for translated, regionally correct product names. The human/native review required by the PDF remains an explicit release gate; this is a functional prototype, not a production-ready multilingual catalog. No item is falsely marked `reviewed`.

Default prices and pack MRPs are synthetic examples, with visible Demo data labels; no market feed, verified brand/barcode database or tax classification is claimed. Tobacco and alcohol are excluded. Optional barcode scanning was deferred. Speech buttons show text previews until Phase 6. Phase 3 live SMS verification and physical-device/assistive-technology checks remain open as documented there.
