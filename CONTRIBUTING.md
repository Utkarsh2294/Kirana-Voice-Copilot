# Contributing

Use Node 20.19+ (Node 22 recommended) and Python 3.11. Run `npm ci`, copy the three `.env.example` files, and install `services/reco/requirements-dev.txt` into a virtual environment. `.env`, credentials and generated datasets are ignored.

Use `npm run dev:all` for the four-service Docker stack. `npm run dev` starts the three development processes when Mongo already exists. See README for PowerShell commands and `PYTHON` interpreter selection.

Use JavaScript ESM only: no TypeScript or type checking. JSDoc documents intent. Shared monetary values are safe integer paise and quantities integer base units. Use the exact shared helpers; do not multiply floats to compute bill amounts. Validate trust boundaries with Zod. Never log phones, OTPs, cookies, tokens, request bodies or raw audio.

Before a commit run `npm run lint`, `npm test`, `npm run build`, `npm run format:check`, `python -m pytest services/reco/tests`, and `python -m ruff check services/reco`. Hooks format staged files and enforce conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). CI repeats the checks and tests the full Compose stack.

Keep commits focused and buildable. Add a regression check for non-trivial logic. UI changes must support keyboard, 48px targets, reduced motion, dark/day modes, and narrow layouts. Use i18n keys for all displayed strings and Intl for numbers. Hindi keys must match English; other languages explicitly fall back until reviewed.

The development gallery is intentionally excluded from production. Phase 2 sample interactions never claim to persist sales, transcribe speech or collect money. Do not advance database schemas beyond the supplied plan's phase contracts without revisiting that plan.
