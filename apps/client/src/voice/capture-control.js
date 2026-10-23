import { useVoice, stopSpeech, registerCaptureStop, cancelCapture } from './control.js';
let captureJob = null;
export function startCapture({ browser = false } = {}) {
  stopSpeech();
  cancelCapture();
  useVoice.setState({
    active: true,
    capture: 'preparing',
    partial: '',
    transcript: null,
    error: '',
    metrics: null,
    notice: '',
  });
  try {
    if (!window.isSecureContext) throw new Error('insecure');
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('microphone');
    const context = new Context(),
      resumed = context.resume();
    captureJob = { context, resumed, browser, mode: 'hold', finished: false, cancelled: false };
    const job = captureJob;
    import('./capture.js')
      .then((module) => {
        if (!job.cancelled) return module.captureAudio(job);
      })
      .catch((error) => {
        if (!job.cancelled)
          useVoice.setState({
            capture: 'error',
            error: error.code || error.message || 'unavailable',
          });
        context.close().catch(() => {});
      });
  } catch (error) {
    useVoice.setState({ capture: 'error', error: error.message || 'microphone' });
  }
}
export function finishCapture() {
  if (captureJob) {
    if (captureJob.finish) captureJob.finish();
    else captureJob.finished = true;
  }
}
export function lockCapture() {
  if (captureJob) captureJob.mode = 'handsfree';
}
function stopCaptureJob() {
  if (captureJob) {
    captureJob.cancelled = true;
    captureJob.cancel?.();
    captureJob.context.close().catch(() => {});
    captureJob = null;
  }
  useVoice.setState({ capture: 'idle', level: 0 });
}

registerCaptureStop(stopCaptureJob);
