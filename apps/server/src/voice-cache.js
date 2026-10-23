import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
const { GridFSBucket } = mongoose.mongo;
import { normaliseSpeechText } from '@kirana/shared/voice';

export function speechCacheKey({ text, lang, voice, pace, format = 'mp3', model = 'bulbul:v3' }) {
  return createHash('sha256')
    .update(JSON.stringify([model, lang, voice, pace, format, normaliseSpeechText(text)]))
    .digest('hex');
}
export function createAudioCache({ maxBytes = 128 * 1024 * 1024, clock = () => new Date() } = {}) {
  const bucket = () => new GridFSBucket(mongoose.connection.db, { bucketName: 'ttsAudio' });
  const files = () => mongoose.connection.db.collection('ttsAudio.files');
  const scoped = (owner, key) => createHash('sha256').update(`${owner}:${key}`).digest('hex');
  async function remove(id) {
    await bucket()
      .delete(id)
      .catch(() => {});
  }
  async function get(owner, key) {
    const file = await files().findOne({ 'metadata.cacheKey': scoped(owner, key) });
    if (!file) return null;
    if (+file.metadata.expiresAt < +clock()) {
      await remove(file._id);
      return null;
    }
    const chunks = [];
    for await (const chunk of bucket().openDownloadStream(file._id)) chunks.push(chunk);
    await files().updateOne({ _id: file._id }, { $set: { 'metadata.usedAt': clock() } });
    return {
      bytes: Buffer.concat(chunks),
      contentType: file.metadata.contentType,
      provider: file.metadata.provider,
    };
  }
  async function put(owner, key, audio) {
    if (!audio.bytes.length || audio.bytes.length > Math.min(maxBytes, 8 * 1024 * 1024)) return;
    const cacheKey = scoped(owner, key),
      existing = await files().findOne({ 'metadata.cacheKey': cacheKey });
    if (existing) return;
    const stream = bucket().openUploadStream(cacheKey, {
      metadata: {
        cacheKey,
        owner: String(owner),
        contentType: audio.contentType,
        provider: audio.provider,
        usedAt: clock(),
        expiresAt: new Date(+clock() + 7 * 86400000),
      },
    });
    await new Promise((resolve, reject) => {
      stream.once('finish', resolve);
      stream.once('error', reject);
      stream.end(audio.bytes);
    });
    await sweep();
  }
  async function sweep() {
    const rows = await files().find({}).sort({ 'metadata.usedAt': 1 }).toArray();
    let total = rows.reduce((sum, row) => sum + row.length, 0);
    let count = rows.length;
    for (const file of rows)
      if (total > maxBytes || count > 2000 || +file.metadata.expiresAt < +clock()) {
        await remove(file._id);
        total -= file.length;
        count--;
      }
  }
  return { get, put, sweep };
}
