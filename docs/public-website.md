# Public website — before Phase 3

Follow-up: Phase 3 adds protected account routes and moves the unauthenticated sample to `/demo/bill`. The public header now links to store setup. The evidence below records the original public-site delivery.

The user requested this addition after the Phase 1–2 checkpoint. It is separate from the original 15 phases, which do not prescribe a public landing or about page. This website is delivered in one commit before proceeding with the newly authorized Phases 3–4.

## Routes and content

| Route           | Purpose                                                                    | Plan grounding                             |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| `/`             | Product introduction, mission, planned capabilities, prototype entry, FAQ  | Project vision; Phases 4–14                |
| `/about`        | Who we are, purpose, mission, vision, principles, data-handling intentions | Merchant-first vision; Phases 2, 5, 12, 14 |
| `/how-it-works` | The intended store-to-order-to-payment-to-insights journey                 | Phases 3–13; offline boundary in Phase 14  |
| `/roadmap`      | All 15 phases, current foundations, next milestone, wider backlog          | All phase prompts and Appendix A           |

All 46 PDF pages and every master prompt were re-read before implementation. Public copy describes the product being built. It does not invent founders, customers, testimonials, impact metrics, launch dates, fees, or provider partnerships. Voice, payments, recommendations, persistence, and offline sync remain labelled as planned. The current sample UI is distinguished from a usable merchant service.

English and Hindi are complete in the route-local `public` i18n namespace. Other existing app language preferences show an explicit English fallback notice without overwriting the preference. Numbers use `Intl`. Hindi copy should still receive native-speaker editorial review before a real launch.

## Architecture and next phases

`App.jsx` splits exact public routes from the lazy `MerchantApp.jsx`. Public content, CSS, and imagery stay outside the bill route's initial JavaScript. Existing merchant URLs, sample interactions, first-run coach, and development-only gallery remain available. The merchant brand links back home on desktop and mobile.

Phase 3 can add `/login` and `/onboarding`, a session provider, and a guard around merchant routes without wrapping public routes in authentication. Its new account action can be added to the public header alongside the prototype entry. Phase 4 can replace the catalog skeleton behind the same `/catalog` URL. Do not turn the public feature descriptions into feature flags or couple them to sample billing state. Update current-status copy and roadmap labels as each later milestone is actually delivered.

Public pages set translated titles and descriptions, support deep links and anchor links, scroll and focus after route changes, and restore metadata when leaving for the merchant app. The current client-rendered setup does not claim prerendered search-engine coverage; production origin/canonical URLs should be set with the eventual deployment.

## Design and assets

The supplied Human Next screenshot inspired only the black, cerulean, and rose palette and editorial scale. The layout, merchant story, photograph, and copy are original. Existing Sora/Inter/Noto typography and accessible theme tokens are reused. There are no added runtime dependencies, sign-up forms, analytics trackers, or new external image requests. Existing Google Fonts behavior is retained.

The hero image is an AI-generated illustration, labelled in both languages. Generation mode: new image, `image_gen` tool, opaque background, no input reference image. The generated PNG was encoded as a 126 kB WebP for delivery without changing the composition. Project asset: `apps/client/public/images/kirana-shopkeeper.webp`.

Exact generation prompt:

> Create an original photographic website hero asset. Use case: photorealistic editorial portrait for Kirana Voice Copilot, a regional-language billing and insights concept for Indian neighbourhood shopkeepers. Portrait composition, a warm, confident Indian woman shopkeeper in her late thirties, wearing a simple deep blue cotton kurta, behind the counter of her own small authentic kirana grocery shop, holding a plain smartphone naturally in one hand, looking toward a customer just outside the frame with a small candid smile. Human, capable, grounded. Beautiful understated cinematic photography with rich blacks, cerulean blue side light and a narrow neon rose rim light, warm practical light within the grocery shelves. Realistic bags of staples, glass jars, stacked grocery boxes and stainless steel containers in the soft-focus background. Skin stays natural and believable. Subject occupies centre-right, head and hand both visible, waist-up, generous breathing room above and beside her. Dark edges that blend into a near-black website background. Tactile analogue grain, high-end documentary magazine quality, 50mm lens, no glossy cyberpunk costume, no cyborg, no holograms. No text, letters, logos, brands, watermark, signage, UI overlays or fake phone screen details. This is a completely original composition, not an imitation of another website.

## Verification

- 31 JavaScript tests pass, including public-to-merchant navigation, metadata cleanup, route focus, mobile-menu Escape, language and theme persistence, expandable payment disclosure, 15-phase status, English/Hindi content parity, and semantic axe checks on all four public routes.
- Real browser: all four routes checked at 360, 768, and 1280 px, in English/dark and Hindi/day (24 cases). Each had one H1, no horizontal page overflow, and no clipped heading or paragraph text. Desktop homepage also inspected at 1440 px.
- Existing theme contrast tests cover the reused text/control tokens. JSDOM axe does not evaluate color or physical-device usability. No real-phone sunlight, assistive-technology, or network performance claim is made.
- Production build and bundle check pass: bill JavaScript 179.9 KiB gzip including first-run and gesture chunks. The guard explicitly includes the lazy merchant entry and rejects public-page leakage. Development gallery remains excluded.
- Evidence: [desktop home](screenshots/public-home-desktop.png), [Hindi/day mobile story](screenshots/public-about-hindi-day-mobile.png).

No live service or deployment is implied by the local preview or GitHub push.
