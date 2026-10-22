# Build ledger

Requested: complete through Phase 2, with 30 substantive conventional commits pushed to the supplied GitHub repository. No later-phase business features or external deployment is authorized by this scope.

## Phase 1 — foundation (commits 1–15)

1. Scope, architecture and build ledger.
2. npm workspace manifests and dependency lock.
3. Integer money helpers and edge-case checks.
4. Unit constants, languages and shared schemas.
5. Lint, format, hooks and commit conventions.
6. Validated server environment and examples.
7. Secure API factory and problem details.
8. Mongo readiness, startup and shutdown.
9. Authenticated recommendation-service skeleton.
10. Python tests, quality configuration and image.
11. Vite/React routing, boundary and manifest.
12. i18n language namespaces and fallback.
13. Replica-set Compose and seed scaffolds.
14. Cached CI checks and gated deployment jobs.
15. ADRs, startup/deployment docs and Phase 1 audit.

## Phase 2 — UI foundations (commits 16–30)

16. Dark/day tokens and script-aware typography.
17. Buttons, status, feedback and display primitives.
18. Accessible sheets, confirmation and undo toast.
19. Quantity, keypad, phone and OTP controls.
20. Microphone gesture states and waveform.
21. Swipeable bill lines and price-source badges.
22. Responsive shell, navigation and status.
23. Interactive sample bill and edit sheets.
24. Catalog, settings and honest route skeletons.
25. Insight period gestures and refresh states.
26. Complete development-only component gallery.
27. First-run guidance and keyboard polish.
28. Interaction, accessibility and edge-case tests.
29. Responsive, contrast and bundle hardening.
30. Acceptance evidence and final handoff.

## Verification status

- Repository started empty; no existing user changes.
- Docker CLI exists; Docker Desktop engine is currently stopped. Compose runtime verification needs an available engine.
- Real-phone gesture, sunlight and screen-reader checks require physical hardware.
- Phase completion evidence will be recorded here, with unchecked items disclosed.

## Phase 1 audit

- [x] Workspace install, JavaScript lint, shared/API tests and production build run locally.
- [x] Exact arithmetic tests cover half-paise, negative values and safe-integer bounds.
- [x] API configuration tests identify missing variables without disclosing values.
- [x] Python health/key tests and Ruff pass using the available Python 3.14 host. CI/container target remains Python 3.11; the exact target has not run locally.
- [x] Compose configuration validates; replica set, persistent volume, optional Redis and service healthchecks are defined.
- [x] Eleven namespaces, English/Hindi key parity, route stubs, error boundary and placeholder manifest exist.
- [x] JavaScript-only source policy, hooks, CI, disabled deploy jobs, five core ADRs and contribution/deploy instructions exist.
- [ ] Local full-stack Docker runtime: engine unavailable; startup command was blocked by automatic approval review. CI includes an independent Compose runtime check.
- [x] Remote Phase 1 CI: [run 39763130091](https://github.com/Utkarsh2294/Kirana-Voice-Copilot/actions/runs/39763130091) passed JavaScript, Python 3.11 and the full Linux Compose runtime checks at `c55bb95`.

The older Python package pins were replaced with versions already available on this host; Mongo/PyMongo is deferred until the recommendation service actually reads Mongo in Phase 11. No analytics stack is installed prematurely.

## Phase 2 audit

- [x] All prescribed components and states have gallery entries; route and gallery render at 360px/1280px in dark/day modes.
- [x] Text and control palette contrast passes AA math checks in both themes. Semantic axe, focus behavior and keyboard interactions pass automated tests.
- [x] Swipe delete, persistent Undo and restoration recover the original line/order/total.
- [x] Hold/release, tap, slide-up lock and sheet drag dismissal work in the browser preview.
- [ ] Those mic gestures have not been tested on a physical phone; the real-phone acceptance item remains open.
- [x] Reduced-motion preference removes shimmer, spring/layout motion, ring reactions and animated totals as documented.
- [x] Hindi/Tamil narrow-screen previews do not clip; Hindi/English common-key parity is tested.
- [x] Default-English bill bundle is 177.8 KiB gzip including first-run and gesture chunks; production output excludes the dev gallery.
- [x] Main screens checked at mobile, tablet, desktop and landscape widths with no horizontal overflow. Long text, empty data and large values remain inspectable in the gallery.
- [x] 23 JavaScript tests and 2 Python tests pass locally. No external speech/payment claim is inferred from these checks.

See [the handoff](phase-02-handoff.md) for run commands, evidence, scope boundaries and remaining hardware checks. Requested stop: no Phase 3 work.

## Public website addition

The user subsequently authorized an original, mission-led public website before onboarding: Home, Our Story & Mission, How It Works, and all 15 roadmap phases. English/Hindi, dark/day, mobile navigation, accessible disclosures, original imagery, and the existing merchant entry are delivered in one commit. See [the website handoff](public-website.md) for plan mapping and evidence. The user then authorized continuing into Phases 3 and 4 after this website commit.

## Phase 3 — accounts and store setup

Merchant models, OTP/session security, ordered onboarding, local PIN resolution, validated QR uploads, guarded routes, account controls, and honest speech previews are implemented. Public sample routes are now under `/demo/*`. See [the Phase 3 handoff](phase-03-handoff.md) for commands, acceptance evidence, data provenance, and outstanding live-SMS/device checks. The public-site commit `bbe3fbf` passed [CI run 39819131734](https://github.com/Utkarsh2294/Kirana-Voice-Copilot/actions/runs/39819131734).
