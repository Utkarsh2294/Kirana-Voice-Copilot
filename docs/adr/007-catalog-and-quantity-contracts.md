# ADR-007: Catalog drafts, price basis, and exact quantity previews

Status: accepted for the prototype, 23 October 2026.

Use one shared MiniSearch index implementation in the API and lazy client route. Cache only merchant-scoped snapshots; never trust a cached price for an eventual server-side bill. Keep the global catalog separate from private overrides and custom items. Partial uniqueness applies only when `catalogItemId` is an ObjectId, allowing several private custom rows.

Store integer quantities in g/ml/pc and integer prices per canonical kg/L/pc. A preferred display unit does not alter the price basis. Exact conversions return decimal strings; non-terminating fractions require base pieces. The plan's ₹50/₹52-per-kg example has two quantities: 961 g affordable and a 960 g shop suggestion. Show both explicitly and price the suggestion at ₹49.92. Never display 960 g while silently billing 961 g. Phase 5 owns price-source resolution and Phase 8 owns bill creation.

Seed 758 deterministic generic items with synthetic prices. Every language is marked `machine`, with the generation method retained. Nine scripts use transliteration/lexicon drafts because no translation-provider call or human review was performed. The PDF's native review remains outstanding. Re-seeding inserts missing IDs without overwriting reviewed data or store overrides.

Sanscript is used only for script transliteration. Its dependency tree includes TOML build tooling; a root override pins that transitive dependency to patched TOML 5. The checked-in lockfile passes `npm audit`, and shared/server search tests exercise Sanscript's published JavaScript runtime. This adds no parser or build execution to the browser workflow.
