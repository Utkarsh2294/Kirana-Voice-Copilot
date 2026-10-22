# Phase 3 — merchant accounts and onboarding

Read the complete 46-page plan, its global preamble, and the Phase 3 master prompt and acceptance checklist (pages 12–13) before implementation. The public website was already pushed separately as `bbe3fbf`; this phase follows the user's subsequent authorization to continue through Phase 4.

## Implementation plan and result

- Server: explicit Mongoose collections/indexes for Merchant, OtpRequest, RefreshToken, AuditLog, and durable auth rate buckets; OTP/session routes; authenticated profile and onboarding routes; PIN resolution; QR validation; shared Zod request schemas.
- Client: memory-only access token, single-flight refresh, guarded merchant routes, sign-in, four saved onboarding steps, text-only Listen previews, account controls, and query defaults ready for the catalog.
- Delivery: actual database integration tests, client flow tests, responsive browser checks, PIN-source attribution, and same-origin development/Compose API forwarding.

## Run

Normal durable development uses the existing Compose replica set and environment examples. Start Docker Desktop, copy `.env.example` files as in the README, enable development OTP explicitly in the server's local environment, and run `npm run dev:all`. The local Compose server runs in development mode. Production refuses `ALLOW_DEV_OTP=true`.

For a disposable local database without Docker, run each block in a separate terminal:

```powershell
npm ci
npm run dev:database
```

```powershell
$env:MONGO_URI='mongodb://127.0.0.1:27018/kirana-preview?replicaSet=testset'
$env:ALLOW_DEV_OTP='true'
$env:SMS_PROVIDER='console'
npm run dev -w @kirana/server
```

```powershell
npm run dev -w @kirana/client
```

The server still needs its `.env` file with development secrets from the example. The disposable helper downloads an official MongoDB binary on first use and removes its temporary database when stopped. Do not use it for real merchant data. Use Compose/Atlas for persistence across database restarts.

Open `/login`, use a synthetic Indian mobile number, and enter `123456` **only when the visible development banner is present**. No SMS is sent by that mode. The fixed code is not returned in API responses or logs. Real SMS providers remain intentionally unconnected: `console` supports the gated development preview; `msg91` and `twilio` selections fail with `SMS_NOT_CONFIGURED` until their documented vendor adapter is supplied. No paid message is sent automatically.

## API and security

All paths below are under `/api/v1`.

| Method    | Path                                                    | Behavior                                                                                        |
| --------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET       | `/auth/capabilities`                                    | Whether explicitly gated development OTP is available                                           |
| POST      | `/auth/otp/request`, `/auth/otp/verify`                 | Generic request response; six digits; salted scrypt hash; five minutes; five committed attempts |
| POST      | `/auth/refresh`                                         | Rotate a 30-day opaque refresh token; detect reuse and revoke its family                        |
| POST      | `/auth/logout`, `/auth/logout-all`                      | Revoke one family or every merchant family, including access-token validity                     |
| GET/PATCH | `/merchants/me`                                         | Own profile; allowlisted settings updates                                                       |
| PUT       | `/merchants/me/language`, `/store`, `/location`, `/upi` | Validated, ordered, resumable setup; edits never reduce saved progress                          |
| POST      | `/merchants/me/qr`                                      | Own PNG/JPEG/WebP image, canonical base64 and file signature, maximum 300 KiB                   |
| GET       | `/regions/pincode`, `/regions/suggest`                  | Authenticated local lookup and optional coarse-coordinate suggestion                            |

The access JWT expires in 15 minutes, is restricted to HS256/issuer/audience, and stays in memory. An active refresh family is checked on authenticated requests so logout/reuse also invalidates outstanding access tokens. Refresh cookies are httpOnly, SameSite=Lax by default, and always Secure in production. Local HTTP development explicitly allows a non-Secure cookie; HTTPS deployment must use Secure. State changes require `x-kirana-client: web`; CORS uses the configured exact allowlist. No token, phone, OTP, full request body, or UPI value is put in structured logs or audit metadata. Refresh rotation and OTP consumption use Mongo transactions; atomic rolling-window buckets enforce at most three requests per phone and IPv6-safe IP subnet per ten minutes across API instances. Audit events record login, logout, reuse, language, and UPI changes.

