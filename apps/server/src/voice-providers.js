import WebSocket from 'ws';
import { splitSpeech, voiceCapabilities, toAppLanguage } from '@kirana/shared/voice';
import { wavFromPcm } from '@kirana/shared/audio';
import { problem } from './http.js';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function requestJSON(url, options, fetcher = fetch) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(url, {
        ...options,
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
          : AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw problem(
          response.status === 429 ? 429 : 503,
          response.status === 401 || response.status === 403
            ? 'VOICE_AUTH_FAILED'
            : 'VOICE_PROVIDER_UNAVAILABLE',
        );
      return await response.json();
    } catch (error) {
      if (error.code === 'VOICE_AUTH_FAILED' || options.signal?.aborted || attempt)
        throw problem(503, 'VOICE_PROVIDER_UNAVAILABLE');
      await pause(200);
    }
  }
}
function openSocket(url, key, { Socket = WebSocket, signal } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const socket = new Socket(url, {
      headers: { 'api-subscription-key': key },
      handshakeTimeout: 8000,
      maxPayload: 8 * 1024 * 1024,
    });
    const aborted = () => {
      socket.terminate();
      reject(problem(499, 'VOICE_CANCELLED'));
    };
    signal?.addEventListener('abort', aborted, { once: true });
    socket.once('open', () => resolve(socket));
    socket.once('error', () => reject(problem(503, 'VOICE_PROVIDER_UNAVAILABLE')));
    socket.once('close', () => signal?.removeEventListener('abort', aborted));
  });
}
export class SarvamStt {
  constructor(config, { fetcher = fetch, Socket = WebSocket } = {}) {
    this.config = config;
    this.fetcher = fetcher;
    this.Socket = Socket;
  }
  async transcribeChunk({ pcm, lang, signal }) {
    const form = new FormData();
    form.append('file', new Blob([wavFromPcm(pcm)], { type: 'audio/wav' }), 'utterance.wav');
    form.append('model', 'saaras:v3');
    form.append('mode', 'transcribe');
    form.append('language_code', lang === 'auto' ? 'unknown' : lang);
    const data = await requestJSON(
      `${this.config.SARVAM_BASE_URL}/speech-to-text`,
      {
        method: 'POST',
        headers: { 'api-subscription-key': this.config.SARVAM_API_KEY },
        body: form,
        signal,
      },
      this.fetcher,
    );
    if (typeof data.transcript !== 'string') throw problem(502, 'VOICE_INVALID_RESPONSE');
    return {
      text: data.transcript.slice(0, 6000),
      lang: toAppLanguage(data.language_code) || lang,
    };
  }
  async streamTranscribe({ lang, onPartial, onFinal, onError, signal }) {
    const url = new URL('/speech-to-text-realtime/ws', this.config.SARVAM_BASE_URL);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    url.search = new URLSearchParams({
      model: 'saaras:v3-realtime',
      language_code: lang === 'auto' ? 'auto' : voiceCapabilities[lang].sttLanguage,
      endpointing: 'manual',
      sample_rate: '16000',
      encoding: 'linear16',
      stream_type: 'fast',
      mode: 'transcribe',
    });
    const socket = await openSocket(url, this.config.SARVAM_API_KEY, {
      Socket: this.Socket,
      signal,
    });
    let finished = false;
    const fail = () => {
      if (!finished) {
        finished = true;
        onError(problem(503, 'VOICE_PROVIDER_UNAVAILABLE'));
      }
    };
    socket.on('message', (bytes) => {
      try {
        const data = JSON.parse(bytes.toString());
        if (data.event === 'transcript.partial' && typeof data.text === 'string')
          onPartial({ text: data.text.slice(0, 6000), lang: toAppLanguage(data.language) || lang });
        if (data.event === 'transcript.final' && typeof data.text === 'string') {
          finished = true;
          onFinal({ text: data.text.slice(0, 6000), lang: toAppLanguage(data.language) || lang });
          socket.close();
        }
        if (data.event === 'error') fail();
      } catch {
        fail();
      }
    });
    socket.on('error', fail);
    socket.on('close', fail);
    socket.send(JSON.stringify({ event: 'speech_start' }));
    return {
      write: (pcm) => {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(
            JSON.stringify({ event: 'audio_input', audio: Buffer.from(pcm).toString('base64') }),
          );
      },
      finish: () => {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ event: 'speech_end' }));
      },
      abort: () => {
        finished = true;
        socket.terminate();
      },
    };
  }
}
export class SarvamTts {
  constructor(config, { fetcher = fetch, Socket = WebSocket } = {}) {
    this.config = config;
    this.fetcher = fetcher;
    this.Socket = Socket;
  }
  async synthesize({ text, lang, voice, pace, format = 'mp3', signal }) {
    const data = await requestJSON(
      `${this.config.SARVAM_BASE_URL}/text-to-speech`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': this.config.SARVAM_API_KEY,
        },
        body: JSON.stringify({
          text,
          model: 'bulbul:v3',
          language_code: lang,
          speaker: voice,
          pace,
          speech_sample_rate: 22050,
          output_audio_codec: format,
        }),
        signal,
      },
      this.fetcher,
    );
    if (
      !Array.isArray(data.audios) ||
      !data.audios.length ||
      data.audios.some((value) => typeof value !== 'string' || value.length > 12 * 1024 * 1024)
    )
      throw problem(502, 'VOICE_INVALID_RESPONSE');
    const bytes = Buffer.concat(data.audios.map((value) => Buffer.from(value, 'base64')));
    if (bytes.length > 8 * 1024 * 1024) throw problem(502, 'VOICE_INVALID_RESPONSE');
    return {
      bytes,
      contentType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      provider: 'sarvam',
    };
  }
  async streamSynthesize({ text, lang, voice, pace, signal }) {
    const url = new URL('/text-to-speech/ws', this.config.SARVAM_BASE_URL);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    url.search = new URLSearchParams({ model: 'bulbul:v3', send_completion_event: 'true' });
    const socket = await openSocket(url, this.config.SARVAM_API_KEY, {
      Socket: this.Socket,
      signal,
    });
    return new Promise((resolve, reject) => {
      let chunks = [],
        size = 0,
        done = false;
      const finish = (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        socket.terminate();
        if (error) reject(error);
        else
          resolve({ bytes: Buffer.concat(chunks), contentType: 'audio/mpeg', provider: 'sarvam' });
        chunks = [];
      };
      const timer = setTimeout(() => finish(problem(504, 'VOICE_TIMEOUT')), 25000).unref();
      socket.on('message', (bytes) => {
        try {
          const data = JSON.parse(bytes.toString());
          if (data.type === 'audio' && typeof data.data?.audio === 'string') {
            const audio = Buffer.from(data.data.audio, 'base64');
            size += audio.length;
            if (size > 8 * 1024 * 1024) throw new Error('size');
            chunks.push(audio);
          }
          if (data.type === 'event' && data.data?.event_type === 'final')
            finish(chunks.length ? null : problem(502, 'VOICE_INVALID_RESPONSE'));
          if (data.type === 'error') finish(problem(503, 'VOICE_PROVIDER_UNAVAILABLE'));
        } catch {
          finish(problem(502, 'VOICE_INVALID_RESPONSE'));
        }
      });
      socket.on('error', () => finish(problem(503, 'VOICE_PROVIDER_UNAVAILABLE')));
      socket.on('close', () => finish(problem(503, 'VOICE_PROVIDER_UNAVAILABLE')));
      socket.send(
        JSON.stringify({
          type: 'config',
          data: {
            model: 'bulbul:v3',
            language_code: lang,
            speaker: voice,
            pace,
            speech_sample_rate: 22050,
            output_audio_codec: 'mp3',
            min_buffer_size: 50,
            max_chunk_length: 500,
          },
        }),
      );
      for (const sentence of splitSpeech(text, 500, lang))
        socket.send(JSON.stringify({ type: 'text', data: { text: sentence } }));
      socket.send(JSON.stringify({ type: 'flush' }));
    });
  }
}
export class BhashiniFallback {
  constructor(config, { fetcher = fetch } = {}) {
    this.config = config;
    this.fetcher = fetcher;
  }
  supports(lang, kind) {
    return Boolean(
      this.config.BHASHINI_ENABLED &&
      this.config.BHASHINI_CALLBACK_URL &&
      this.config.BHASHINI_AUTH_VALUE &&
      this.config.BHASHINI_SERVICES[lang]?.[kind],
    );
  }
  async compute(kind, { lang, pcm, text, voice, pace = 0.95, signal }) {
    if (!this.supports(lang, kind)) throw problem(503, 'VOICE_NOT_CONFIGURED');
    const language = lang === 'od-IN' ? 'or' : lang.split('-')[0];
    const body = {
      pipelineTasks: [
        {
          taskType: kind === 'stt' ? 'asr' : 'tts',
          config: {
            language: { sourceLanguage: language },
            serviceId: this.config.BHASHINI_SERVICES[lang][kind],
            ...(kind === 'stt'
              ? { audioFormat: 'wav', samplingRate: 16000 }
              : {
                  gender: voice === 'shubh' ? 'male' : 'female',
                  speed: pace,
                  samplingRate: 22050,
                }),
          },
        },
      ],
      inputData:
        kind === 'stt'
          ? {
              input: [{ source: null }],
              audio: [{ audioContent: Buffer.from(wavFromPcm(pcm)).toString('base64') }],
            }
          : { input: [{ source: text }] },
    };
    const data = await requestJSON(
      this.config.BHASHINI_CALLBACK_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [this.config.BHASHINI_AUTH_HEADER]: this.config.BHASHINI_AUTH_VALUE,
        },
        body: JSON.stringify(body),
        signal,
      },
      this.fetcher,
    );
    const result = data.pipelineResponse?.[0];
    if (kind === 'stt') {
      if (typeof result?.output?.[0]?.source !== 'string')
        throw problem(502, 'VOICE_INVALID_RESPONSE');
      return { text: result.output[0].source.slice(0, 6000), lang };
    }
    if (typeof result?.audio?.[0]?.audioContent !== 'string')
      throw problem(502, 'VOICE_INVALID_RESPONSE');
    const bytes = Buffer.from(result.audio[0].audioContent, 'base64');
    if (bytes.length > 8 * 1024 * 1024) throw problem(502, 'VOICE_INVALID_RESPONSE');
    return { bytes, contentType: 'audio/wav', provider: 'bhashini' };
  }
  transcribeChunk(options) {
    return this.compute('stt', options);
  }
  synthesize(options) {
    return this.compute('tts', options);
  }
}
