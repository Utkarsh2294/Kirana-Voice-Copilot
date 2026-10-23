# ADR-008: Voice protocols, bounded usage and private caching

Accepted for the Phase 6 prototype, 23 October 2026. Extends ADR-003 after checking the current vendor documentation and the installed VAD package.

## Provider contracts

`SarvamStt` exposes `streamTranscribe` and `transcribeChunk`; `SarvamTts` exposes `synthesize` and `streamSynthesize`. Provider credentials stay in server configuration. Browser fallback coverage is discovered on the device, never inferred from the cloud matrix.

- [Sarvam REST STT](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe): multipart PCM WAV, `saaras:v3`, `mode=transcribe`; auto language is `unknown`; REST Odia is `od-IN`.
- [Sarvam realtime STT](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe/realtime/ws): `/speech-to-text-realtime/ws`, `saaras:v3-realtime`, mono 16 kHz `linear16`, manual `speech_start` / `audio_input` / `speech_end`; partial/final transcript events. Streaming auto is `auto`; streaming Odia is `or-IN`, normalized back to `od-IN` in the application.
- [REST TTS](https://docs.sarvam.ai/api-reference/text-to-speech/convert): `bulbul:v3`, `language_code`, `speaker`, pace, 22,050 Hz and output codec. Do not send the older `target_language_code`, pitch or loudness options. REST text has a 2,500-character vendor limit; this app uses it only for replies up to 500 characters.
- [Streaming TTS](https://docs.sarvam.ai/api-reference/text-to-speech/stream): config, sentence text frames and flush, followed by MP3 audio and final event. Streaming is MP3-only. This prototype collects bounded streamed output into a complete playable response; it does not claim progressive browser playback or a first-audio latency target. Long WAV requests are rejected explicitly.
- [Voices](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices): Shubh and Ishita are the default male/female voices; default pace is 0.95. The matrix contains all eleven planned output languages and twenty-three input codes. V4 models now appear in vendor documentation; the supported v3 contracts remain aligned with the supplied plan.
- [Bhashini compute](https://dibd-bhashini.gitbook.io/bhashini-apis/pipeline-compute-call) requires the callback URL, returned authentication header/value and language-specific service IDs from an approved pipeline configuration. The adapter remains off by default. Do not guess a universal endpoint or enable unsupported languages.

REST requests have a ten-second deadline and at most two attempts with a bounded backoff. WebSocket handshakes have an eight-second deadline. The gateway keeps one bounded utterance in memory for REST fallback, closes idle/overlong sessions and aborts upstream work when the client disconnects.

## Capture and ownership

The browser resumes AudioContext in the initiating gesture, requests mono audio with AEC/noise suppression/AGC, and converts samples through an AudioWorklet into 200 ms PCM16 frames. Silero v5 gates live speech; the installed package's NonRealTimeVAD supports its legacy model for file regression. Leading padding and a short withheld tail limit silence; hands-free ends on speech end or the fifteen-second cap. Tap, hold/release, slide-up lock, keyboard activation and cancellation share one capture controller.

The installed VAD package does not export `ort` from its root and its file entry imports full ONNX. Use its `ortConfig` hook and alias the full runtime to the CPU/WASM entry. WASM and model assets are self-hosted from the locked npm dependencies, loaded only on voice intent, and accompanied by `voice-assets/NOTICE.txt`. No CDN is needed for model loading. The first voice use downloads roughly 18 MB of uncompressed model/runtime assets; it requires a capable browser and can take longer on a slow connection.

`POST /voice/token` issues a thirty-second, single-use, audience-scoped JWT bound to the authenticated merchant and active refresh family. The client sends it in the `kirana-voice.<ticket>` WebSocket subprotocol, never a URL. Origin, expiry, replay, suspended accounts and session ownership are checked before upgrade. No vendor key enters a browser response. The gateway accepts at most fifteen seconds of PCM, with per-message limits, two sessions per merchant and 128 sessions per process.

## Retention and usage

Raw input audio and raw transcript logs are not stored. The visible transcript lives in memory and clears on route exit/sign-out. Optional seven-day samples are off by default, pseudonymized with a daily HMAC, and redact numbers plus words outside the catalog lexicon. This is risk reduction, not a claim of perfect anonymization; production consent wording and native review remain release checks.

Generated TTS replies are private per merchant in GridFS, keyed by normalized text, model, language, voice, pace and format. LRU eviction bounds the cache to the configured bytes and 2,000 entries; replies expire after seven days, with hourly cleanup while the API runs and checks on access/write. Device Cache Storage holds at most fifty replies per merchant and clears on sign-out or the explicit clear control. Generated replies may contain bill details, so a shared device must be signed out. Neither cache holds microphone recordings.

Daily usage and per-draft UUID counters contain audio duration, billed/requested characters, cache hits and timing aggregates. Device cache hits send bounded, authenticated operational counters; they do not send the transcript. Counters are estimates and are not invoices. Cached replies cost no additional provider characters. New replies require an atomic reservation; `DAILY_VOICE_BUDGET` is an integer **paise** cap, and zero disables paid voice. The initial default is six utterances/minute and 300/day per merchant.

[Published Sarvam pricing](https://docs.sarvam.ai/api/getting-started/pricing) was ₹30/hour STT and ₹30/10,000 characters Bulbul v3 at implementation. The app conservatively rounds estimated paise upward, including failed attempts as estimates. Vendor retries, fallback tariffs, taxes and provider-side billing can differ; configure provider-side limits before a live pilot. The application cap is not a financial guarantee. Browser recognition may use a browser vendor's online service and must not be advertised as offline speech.

## Next-phase boundary

Phase 7 receives `{text, lang}` plus timing metadata from the voice store. Phase 6 does not interpret quantities, resolve spoken item matches, mutate bills, create sales, collect payments or offer business advice. `clientBillId` already scopes operational metrics and is renewed with each new draft, leaving the later persisted-bill contract intact.
