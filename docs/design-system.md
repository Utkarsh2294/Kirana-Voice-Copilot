# Design system

The product is an everyday counter tool: quiet dark surfaces, clear hierarchy, a cerulean information layer and one rose voice/action accent. UI/UX Pro Max's operations direction informs density and readability; the supplied plan overrides its generic landing-page and green palette suggestions.

`src/tokens.css` is the source of truth. Jet Black #0A0A0A, surfaces #111316 / #171A1F / #1E222A, cerulean #007BA7, rose #FF2D95. Day mode uses #F6F7F9 and darker rose #E0157B with white text. The plan's light cerulean hover fails white-text contrast, so use #007498 instead. Interactive outlines use a stronger control border; faint borders are decoration only.

Sora carries display type and tabular money. Inter is body type. Only the selected Noto Indic script is requested with swap and unicode-range subsetting. Hindi/Marathi use Devanagari; Tamil uses Tamil. English and Hindi common keys are complete; Tamil script previews are partial, with explicit fallback notice. Other namespaces fall back to English pending reviewed translations.

All body text is at least 16px, bill names 20px, totals 44–56px, Indic line-height 1.6. Touch targets are 48px minimum; the docked mic is 72px. Use logical inline/block spacing, stable wrapping and min-width:0 in grids. No decorative bitmap is needed for the working counter interface.

## Motion and gestures

Use transform/opacity only; layout projection handles bill reflow. Sheets/cards use spring 300/30; small controls 500/35. Feedback 120ms, transitions 220ms. Keyboard navigation is immediate. Reduced motion replaces transform/layout/spring effects with short fades and removes shimmer, pulses and animated counters. Hover effects require a fine pointer.

Mic: native pointer capture handles tap, hold/release and slide-up locking; Escape cancels. Without audio capture, the hands-free preview stops after five seconds; optional mic-level capture uses AnalyserNode silence detection and stops all tracks on release/unmount. A 15-second limit prevents a stuck hold from leaving capture open. Audio is never recorded or sent. Cloud voice comes in Phase 6. Insights uses @use-gesture/react; bill rows and sheets use Motion drag. Loading gesture code only on its route keeps the counter within the build budget.

Bill rows: left delete with Undo, right edit, long press price, quantity button opens its sheet. Buttons provide keyboard equivalents. Sheets drag down with distance/velocity snapping and allow focus to leave, per the plan. Confirmation dialogs are modal with cancel-first focus and restoration. Insight periods use swipe plus accessible buttons and pull-to-refresh plus an explicit refresh button.

Haptics and earcons default off; preference-gated feedback helpers only run in user actions. Network state says Connected/Offline, never falsely claims sales were synced. Glass blur is limited to the top bar and overlay sheet (two layers). No noise overlay or extra illustration is introduced.
