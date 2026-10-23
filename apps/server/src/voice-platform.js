import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {
  voiceLanguageCodes,
  voiceCapabilities,
  sarvamVoices,
  normaliseSpeechText,
  voiceFallbackOrder,
} from '@kirana/shared/voice';
import { VoiceTicket } from './voice-models.js';
import { Merchant, RefreshToken } from './models.js';
import { SarvamStt, SarvamTts, BhashiniFallback } from './voice-providers.js';
import { createAudioCache, speechCacheKey } from './voice-cache.js';
import { createVoiceUsage, estimatedVoiceCost } from './voice-usage.js';
import { validateRequest, problem } from './http.js';

const language = z.enum(voiceLanguageCodes);
const billId = z.string().uuid().optional();
const tokenBody = z
  .object({ lang: language.or(z.literal('auto')).optional(), clientBillId: billId })
  .strict();
const ttsBody = z
  .object({
    text: z.string().min(1).max(6000).transform(normaliseSpeechText).refine(Boolean),
    lang: language,
    voice: z.enum(sarvamVoices).optional(),
    pace: z.number().min(0.5).max(2).default(0.95),
    format: z.enum(['mp3', 'wav']).default('mp3'),
    clientBillId: billId,
  })
  .strict();
const finishSchema = z.object({ type: z.literal('finish') }).strict();

