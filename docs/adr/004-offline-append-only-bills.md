# ADR-004: Offline-first, append-only bills

Accepted for Phases 8 and 14. Dexie drafts and a local outbox will sync with merchant-scoped client UUID idempotency. Paid bills will not be edited in place. Device connectivity never implies that sales are synchronized. Phase 2 explicitly labels offline status and has no sale outbox or service worker.
