# Kirana Voice Copilot

A voice-first counter companion for India's neighbourhood grocery stores.

**Build scope: Phases 1–2.** This repository contains the monorepo foundation and an interactive, accessible design prototype. Sample bills and insights are explicitly illustrative. Authentication (Phase 3), catalog APIs (4), pricing (5), cloud speech (6), parsing (7), persisted billing (8), payments (9), analytics (10), recommendations (11–13), and offline sync (14) are separate milestones.

## Architecture

```mermaid
flowchart LR
  PWA[React PWA] --> API[Express /api/v1]
  API --> Mongo[(MongoDB replica set)]
  API --> Reco[Python FastAPI]
  API -. Phase 6 .-> Sarvam[Sarvam speech]
  API -. Phase 9 .-> Paytm[Paytm QR]
  API -. Phase 9 Socket.IO .-> PWA
  Reco -. Future read-only access .-> Mongo
```

See [the build ledger](docs/progress.md), [architecture](docs/architecture.md), and [contribution guide](CONTRIBUTING.md).