export function createVoicePlatform({
  config,
  logger,
  providers = {},
  audioCache,
  clock = () => new Date(),
}) {
  const stt = providers.stt || new SarvamStt(config),
    tts = providers.tts || new SarvamTts(config),
    fallback = providers.fallback || new BhashiniFallback(config);
  const cache = audioCache || createAudioCache({ maxBytes: config.TTS_CACHE_MAX_BYTES, clock });
  const usage = createVoiceUsage(config, { clock });
  const inFlight = new Map(),
    connections = new Set();
  let wss, cacheSweep;
  const cloudEnabled = () => Boolean(config.SARVAM_API_KEY && config.DAILY_VOICE_BUDGET);
  function router(auth) {
    const router = Router();
    router.use(auth.authenticate, (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
    router.get('/capabilities', (req, res) => {
      validateRequest(req);
      res.json({
        languages: Object.fromEntries(
          Object.entries(voiceCapabilities).map(([lang, entry]) => [
            lang,
            {
              ...entry,
              configuredStt: voiceFallbackOrder(lang, {
                sarvam: cloudEnabled(),
                bhashini: Boolean(config.DAILY_VOICE_BUDGET) && fallback.supports(lang, 'stt'),
                kind: 'stt',
              }),
              configuredTts: voiceFallbackOrder(lang, {
                sarvam: cloudEnabled(),
                bhashini: Boolean(config.DAILY_VOICE_BUDGET) && fallback.supports(lang, 'tts'),
              }),
            },
          ]),
        ),
        maxUtteranceSeconds: 15,
        serverAudioStored: false,
      });
    });
    router.post('/token', async (req, res) => {
      const { body } = validateRequest(req, tokenBody);
      const lang = body.lang || req.merchant.voiceLanguage;
      if (!cloudEnabled() && !fallback.supports(lang, 'stt'))
        throw problem(503, 'VOICE_NOT_CONFIGURED');
      await usage.utterance(req.merchant._id);
      const id = randomUUID(),
        expiresAt = new Date(+clock() + 30000);
      await VoiceTicket.create({
        _id: id,
        merchantId: req.merchant._id,
        family: req.tokenFamily,
        expiresAt,
      });
      const token = jwt.sign(
        { family: req.tokenFamily, lang, clientBillId: body.clientBillId },
        config.JWT_ACCESS_SECRET,
        {
          algorithm: 'HS256',
          audience: 'kirana-voice',
          issuer: 'kirana-api',
          subject: String(req.merchant._id),
          jwtid: id,
          expiresIn: 30,
        },
      );
      res.json({ token, expiresAt, maxUtteranceSeconds: 15 });
    });
    router.post('/tts', async (req, res) => {
      const { body } = validateRequest(req, ttsBody);
      const selected =
        body.voice || voiceCapabilities[body.lang].voices[req.merchant.voicePreference] || 'ishita';
      const options = { ...body, voice: selected };
      if (options.format === 'wav' && options.text.length > 500)
        throw problem(400, 'VOICE_FORMAT_UNSUPPORTED');
      const key = speechCacheKey(options),
        owner = req.merchant._id;
      let audio = await cache.get(owner, key),
        cacheHit = Boolean(audio);
      if (!audio) {
        const flightKey = `${owner}:${key}`;
        if (inFlight.has(flightKey)) {
          audio = await inFlight.get(flightKey);
          cacheHit = true;
        } else {
          if (inFlight.size >= 20) throw problem(429, 'VOICE_RATE_LIMITED');
          const controller = new AbortController();
          const closed = () => controller.abort();
          req.once('aborted', closed);
          res.once('close', closed);
          const request = (async () => {
            const order = voiceFallbackOrder(body.lang, {
              sarvam: cloudEnabled(),
              bhashini: fallback.supports(body.lang, 'tts'),
            });
            if (!order.length) throw problem(503, 'VOICE_NOT_CONFIGURED');
            const reservation = await usage.reserve(
              owner,
              estimatedVoiceCost({ characters: body.text.length }),
            );
            let result;
            try {
              for (const provider of order) {
                try {
                  result =
                    provider === 'sarvam'
                      ? await tts[body.text.length > 500 ? 'streamSynthesize' : 'synthesize']({
                          ...options,
                          signal: controller.signal,
                        })
                      : await fallback.synthesize({ ...options, signal: controller.signal });
                  break;
                } catch {
                  if (controller.signal.aborted) throw problem(499, 'VOICE_CANCELLED');
                }
              }
              if (!result) throw problem(503, 'VOICE_PROVIDER_UNAVAILABLE');
              await cache.put(owner, key, result);
              return result;
            } finally {
              await usage.record(owner, {
                reservation,
                characters: body.text.length,
                tts: true,
                clientBillId: body.clientBillId,
              });
            }
          })();
          inFlight.set(flightKey, request);
          try {
            audio = await request;
          } finally {
            inFlight.delete(flightKey);
            req.removeListener('aborted', closed);
            res.removeListener('close', closed);
          }
        }
      }
      if (cacheHit)
        await usage.record(owner, {
          cacheHit: true,
          tts: true,
          spokenCharacters: body.text.length,
          clientBillId: body.clientBillId,
        });
      res
        .set({
          'Content-Type': audio.contentType,
          'X-Voice-Cache': cacheHit ? 'hit' : 'miss',
          'X-Voice-Provider': audio.provider,
          'X-Voice-Key': key,
          'Cache-Control': 'private, no-store',
        })
        .send(audio.bytes);
    });
    router.post('/cache-hit', async (req, res) => {
      const { body } = validateRequest(
        req,
        z
          .object({
            key: z.string().regex(/^[a-f0-9]{64}$/),
            characters: z.number().int().min(1).max(6000),
            clientBillId: billId,
          })
          .strict(),
      );
      if (await cache.get(req.merchant._id, body.key))
        await usage.record(req.merchant._id, {
          cacheHit: true,
          tts: true,
          spokenCharacters: body.characters,
          clientBillId: body.clientBillId,
        });
      res.sendStatus(204);
    });
    router.get('/usage', async (req, res) => {
      validateRequest(req);
      const daily = await usage.read(req.merchant._id);
      res.json({ ...daily, budgetPaise: config.DAILY_VOICE_BUDGET, estimateOnly: true });
    });
    return router;
  }
  async function authenticateUpgrade(req) {
    if (!config.CORS_ORIGINS.includes(req.headers.origin)) throw problem(403, 'ORIGIN_DENIED');
    const protocol = req.headers['sec-websocket-protocol'];
    if (typeof protocol !== 'string' || !/^kirana-voice\.[\w.-]+$/.test(protocol))
      throw problem(401, 'UNAUTHENTICATED');
    let claims;
    try {
      claims = jwt.verify(protocol.slice('kirana-voice.'.length), config.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
        audience: 'kirana-voice',
        issuer: 'kirana-api',
        clockTimestamp: Math.floor(+clock() / 1000),
      });
    } catch {
      throw problem(401, 'UNAUTHENTICATED');
    }
    if (
      typeof claims.sub !== 'string' ||
      !/^[a-f\d]{24}$/i.test(claims.sub) ||
      typeof claims.jti !== 'string'
    )
      throw problem(401, 'UNAUTHENTICATED');
    const ticket = await VoiceTicket.findOneAndDelete({
      _id: claims.jti,
      merchantId: claims.sub,
      family: claims.family,
      expiresAt: { $gt: clock() },
    });
    const active =
      ticket &&
      (await RefreshToken.exists({
        merchantId: claims.sub,
        family: claims.family,
        replacedBy: null,
        expiresAt: { $gt: clock() },
      }));
    const merchant = active && (await Merchant.findById(claims.sub).lean());
    if (!merchant || merchant.status === 'suspended') throw problem(401, 'UNAUTHENTICATED');
    return { merchant, claims };
  }
  async function session(client, { merchant, claims }) {
    if (
      connections.size >= 128 ||
      [...connections].filter((connection) => connection.owner === String(merchant._id)).length >= 2
    ) {
      client.close(1008, 'VOICE_RATE_LIMITED');
      return;
    }
    const owner = String(merchant._id),
      connection = { client, owner };
    connections.add(connection);
    const controller = new AbortController(),
      started = +clock();
    let stream,
      bytes = 0,
      chunks = [],
      ended = false,
      settled = false,
      firstPartialMs = null,
      finishing = false,
      usingRest = false,
      reservation;
    let timeout, hardLimit;
    const send = (message) => {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
    };
    async function settle() {
      if (settled) return;
      settled = true;
      await usage
        .record(merchant._id, {
          reservation,
          audioMs: Math.ceil(bytes / 32),
          firstPartialMs,
          finalMs: +clock() - started,
          clientBillId: claims.clientBillId,
        })
        .catch(() => {});
    }
    const cleanup = () => {
      if (ended) return;
      ended = true;
      clearTimeout(timeout);
      clearTimeout(hardLimit);
      controller.abort();
      stream?.abort();
      chunks = [];
      connections.delete(connection);
      settle();
    };
    const fail = (code) => {
      logger.warn({ code, requestId: randomUUID() }, 'Voice session ended with an error');
      send({ type: 'error', code, fallback: 'browser' });
      client.close(1011, code);
      cleanup();
    };
    const final = async (result) => {
      if (ended) return;
      if (!result.text.trim()) {
        fail('VOICE_NO_SPEECH');
        return;
      }
      const lang = voiceLanguageCodes.includes(result.lang) ? result.lang : merchant.voiceLanguage;
      send({
        type: 'final',
        text: result.text.slice(0, 6000),
        lang,
        metrics: { firstPartialMs, finalMs: +clock() - started, audioMs: Math.ceil(bytes / 32) },
      });
      await usage.anonymisedSample(merchant, result.text, lang).catch(() => {});
      client.close(1000);
      cleanup();
    };
    async function rest() {
      const pcm = Buffer.concat(chunks);
      chunks = [];
      if (!pcm.length) {
        fail('VOICE_NO_SPEECH');
        return;
      }
      const lang = claims.lang === 'auto' ? merchant.voiceLanguage : claims.lang;
      try {
        let result;
        if (cloudEnabled())
          try {
            result = await stt.transcribeChunk({
              pcm,
              lang: claims.lang,
              signal: controller.signal,
            });
          } catch {
            /* Try the explicitly configured fallback. */
          }
        if (!result && fallback.supports(lang, 'stt'))
          result = await fallback.transcribeChunk({ pcm, lang, signal: controller.signal });
        if (!result) throw problem(503, 'VOICE_PROVIDER_UNAVAILABLE');
        await final(result);
      } catch {
        if (!ended) fail('VOICE_PROVIDER_UNAVAILABLE');
      }
    }
    function finish() {
      if (finishing || ended) return;
      finishing = true;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!usingRest) {
          usingRest = true;
          stream?.abort();
          rest();
        } else fail('VOICE_TIMEOUT');
      }, 12000).unref();
      if (usingRest) rest();
      else stream?.finish();
    }
    client.on('close', cleanup);
    client.on('error', cleanup);
    client.on('message', (data, binary) => {
      if (ended || finishing) return;
      clearTimeout(timeout);
      timeout = setTimeout(() => fail('VOICE_TIMEOUT'), 4000).unref();
      if (binary) {
        if (data.length > 8000 || data.length % 2 || bytes + data.length > 480000) {
          fail('VOICE_AUDIO_LIMIT');
          return;
        }
        bytes += data.length;
        chunks.push(Buffer.from(data));
        if (!usingRest) stream?.write(data);
      } else {
        try {
          finishSchema.parse(JSON.parse(data.toString()));
          finish();
        } catch {
          fail('VOICE_INVALID_MESSAGE');
        }
      }
    });
    try {
      reservation = await usage.reserve(merchant._id, estimatedVoiceCost({ audioMs: 15000 }));
      if (ended) {
        await usage.record(merchant._id, { reservation });
        return;
      }
      if (cloudEnabled())
        try {
          stream = await stt.streamTranscribe({
            lang: claims.lang,
            signal: controller.signal,
            onPartial: (result) => {
              if (firstPartialMs == null) firstPartialMs = +clock() - started;
              send({ type: 'partial', text: result.text.slice(0, 6000), lang: result.lang });
            },
            onFinal: (result) => final(result),
            onError: () => {
              usingRest = true;
              stream?.abort();
              if (finishing) rest();
            },
          });
        } catch {
          usingRest = true;
        }
      else usingRest = true;
      if (ended) {
        stream?.abort();
        return;
      }
      hardLimit = setTimeout(() => fail('VOICE_TIMEOUT'), 40000).unref();
      timeout = setTimeout(() => fail('VOICE_TIMEOUT'), 5000).unref();
      send({ type: 'ready', mode: usingRest ? 'rest' : 'stream', sampleRate: 16000 });
    } catch (error) {
      fail(error.code === 'VOICE_BUDGET_EXCEEDED' ? error.code : 'VOICE_PROVIDER_UNAVAILABLE');
    }
  }
  function attach(server) {
    const sweep = () =>
      cache
        .sweep?.()
        .catch(() =>
          logger.warn({ code: 'VOICE_CACHE_CLEANUP_FAILED' }, 'Voice cache cleanup will retry'),
        );
    sweep();
    cacheSweep = setInterval(sweep, 3600000).unref();
    wss = new WebSocketServer({ noServer: true, maxPayload: 10000, perMessageDeflate: false });
    server.on('upgrade', async (req, socket, head) => {
      if (req.url !== '/ws/voice') {
        socket.destroy();
        return;
      }
      try {
        const context = await authenticateUpgrade(req);
        wss.handleUpgrade(req, socket, head, (client) => {
          session(client, context).catch(() => client.close(1011, 'VOICE_PROVIDER_UNAVAILABLE'));
        });
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
      }
    });
  }
  function close() {
    clearInterval(cacheSweep);
    for (const { client } of connections) {
      client.terminate();
    }
    wss?.close();
  }
  return { router, attach, close, usage, connections };
}
