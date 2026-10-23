# Phase 5 — pricing engine

Read the full project plan in the preceding phases and re-read the global preamble and Phase 5 master prompt/acceptance pages before implementation. See [pricing.md](pricing.md) for field meanings, source assumptions, endpoints, commands and integration limits.

## Files and implementation

- Shared pricing math and checks: exact trimmed median, smoothing/guards, wholesale shrinkage, stale status and nudges.
- Server pricing models, resolver, transactional override/history/Undo, feed discovery/mapping approval, ingestion lease, daily cron and authenticated APIs.
- Client real draft bill, private saved-price controls, market history, sources/as-of/demo labels, target margin and lazy price/search tools. Catalog editing shares the price-history write path. Public samples remain separate.

## Run and verify

Use the existing Phase 3 local/Compose commands, then `npm run seed` and `npm run market:ingest` with the API's Mongo URI. Restart the API after CLI ingestion to immediately invalidate its in-memory region cache. Open `/bill` after onboarding; try an unpriced item such as Onion to see Market plus Demo data. A saved Rice price from earlier previews keeps precedence.

```powershell
npm run lint
npm test
npm run format:check
npm run build
node scripts/check-client-build.js
npm audit --audit-level=high
```

## Acceptance ledger

- [x] Saved prices override regional prices and survive a market change; another store still receives its own regional/default price. Actual Mongo replica-set integration checks both merchants.
- [x] Bill-only edits make no persistence request. Client flow tests start a fresh draft and recover the original resolved price.
- [x] Save writes a unit price and history atomically, future drafts use it, and Undo is available. Stale/cross-store Undo is rejected rather than overwriting a later change.
- [x] Feed-off and confidence below 0.3 visibly fall back; older-than-three-day estimates carry a stale flag.
- [x] Crowd publication requires at least five distinct recent merchants, excludes other regions and exposes only aggregates. Trimmed-median, 8% cap, EMA and markup calculations have runnable checks.
- [x] Thirty-day deterministic demo history is idempotent and the next day obeys movement limits. Demo data is labelled in item cards, draft rows and history.
- [x] Authenticated API, private history, admin allowlist, active-account guard, strict body/query/ID validation and crop-mapping approval are implemented.
- [x] Scheduled evening ingestion, durable lease and manual admin trigger/status are wired; the scheduler is explicitly enabled through server configuration.
- [x] NumPad unit-price editor, line-total preview, as-of date, sparkline, target margin and reset controls are connected.
- [ ] Live Agmarknet discovery/ingestion and licence verification: no key is configured and the government portal could not be reached. Tests use controlled records; all live mappings remain unapproved. No live market accuracy claim is made.
- [ ] Physical-device checks and the earlier native-name review remain outstanding.

The user also authorized Phase 6; build it after this checkpoint. Do not implement order parsing (Phase 7), saved sale records (Phase 8), payment collection (Phase 9) or advice (Phase 13) inside pricing.

Browser evidence uses only the disposable local Demo Merchant account: Onion resolves at ₹33.48/kg from the labelled simulated feed; a bill-only ₹40 edit leaves the result card at ₹33.48; saving ₹42 updates both and a new draft resolves ₹42. The 30-point market history and private save event appear in the item sheet. Hindi at 360 px has no page overflow. See [draft desktop](screenshots/phase-05-pricing-desktop.png), [history desktop](screenshots/phase-05-history-desktop.png), and [Hindi mobile editor](screenshots/phase-05-price-hindi-mobile.png).
