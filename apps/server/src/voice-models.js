import mongoose from 'mongoose';
const { Schema } = mongoose;
const ticket = new Schema(
  { _id: String, merchantId: Schema.Types.ObjectId, family: String, expiresAt: Date },
  { strict: 'throw' },
);
ticket.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const daily = new Schema(
  {
    _id: String,
    merchantId: Schema.Types.ObjectId,
    day: String,
    spentPaise: { type: Number, default: 0 },
    utterances: { type: Number, default: 0 },
    audioMs: { type: Number, default: 0 },
    ttsCharacters: { type: Number, default: 0 },
    spokenCharacters: { type: Number, default: 0 },
    cacheHits: { type: Number, default: 0 },
    ttsRequests: { type: Number, default: 0 },
    firstPartialTotalMs: { type: Number, default: 0 },
    partialCount: { type: Number, default: 0 },
    finalTotalMs: { type: Number, default: 0 },
    finalCount: { type: Number, default: 0 },
  },
  { strict: 'throw' },
);
daily.index({ merchantId: 1, day: -1 });
const bill = new Schema(
  {
    merchantId: Schema.Types.ObjectId,
    clientBillId: String,
    audioMs: { type: Number, default: 0 },
    ttsCharacters: { type: Number, default: 0 },
    spokenCharacters: { type: Number, default: 0 },
    estimatedCostPaise: { type: Number, default: 0 },
  },
  { timestamps: true },
);
bill.index({ merchantId: 1, clientBillId: 1 }, { unique: true });
const sample = new Schema(
  { ownerHash: String, lang: String, text: String, createdAt: { type: Date, default: Date.now } },
  { strict: 'throw' },
);
sample.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 86400 });
export const VoiceTicket = mongoose.model('VoiceTicket', ticket, 'voiceTickets');
export const VoiceDaily = mongoose.model('VoiceDaily', daily, 'voiceDaily');
export const VoiceBillUsage = mongoose.model('VoiceBillUsage', bill, 'voiceBillUsage');
export const VoiceSample = mongoose.model('VoiceSample', sample, 'voiceSamples');
export async function ensureVoiceIndexes() {
  await Promise.all(
    [VoiceTicket, VoiceDaily, VoiceBillUsage, VoiceSample].map((model) => model.init()),
  );
}
