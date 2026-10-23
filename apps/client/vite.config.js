import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { voiceAssets } from './voice-assets.js';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), voiceAssets()],
  // The file-VAD entry imports the full ONNX package. Both paths use the same CPU/WASM runtime.
  resolve: { alias: [{ find: /^onnxruntime-web$/, replacement: 'onnxruntime-web/wasm' }] },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3001',
      '/ws/voice': { target: process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3001', ws: true },
    },
  },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  build: { sourcemap: false, target: 'es2023', manifest: true },
});
