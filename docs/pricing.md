# Pricing contracts and assumptions

Phase 5 follows the PDF's global preamble and master prompt on pages 16–18. Prices remain integer paise per canonical kg/L/pc; `pricePerBasePaise` is the plan's field name for this sell-unit price, not paise per gram. Every response also supplies `unit` and `unitSize`. Line amounts use the shared BigInt-backed half-up helper.

## Resolution and edits

`resolvePrices(merchantId, itemIds)` applies the merchant's saved price, then the regional estimate with confidence at least 0.3, then catalog MRP/default. Source is merchant/market/mrp; `demo` independently identifies synthetic catalog or simulated market data. Old market values remain usable with an explicit stale warning after three days; unavailable/low-confidence feeds fall back visibly. `MARKET_FEED=off` disables all market lookup, including cached values.

Authenticated `/bill` is now an in-memory draft using the actual catalog and resolver. `/demo/bill` preserves the public sample. A manual edit changes only that line. Save writes an owned MerchantItem unit price and an append-only PriceHistory event in one Mongo transaction. Reset removes the private override. Undo appends another history event and checks the saved revision, so an older toast cannot overwrite a newer price. Catalog edits use the same write function. Other merchants never receive these private history entries.

An existing draft keeps its prices when the market or saved price changes. Fresh additions resolve again; New bill clears draft lines, retaining the saved merchant price. No bill document, sale, stock change or payment is created yet. Drafts stay in memory while navigating the workspace and clear on sign-out; persisted drafts and bills are later phases.

## Feeds and guards

- Simulated: SHA-256 of region/item/IST date produces a deterministic walk. Thirty historical demo days are generated for the sparkline; repeat ingestion leaves existing days unchanged. The next day starts from the stored preceding day, avoiding a moving-seed discontinuity. Daily proposals are bounded to ±8% and smoothed with alpha 0.5. All of these values are marked Demo data.
- Crowd: at least five distinct active merchants in the same region must have a positive saved price set within 14 days. Drop floor(10% × count) at either end, then take the exact half-up median. Hidden/deleted customs and other regions do not contribute. Only the aggregate, confidence and count leave the server.
- Agmarknet: configured data.gov.in resource, bounded pagination, eight-second request timeout, at most three attempts with exponential backoff on transient failures. Fields are validated before use; failure leaves the last good records intact and permits crowd updates. The current local configuration has no API key, so the live portal and its current schema/licence could not be validated. Do not present this adapter as a verified live feed.
- The [government dataset page](https://data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi) and [licence page](https://www.data.gov.in/government-open-data-license-india) were unreachable during this build. Attribution is Ministry of Agriculture & Farmers Welfare / Agmarknet via data.gov.in. Validate resource metadata, units and the applicable Government Open Data Licence before production activation. No live government records are redistributed by this commit.
- Discovery reads actual commodity names for an administrator's store region. A proposed mapping must reference a discovered commodity and a weight-based catalog item. It remains inactive until a separate approval call. Any edit clears approval. The human must approve the integer numerator/denominator crop-conversion factor; paddy is never silently treated as rice.
- The adapter assumes rupees/quintal for mandi data: convert to paise/kg, then apply the approved crop factor. This is an explicit integration assumption requiring live-source verification, not a claim that every government commodity is directly retail-ready.
- Wholesale-to-retail assumptions: vegetables 25%, pulses 12%, grains/other mapped weight items 10%. Shrink observed non-negative markup toward that prior with 10 pseudo-observations: `(n × medianMarkup + 10 × defaultMarkup) / (n + 10)`. These are tunable assumptions, not measured retail margins.
- Cap unsupported single-day changes to ±8%, then use a half-up mean of previous and candidate (EMA alpha 0.5). Two independent non-simulated source candidates within 3% count as corroboration and bypass the cap, while retaining smoothing. Below 0.3 confidence never resolves as market.

Nudges identify a saved price older than 14 days drifting more than 7%, a documented wholesale rise since saving while the private price is below the estimate, and a cost-derived margin below the merchant's target. Default target is 8%; Settings accepts 0–100%. Nudges are structured codes localized on the client. Phase 13 will build the advice workflow around them.

## Operations

```powershell
npm run seed
npm run market:ingest
```

Use the API's `MONGO_URI`. The standalone ingestion process does not invalidate another running API process's five-minute region cache; restart that API for an immediate preview, or use its authenticated admin trigger. No environment secret is printed. Compose also contains the seed/ingestion scripts.

Set `MARKET_JOBS_ENABLED=true` to schedule 18:30 Asia/Kolkata daily ingestion. A Mongo lease coordinates replicas, and source/day/region/item uniqueness makes writes idempotent. `PRICING_ADMIN_MERCHANT_IDS` is a comma-separated server-side allowlist, empty by default. There is no client-side admin flag or automatic role escalation.

| Method | Route under `/api/v1`                                          | Access                                          |
| ------ | -------------------------------------------------------------- | ----------------------------------------------- |
| POST   | `/pricing/resolve` with itemIds                                | Own completed account                           |
| GET    | `/pricing/market?regionId&itemIds`                             | Own region only                                 |
| GET    | `/pricing/history/:itemId`                                     | Own private history + safe regional series      |
| PUT    | `/merchant-items/:itemId/price` with savedPricePaise or undoOf | Own override/custom only                        |
| POST   | `/pricing/admin/ingest`                                        | Allowlisted admin; 202 schedules job            |
| GET    | `/pricing/admin/status`                                        | Allowlisted admin; lease/latest result          |
| GET    | `/pricing/admin/commodities`                                   | Allowlisted admin; real regional discovery      |
| POST   | `/pricing/admin/mappings`                                      | Allowlisted admin; create/edit pending proposal |
| PUT    | `/pricing/admin/mappings/:id/approve`                          | Allowlisted admin; explicit approval            |

The UI shows price sources, demo labels, as-of dates, the last 30-day market sparkline, private changes and actionable stale/fallback explanations. Price editor and search index load on intent; they are not charged to the initial bill bundle.
