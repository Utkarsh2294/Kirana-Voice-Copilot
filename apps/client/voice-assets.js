import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const vad = dirname(require.resolve('@ricky0123/vad-web'));
const ort = dirname(require.resolve('onnxruntime-web/wasm'));
const assets = new Map([
  ['vad.worklet.bundle.min.js', join(vad, 'vad.worklet.bundle.min.js')],
  ['silero_vad_legacy.onnx', join(vad, 'silero_vad_legacy.onnx')],
  ['silero_vad_v5.onnx', join(vad, 'silero_vad_v5.onnx')],
  ['ort-wasm-simd-threaded.wasm', join(ort, 'ort-wasm-simd-threaded.wasm')],
  ['ort-wasm-simd-threaded.mjs', join(ort, 'ort-wasm-simd-threaded.mjs')],
]);
export function voiceAssets() {
  return {
    name: 'kirana-local-voice-assets',
    configureServer(server) {
      server.middlewares.use('/voice-assets/', (req, res, next) => {
        const path = assets.get(req.url.split('?')[0].replace(/^\//, ''));
        if (!path) return next();
        res.setHeader(
          'Content-Type',
          req.url.includes('.wasm')
            ? 'application/wasm'
            : req.url.includes('.onnx')
              ? 'application/octet-stream'
              : 'text/javascript',
        );
        res.end(readFileSync(path));
      });
    },
    generateBundle() {
      for (const [name, path] of assets)
        this.emitFile({
          type: 'asset',
          fileName: `voice-assets/${name}`,
          source: readFileSync(path),
        });
    },
  };
}
