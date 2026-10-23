import { EventEmitter } from 'node:events';
import { it, expect, vi } from 'vitest';
import { SarvamStt, SarvamTts, BhashiniFallback } from './voice-providers.js';
const config = { SARVAM_BASE_URL: 'https://api.sarvam.ai', SARVAM_API_KEY: 'private-test-key' };
it('sends current REST model/language fields and PCM WAV without exposing the key in a URL', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify({ transcript: 'ଚାଉଳ', language_code: 'od-IN' }), { status: 200 }),
  );
  const stt = new SarvamStt(config, { fetcher });
  expect(
    await stt.transcribeChunk({
      pcm: new Uint8Array(6400),
      lang: 'od-IN',
      signal: AbortSignal.timeout(1000),
    }),
  ).toEqual({ text: 'ଚାଉଳ', lang: 'od-IN' });
  const [url, request] = fetcher.mock.calls[0];
  expect(url).toBe('https://api.sarvam.ai/speech-to-text');
  expect(request.headers['api-subscription-key']).toBe('private-test-key');
  expect(request.body.get('model')).toBe('saaras:v3');
  expect(request.body.get('language_code')).toBe('od-IN');
  expect((await request.body.get('file').arrayBuffer()).byteLength).toBe(6444);
  const ttsFetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ audios: [Buffer.from('test-audio').toString('base64')] })),
  );
  await new SarvamTts(config, { fetcher: ttsFetch }).synthesize({
    text: 'Hello',
    lang: 'en-IN',
    voice: 'ishita',
    pace: 0.95,
  });
  const body = JSON.parse(ttsFetch.mock.calls[0][1].body);
  expect(body).toMatchObject({
    model: 'bulbul:v3',
    language_code: 'en-IN',
    speaker: 'ishita',
    pace: 0.95,
    output_audio_codec: 'mp3',
  });
  expect(body).not.toHaveProperty('target_language_code');
  expect(body).not.toHaveProperty('pitch');
});
it('uses manual streaming boundaries, the streaming Odia code and aborts its socket', async () => {
  let socket, url, headers;
  class Socket extends EventEmitter {
    constructor(value, options) {
      super();
      url = new URL(value);
      headers = options.headers;
      socket = this;
      this.sent = [];
      this.readyState = 1;
      queueMicrotask(() => this.emit('open'));
    }
    send(value) {
      this.sent.push(JSON.parse(value));
    }
    close() {
      this.terminate();
    }
    terminate() {
      this.closed = true;
      this.emit('close');
    }
  }
  const onPartial = vi.fn(),
    onFinal = vi.fn(),
    controller = new AbortController();
  const stream = await new SarvamStt(config, { Socket }).streamTranscribe({
    lang: 'od-IN',
    onPartial,
    onFinal,
    onError: vi.fn(),
    signal: controller.signal,
  });
  expect(url.pathname).toBe('/speech-to-text-realtime/ws');
  expect(url.searchParams.get('language_code')).toBe('or-IN');
  expect(url.searchParams.get('model')).toBe('saaras:v3-realtime');
  expect(headers['api-subscription-key']).toBe('private-test-key');
  stream.write(new Uint8Array([0, 1]));
  stream.finish();
  expect(socket.sent.map((message) => message.event)).toEqual([
    'speech_start',
    'audio_input',
    'speech_end',
  ]);
  socket.emit(
    'message',
    Buffer.from(JSON.stringify({ event: 'transcript.partial', text: 'ଚା', language: 'or-IN' })),
  );
  socket.emit(
    'message',
    Buffer.from(JSON.stringify({ event: 'transcript.final', text: 'ଚାଉଳ', language: 'or-IN' })),
  );
  expect(onPartial).toHaveBeenCalledWith({ text: 'ଚା', lang: 'od-IN' });
  expect(onFinal).toHaveBeenCalledWith({ text: 'ଚାଉଳ', lang: 'od-IN' });
  controller.abort();
  expect(socket.closed).toBe(true);
});
it('streams long TTS as bounded MP3 sentences and uses only configured Bhashini service IDs', async () => {
  let socket;
  class Socket extends EventEmitter {
    constructor() {
      super();
      socket = this;
      this.sent = [];
      this.readyState = 1;
      queueMicrotask(() => this.emit('open'));
    }
    send(value) {
      const message = JSON.parse(value);
      this.sent.push(message);
      if (message.type === 'flush')
        queueMicrotask(() => {
          this.emit(
            'message',
            Buffer.from(
              JSON.stringify({
                type: 'audio',
                data: { audio: Buffer.from('mp3').toString('base64') },
              }),
            ),
          );
          this.emit(
            'message',
            Buffer.from(JSON.stringify({ type: 'event', data: { event_type: 'final' } })),
          );
        });
    }
    terminate() {
      this.emit('close');
    }
  }
  const audio = await new SarvamTts(config, { Socket }).streamSynthesize({
    text: 'One sentence. '.repeat(80),
    lang: 'hi-IN',
    voice: 'shubh',
    pace: 0.95,
    signal: AbortSignal.timeout(2000),
  });
  expect(audio.contentType).toBe('audio/mpeg');
  expect(socket.sent[0].data).toMatchObject({ language_code: 'hi-IN', output_audio_codec: 'mp3' });
  expect(
    socket.sent
      .filter((message) => message.type === 'text')
      .every((message) => message.data.text.length <= 500),
  ).toBe(true);
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify({ pipelineResponse: [{ output: [{ source: 'चावल' }] }] })),
  );
  const fallback = new BhashiniFallback(
    {
      ...config,
      BHASHINI_ENABLED: true,
      BHASHINI_CALLBACK_URL: 'https://bhashini.example/compute',
      BHASHINI_AUTH_HEADER: 'X-Compute',
      BHASHINI_AUTH_VALUE: 'private-fallback',
      BHASHINI_SERVICES: { 'hi-IN': { stt: 'configured-asr' } },
    },
    { fetcher },
  );
  expect(fallback.supports('ta-IN', 'stt')).toBe(false);
  expect(await fallback.transcribeChunk({ pcm: new Uint8Array(320), lang: 'hi-IN' })).toEqual({
    text: 'चावल',
    lang: 'hi-IN',
  });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).pipelineTasks[0]).toMatchObject({
    taskType: 'asr',
    config: { serviceId: 'configured-asr', language: { sourceLanguage: 'hi' } },
  });
});
