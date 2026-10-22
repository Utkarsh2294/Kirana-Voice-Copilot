# Deployment preparation

No resources have been provisioned. Do not enable deployment until credentials, production origins and deployment targets have been reviewed.

## Client

1. Connect the GitHub repo to Vercel or Netlify, with Node 22 and the repository root as the install directory.
2. Run `npm ci` and `npm run build -w @kirana/client`; publish `apps/client/dist`.
3. Configure an SPA rewrite to `/index.html` for every non-file path. The dev gallery and voice harness must be absent from this build.
4. Set public `VITE_API_URL` and `VITE_WS_URL` to HTTPS production endpoints before building. `VITE_VAPID_PUBLIC_KEY` and `VITE_FEATURE_FLAGS` are optional placeholders. No secret may use a VITE_ prefix.

## Express and recommendation services

1. Create a MongoDB Atlas replica set. Configure least-privilege users and network access. Use the replica-set URI as server `MONGO_URI`.
2. Deploy `infra/server.Dockerfile` from repository root on Render or another Docker host. Expose port 3001; health path `/readyz`, liveness `/healthz`.
3. Set `NODE_ENV=production`, `PORT`, `MONGO_URI`, independent random `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PHONE_HMAC_SECRET` (minimum 32 characters), `PHONE_ENC_KEY` (32 random bytes as 64 hex characters), and a random shared `RECO_API_KEY`.
4. Deploy `services/reco/Dockerfile` from repository root. Expose port 8000, health path `/readyz`. Set the same `RECO_API_KEY`, then set server `RECO_URL` to its private network URL. Never expose this key to the client. Future database variables are documented in its env example.
5. Set `CORS_ORIGINS` to exact HTTPS client origins; set cookie settings for your domain. Cross-site cookies need `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true`. Keep `ALLOW_DEV_OTP=false`. Authentication is not implemented until Phase 3.
6. Sarvam, SMS, LLM, Paytm, data.gov.in and VAPID variables are placeholders until their phases. `PAYMENT_PROVIDER=demo` and `MARKET_FEED=simulated` indicate future provider choices; they do not activate a working payment or market API now.
7. Verify the health endpoints and deep links after deploying. This phase is a public UI prototype, without private merchant records or authentication.

## GitHub Actions deployment gating

CI runs on PRs and main. Deployment jobs are disabled unless repository variable `ENABLE_DEPLOY` is `true`. They also require environment `production` and secrets `CLIENT_DEPLOY_HOOK` (Netlify build hook or equivalent), `SERVER_DEPLOY_HOOK`, `RECO_DEPLOY_HOOK` (Render deploy hooks or equivalent). They run only after JavaScript, Python and Compose checks pass. Use production environment protection if manual release review is needed. Hooks must deploy the repository revision checked by CI; disable auto-deploy on unverified pushes.

All environment variables, including later integration placeholders, are listed with comments in each app's `.env.example`. Rotate demo/example secrets before any external hosting. Never copy the example keys into production.
