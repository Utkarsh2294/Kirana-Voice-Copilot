# ADR-006: Toolchain verification and Phase 2 scope

Checked on 22 October 2026. The plan requests `.nvmrc=20`; retain it, but require at least 20.19 because current [Vite](https://vite.dev/guide/) requires Node 20.19+ / 22.12+. Containers and CI use Node 22. Tailwind uses its [Vite plugin](https://tailwindcss.com/docs/installation/using-vite). Motion uses [MotionConfig and reduced-motion](https://motion.dev/docs/react-use-reduced-motion). Sheets use [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) with `modal=false` as the plan explicitly requires focus to be able to leave sheets. Destructive confirmation dialogs are modal and use a cancel-first focus policy.

The first npm audit found known issues in Vitest 3's test dependencies. Use patched Vitest 4.1.12 rather than keeping the initially selected older version. Re-audit the committed lockfile in CI. This changes tooling only.

No cloud API is integrated through Phase 2, so no vendor endpoint, language coverage or price from the PDF is asserted as current. Phase 6 must verify Sarvam; Phase 9 must verify Paytm. The supplied generic full-build prompt is reference material; the user's explicit Phase 2 stop controls scope. No external application hosting is created.