Global operator detection uses `express-mongo-sanitize`'s object inspection API because Express 5's query property is a getter. Strict Zod schemas reject unexpected body/query/parameter fields. The server derives `regionId`; client-supplied district/state/region are rejected. Optional browser coordinates are rounded before transmission and again on the server. Location never runs automatically.

The 19,300-PIN snapshot is derived from the Department of Posts directory, retrieved through a documented public mirror when the government download returned 503. Its source, checksum, licence, transformation, and coordinate caveats are in `apps/server/src/data/pincodes-source.json`. Duplicate PIN entries use the most common state/district; coordinates are a coarse median for suggestions only. The merchant must confirm suggestions. Unknown PINs use `pin:<first-three-digits>`. This is a bundled snapshot, not a claim of live postal accuracy.

## Client boundaries and continuation

Public pages stay unauthenticated. The sample workspace moved to `/demo/*`; private `/bill`, `/catalog`, `/insights`, `/settings`, and `/customers` require a session. Onboarding restores the server's saved step after reload. Account settings can save language/theme/haptics/earcons, reopen setup, or sign out one/all devices. Saved merchant identity appears in the shell. Billing remains the Phase 2 sample until its persistence phase.

Every onboarding step has a Listen control. `useSpeak` shows the intended instruction as text and logs only a generic development diagnostic; it never stores or speaks raw user data. WebOTP is an optional user-invoked enhancement with manual paste fallback, not a dependency for login. Actual Android SMS delivery and browser permissions need a configured provider and device verification. The preview does not generate an operational payment QR or claim to verify UPI ownership.

TanStack Query defaults live in `auth/query.js` and will be consumed by Phase 4's catalog; login and token rotation use the small native-fetch client. Login/onboarding copy and validation, gallery copy, settings copy, and insight copy are route-local to keep the bill payload small. Common English/Hindi parity remains checked, and route copy has parity checks too.

## Acceptance evidence

- [x] A new synthetic phone signs in, completes all four steps, reloads with a valid session, and sees its saved store name. Verified through the browser against the real local API/Mongo replica set; also covered by the client flow test and server integration journey.
- [x] Old refresh replay revokes the family, rejects the newer refresh, and rejects the newer access JWT. Real Mongo transaction test.
- [x] Wrong, expired, used, and exhausted OTPs fail; concurrent verification succeeds once. Rate limiting and validation paths are covered.
- [x] Structured test-run logs contain no phone, OTP, access token, or refresh cookie; audit metadata is allowlisted and empty for current events.
- [x] Production config rejects the fixed-development-OTP flag. Unconfigured real SMS fails explicitly.
- [x] Account and public route boundaries, single-flight refresh, request headers, theme/language persistence, and the onboarding UI journey are automated.
- [x] Browser verification includes 360px UPI setup without horizontal overflow, desktop sign-in/setup, PIN resolution, reload/resume, and completed workspace identity. Evidence: [mobile UPI setup](screenshots/phase-03-upi-mobile.png), [completed workspace](screenshots/phase-03-workspace-desktop.png).
- [ ] Live SMS delivery, WebOTP on physical Android hardware, real geolocation permission behavior, and native-speaker review are not verified. Speech synthesis belongs to Phase 6; payment confirmation belongs to Phase 9.

Verification commands:

```powershell
npm run lint
npm run format:check
npm test
npm run build
node scripts/check-client-build.js
npm audit --audit-level=high
```

At this milestone, 46 JavaScript tests passed. The bill bundle includes the authenticated entry, first-run guidance, and gesture features within the 180 KiB gzip guard. CI also runs Python and Compose checks. No production deployment is implied by the GitHub push.

Implementation references checked: [Mongoose 8 transactions](https://mongoosejs.com/docs/8.x/docs/transactions.html), [JWT signing and verification](https://github.com/auth0/node-jsonwebtoken), [WebOTP](https://developer.mozilla.org/en-US/docs/Web/API/WebOTP_API), [TanStack defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), and [government PIN directory](https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month).
