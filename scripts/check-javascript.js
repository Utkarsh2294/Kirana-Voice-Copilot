import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
}).split('\n');
const forbidden = files.filter((file) => /\.(ts|tsx)$/.test(file));
if (forbidden.length) {
  console.error(`JavaScript-only policy violated:\n${forbidden.join('\n')}`);
  process.exitCode = 1;
}
