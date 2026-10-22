# Architecture and scope

One merchant, one store, one phone or tablet. Speak or type an order, verify quantities and prices, collect payment, then use sales history to guide offers and restocking. Every eventual workflow includes an explicit Listen action.

## Current delivery

Phase 1 establishes npm workspaces: `apps/client`, `apps/server`, `packages/shared`; Python lives in `services/reco`; infrastructure in `infra`; decisions in `docs/adr`.

Phase 2 delivers tokens, reusable components, mobile/desktop shells, sample interactions, and a development-only gallery. Samples live only in a named prototype module, never in an API response or database. Settings may persist locally; sample bill state is in memory.

All JavaScript is ESM without TypeScript. Money uses integer paise and quantities integer grams, millilitres or pieces. Shared BigInt intermediate arithmetic prevents multiplication overflow. API secrets are server-side. No customer data or raw audio is collected in this phase.

## Later contracts

The supplied plan's Phases 3–5 remain the data-model authority. Do not invent database models in the prototype. Paid bills will be append-only and idempotent by merchant plus clientBillId. Merchant ownership comes from authentication, never a request body. Customer phone lookup uses keyed hashing with encrypted contact storage and consent. Regional aggregates require at least five merchants.

Voice input/output will use provider boundaries, with Sarvam primary and capability-aware fallbacks. Payment modes will be manual, explicitly simulated, and Paytm Dynamic QR. Neither speech transcription nor payment confirmation is implemented by this UI phase.
