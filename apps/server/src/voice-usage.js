import { createHmac } from 'node:crypto';
import { VoiceDaily, VoiceBillUsage, VoiceSample } from './voice-models.js';
import { AuthRateBucket } from './models.js';
import { CatalogItem } from './catalog-models.js';
import { dayIST } from './market-feeds.js';
import { problem } from './http.js';

// Conservative paise reservation; provider invoices can contain fractions of a paise.
export const estimatedVoiceCost = ({ audioMs = 0, characters = 0 }) =>
  Number(
    (BigInt(Math.ceil(audioMs / 1000)) * 3000n + 3599n) / 3600n +
      (BigInt(characters) * 3000n + 9999n) / 10000n,
  );

export function createVoiceUsage(config, { clock = () => new Date() } = {}) {
  const identity = (merchantId) => ({
    _id: `${merchantId}:${dayIST(clock())}`,
    merchantId,
    day: dayIST(clock()),
  });
  async function ensure(merchantId) {
    const key = identity(merchantId);
    try {
      await VoiceDaily.updateOne({ _id: key._id }, { $setOnInsert: key }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    return key;
  }
  async function utterance(merchantId) {
    const minute = `voice:${merchantId}:${Math.floor(+clock() / 60000)}`;
    const now = clock();
    const rate = await AuthRateBucket.findOneAndUpdate(
      { _id: minute },
      [
        {
          $set: {
            events: { $concatArrays: [{ $ifNull: ['$events', []] }, [now]] },
            expiresAt: new Date(+now + 120000),
          },
        },
      ],
      { upsert: true, new: true },
    );
    if (rate.events.length > config.VOICE_UTTERANCES_PER_MINUTE)
      throw problem(429, 'VOICE_RATE_LIMITED');
    const key = await ensure(merchantId);
    const daily = await VoiceDaily.updateOne(
      { _id: key._id, utterances: { $lt: config.VOICE_UTTERANCES_PER_DAY } },
      { $inc: { utterances: 1 } },
    );
    if (!daily.modifiedCount) throw problem(429, 'VOICE_DAILY_LIMIT');
  }
  async function reserve(merchantId, cost) {
    if (!config.DAILY_VOICE_BUDGET) throw problem(429, 'VOICE_BUDGET_EXCEEDED');
    const key = await ensure(merchantId);
    const result = await VoiceDaily.updateOne(
      { _id: key._id, spentPaise: { $lte: config.DAILY_VOICE_BUDGET - cost } },
      { $inc: { spentPaise: cost } },
    );
    if (!result.modifiedCount && cost) throw problem(429, 'VOICE_BUDGET_EXCEEDED');
    return { dayId: key._id, cost };
  }
  async function record(
    merchantId,
    {
      reservation,
      audioMs = 0,
      characters = 0,
      spokenCharacters = characters,
      cacheHit = false,
      tts = false,
      firstPartialMs,
      finalMs,
      clientBillId,
    },
  ) {
    const key = await ensure(merchantId),
      cost = estimatedVoiceCost({ audioMs, characters });
    const stats = {
      audioMs,
      ttsCharacters: characters,
      spokenCharacters,
      cacheHits: Number(cacheHit),
      ttsRequests: Number(tts),
      firstPartialTotalMs: firstPartialMs ?? 0,
      partialCount: Number(firstPartialMs != null),
      finalTotalMs: finalMs ?? 0,
      finalCount: Number(finalMs != null),
    };
    if (reservation) {
      // Reserve and settlement use the same IST day even if an utterance crosses midnight.
      await VoiceDaily.updateOne(
        { _id: reservation.dayId },
        { $inc: { spentPaise: cost - reservation.cost, ...stats } },
      );
    } else await VoiceDaily.updateOne({ _id: key._id }, { $inc: stats });
    if (clientBillId)
      await VoiceBillUsage.updateOne(
        { merchantId, clientBillId },
        {
          $inc: { audioMs, ttsCharacters: characters, spokenCharacters, estimatedCostPaise: cost },
        },
        { upsert: true },
      );
  }
  async function anonymisedSample(merchant, text, lang) {
    if (!merchant.settings.voiceTranscriptOptIn) return;
    const items = await CatalogItem.find({ active: true }).select('names aliases').lean();
    const allowed = new Set(
      items
        .flatMap((item) => [
          ...Object.values(item.names),
          ...item.aliases.map((alias) => alias.text),
        ])
        .flatMap((text) => text.toLocaleLowerCase().match(/[\p{L}\p{M}]+/gu) || []),
    );
    const sanitized = (text.match(/[\p{L}\p{M}]+|\p{N}+|[^\s]/gu) || [])
      .map((token) =>
        /\p{N}/u.test(token)
          ? '[number]'
          : allowed.has(token.toLocaleLowerCase())
            ? token
            : '[redacted]',
      )
      .join(' ')
      .slice(0, 6000);
    const ownerHash = createHmac('sha256', config.PHONE_HMAC_SECRET)
      .update(`${merchant._id}:${dayIST(clock())}`)
      .digest('hex');
    await VoiceSample.create({ ownerHash, lang, text: sanitized });
  }
  return {
    utterance,
    reserve,
    record,
    anonymisedSample,
    read: async (merchantId) =>
      (await VoiceDaily.findById(identity(merchantId)._id).lean()) || {
        audioMs: 0,
        ttsCharacters: 0,
        spentPaise: 0,
        cacheHits: 0,
        ttsRequests: 0,
        utterances: 0,
      },
  };
}
