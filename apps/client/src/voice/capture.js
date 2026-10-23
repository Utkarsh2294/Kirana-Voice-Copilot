import { MicVAD } from '@ricky0123/vad-web';
import workletUrl from './pcm-worklet.js?worker&url';
import { pcm16 } from '@kirana/shared/audio';
import { usePreferences } from '../preferences.js';
import { api } from '../api.js';
import { useDraftBill } from '../pricing/draft.js';
import { useVoice, registerCaptureStop, stopSpeech } from './control.js';

const configureOrt = (ort) => {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = '/voice-assets/';
};
let fileVad;
const fail = (code) => Object.assign(new Error(code), { code });
export function browserInputAvailable() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}
export async function browserCapture(job) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) throw fail('unsupported');
  const recognition = new Recognition(),
    prefs = usePreferences.getState();
  recognition.lang = prefs.voiceLanguage;
  recognition.interimResults = true;
  recognition.continuous = false;
  job.cancel = () => recognition.abort();
  job.finish = () => recognition.stop();
  useVoice.setState({ capture: 'listening', notice: 'browserInput', inputProvider: 'browser' });
  const started = performance.now();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => recognition.stop(), 15000);
    recognition.onresult = (event) => {
      const results = [...event.results];
      const text = results.map((result) => result[0].transcript).join(' ');
      useVoice.setState({ partial: text });
      if (results.at(-1).isFinal) {
        useVoice.setState({
          capture: 'final',
          transcript: { text, lang: prefs.voiceLanguage },
          metrics: { finalMs: Math.round(performance.now() - started) },
          partial: '',
        });
      }
    };
    recognition.onerror = (event) => {
      clearTimeout(timer);
      recognition.onend = null;
      if (job.cancelled || event.error === 'aborted') resolve();
      else reject(fail(event.error === 'not-allowed' ? 'denied' : 'inputUnavailable'));
    };
    recognition.onend = () => {
      clearTimeout(timer);
      if (useVoice.getState().capture !== 'final' && !job.cancelled)
        useVoice.setState({ capture: 'error', error: 'noSpeech' });
      resolve();
    };
    recognition.start();
  });
  await job.context.close();
}
async function socketFor(lang, signal) {
  const draft = useDraftBill.getState(),
    prefs = usePreferences.getState();
  const { token } = await api('/voice/token', {
    method: 'POST',
    body: {
      lang,
      clientBillId: draft.merchantId === prefs.voiceMerchantId ? draft.clientBillId : undefined,
    },
    signal,
  });
  const url = new URL('/ws/voice', import.meta.env.VITE_WS_URL || location.origin);
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  const socket = new WebSocket(url, `kirana-voice.${token}`);
  socket.binaryType = 'arraybuffer';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(fail('timeout'));
    }, 10000);
    const aborted = () => {
      socket.close();
      reject(fail('cancelled'));
    };
    signal.addEventListener('abort', aborted, { once: true });
    socket.addEventListener('message', function ready(event) {
      const message = JSON.parse(event.data);
      if (message.type === 'ready') {
        clearTimeout(timer);
        socket.removeEventListener('message', ready);
        resolve(socket);
      } else if (message.type === 'error') {
        clearTimeout(timer);
        socket.close();
        reject(fail(message.code));
      }
    });
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(fail('inputUnavailable'));
      },
      { once: true },
    );
    socket.addEventListener('close', () => signal.removeEventListener('abort', aborted), {
      once: true,
    });
  });
}
export async function captureAudio(job) {
  if (job.browser) return browserCapture(job);
  const prefs = usePreferences.getState();
  const capability = await api('/voice/capabilities');
  const lang =
    prefs.voiceAutoDetect &&
    capability.languages[prefs.voiceLanguage]?.configuredStt.includes('sarvam')
      ? 'auto'
      : prefs.voiceLanguage;
  useVoice.setState({ capabilities: capability.languages });
  if (job.cancelled) return;
  if (!capability.languages[prefs.voiceLanguage]?.configuredStt.length) {
    if (job.finished) {
      useVoice.setState({ capture: 'idle' });
      return;
    }
    return browserCapture(job);
  }
  let stream, vad, source, pcmNode, gain, analyser, socket, timer, permissionTimer, silenceTimer;
  const controller = new AbortController();
  let recording = false,
    finished = false,
    finishing = false,
    flushed = null,
    pre = [],
    tail = [],
    speech = false,
    sentBytes = 0,
    frameQueue = Promise.resolve();
  const closeAudio = () => {
    clearTimeout(timer);
    clearTimeout(permissionTimer);
    clearTimeout(silenceTimer);
    recording = false;
    pre = [];
    tail = [];
    stream?.getTracks().forEach((track) => track.stop());
    pcmNode?.disconnect();
    source?.disconnect();
    gain?.disconnect();
    analyser?.disconnect();
    vad?.destroy().catch(() => {});
    job.context.close().catch(() => {});
    useVoice.setState({ level: 0 });
  };
  job.cancel = () => {
    finished = true;
    controller.abort();
    socket?.close();
    closeAudio();
  };
  const send = (bytes) => {
    if (socket?.readyState === WebSocket.OPEN && sentBytes + bytes.length <= 480000) {
      socket.send(bytes);
      sentBytes += bytes.length;
    }
  };
  const consume = (bytes) => {
    if (!recording || finished) return;
    if (!speech) {
      pre.push(bytes);
      if (pre.length > 2) pre.shift();
    } else {
      tail.push(bytes);
      if (tail.length > 1) send(tail.shift());
    }
  };
  job.finish = async () => {
    if (finished || finishing) return;
    finishing = true;
    if (pcmNode)
      await new Promise((resolve) => {
        flushed = resolve;
        pcmNode.port.postMessage('flush');
        setTimeout(resolve, 150);
      });
    await frameQueue;
    finished = true;
    if (speech) for (const bytes of tail) send(bytes);
    tail = [];
    closeAudio();
    if (!sentBytes) {
      socket?.close();
      useVoice.setState({ capture: 'error', error: 'noSpeech' });
      return;
    }
    useVoice.setState({ capture: 'processing' });
    socket?.send(JSON.stringify({ type: 'finish' }));
  };
  try {
    await job.resumed;
    permissionTimer = setTimeout(() => {
      job.cancelled = true;
      job.cancel();
      useVoice.setState({ capture: 'error', error: 'timeout' });
    }, 25000);
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (job.cancelled) {
      closeAudio();
      return;
    }
    await job.context.audioWorklet.addModule(workletUrl);
    vad = await MicVAD.new({
      audioContext: job.context,
      ortConfig: configureOrt,
      model: 'v5',
      baseAssetPath: '/voice-assets/',
      onnxWASMBasePath: '/voice-assets/',
      processorType: 'AudioWorklet',
      startOnLoad: false,
      getStream: async () => stream,
      pauseStream: async () => {},
      resumeStream: async () => stream,
      preSpeechPadMs: 300,
      redemptionMs: 650,
      minSpeechMs: 200,
      positiveSpeechThreshold: 0.5,
      negativeSpeechThreshold: 0.35,
      onSpeechStart: () => {
        if (!speech) {
          speech = true;
          for (const bytes of pre) send(bytes);
          pre = [];
        }
      },
      onSpeechEnd: () => {
        tail = [];
        if (job.mode === 'handsfree') job.finish();
        else speech = false;
      },
      onFrameProcessed: (probabilities) => {
        if (recording) {
          const samples = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(samples);
          const peak = Math.sqrt(
            samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length,
          );
          useVoice.setState({
            level: Math.min(1, peak * 6),
            vadSpeech: probabilities.isSpeech > 0.5,
          });
        }
      },
    });
    if (job.cancelled || job.finished) {
      closeAudio();
      useVoice.setState({ capture: 'idle' });
      return;
    }
    socket = await socketFor(lang, controller.signal);
    if (job.cancelled) {
      closeAudio();
      socket.close();
      return;
    }
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'partial') useVoice.setState({ partial: message.text });
      if (message.type === 'final') {
        useVoice.setState({
          capture: 'final',
          partial: '',
          transcript: { text: message.text, lang: message.lang },
          metrics: message.metrics,
        });
        closeAudio();
        controller.abort();
      }
      if (message.type === 'error') {
        useVoice.setState({ capture: 'error', error: message.code });
        closeAudio();
        controller.abort();
      }
    });
    socket.addEventListener('close', () => {
      if (['preparing', 'listening', 'processing'].includes(useVoice.getState().capture))
        useVoice.setState({ capture: 'error', error: 'inputUnavailable' });
      closeAudio();
    });
    source = job.context.createMediaStreamSource(stream);
    analyser = job.context.createAnalyser();
    analyser.fftSize = 512;
    pcmNode = new AudioWorkletNode(job.context, 'kirana-pcm16');
    gain = job.context.createGain();
    gain.gain.value = 0;
    source.connect(analyser);
    analyser.connect(pcmNode);
    pcmNode.connect(gain);
    gain.connect(job.context.destination);
    pcmNode.port.onmessage = (event) => {
      if (event.data === 'flushed') {
        flushed?.();
        return;
      }
      const bytes = new Uint8Array(event.data);
      frameQueue = frameQueue.then(() => consume(bytes));
    };
    await vad.start();
    clearTimeout(permissionTimer);
    recording = true;
    useVoice.setState({ capture: 'listening', inputProvider: 'cloud' });
    timer = setTimeout(() => job.finish(), 15000);
    silenceTimer = setTimeout(() => {
      if (!speech && !sentBytes) job.finish();
    }, 5000);
  } catch (error) {
    job.cancel();
    if (!job.cancelled)
      useVoice.setState({
        capture: 'error',
        error:
          error.name === 'NotAllowedError'
            ? 'denied'
            : error.name === 'NotFoundError'
              ? 'microphone'
              : error.code || 'inputUnavailable',
      });
  }
}
export async function transcribeFile(file) {
  stopSpeech();
  if (file.size > 5 * 1024 * 1024) throw fail('audioLimit');
  const Context = window.AudioContext || window.webkitAudioContext,
    context = new Context();
  await context.resume();
  const controller = new AbortController();
  let socket;
  const unregister = registerCaptureStop(() => {
    controller.abort();
    socket?.close();
    context.close().catch(() => {});
  });
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration > 15) throw fail('audioLimit');
    const { NonRealTimeVAD } = await import('@ricky0123/vad-web');
    fileVad ||= NonRealTimeVAD.new({
      modelURL: '/voice-assets/silero_vad_legacy.onnx',
      ortConfig: configureOrt,
      preSpeechPadMs: 200,
      redemptionMs: 500,
      minSpeechMs: 200,
    });
    const vad = await fileVad;
    controller.signal.throwIfAborted();
    vad.frameProcessor.reset();
    const frames = [];
    for await (const segment of vad.run(decoded.getChannelData(0), decoded.sampleRate)) {
      controller.signal.throwIfAborted();
      frames.push(segment.audio);
    }
    vad.frameProcessor.reset();
    if (!frames.length) throw fail('noSpeech');
    const prefs = usePreferences.getState();
    socket = await socketFor(
      prefs.voiceAutoDetect ? 'auto' : prefs.voiceLanguage,
      controller.signal,
    );
    useVoice.setState({
      active: true,
      capture: 'processing',
      error: '',
      partial: '',
      transcript: null,
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        reject(fail('timeout'));
      }, 30000);
      controller.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(fail('cancelled'));
        },
        { once: true },
      );
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'partial') useVoice.setState({ partial: message.text });
        if (message.type === 'final') {
          clearTimeout(timer);
          useVoice.setState({
            capture: 'final',
            transcript: { text: message.text, lang: message.lang },
            metrics: message.metrics,
            partial: '',
          });
          resolve();
        }
        if (message.type === 'error') {
          clearTimeout(timer);
          reject(fail(message.code));
        }
      });
      socket.addEventListener(
        'error',
        () => {
          clearTimeout(timer);
          reject(fail('inputUnavailable'));
        },
        { once: true },
      );
      for (const frame of frames)
        for (let offset = 0; offset < frame.length; offset += 3200)
          socket.send(pcm16(frame.slice(offset, offset + 3200)));
      socket.send(JSON.stringify({ type: 'finish' }));
    });
  } finally {
    unregister();
    controller.abort();
    socket?.close();
    await context.close().catch(() => {});
  }
}
