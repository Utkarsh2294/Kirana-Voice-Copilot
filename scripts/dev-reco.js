import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

if (existsSync('services/reco/.env')) process.loadEnvFile('services/reco/.env');
const child = spawn(
  process.env.PYTHON || 'python',
  ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'services/reco', '--port', '8000', '--reload'],
  { stdio: 'inherit', env: process.env },
);
child.on('error', () => {
  console.error(
    'Python could not start. Set PYTHON to the interpreter with requirements-dev.txt installed.',
  );
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
