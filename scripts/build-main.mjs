import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist-electron', { recursive: true });
await build({
  entryPoints: ['src/main/index.ts'],
  outfile: 'dist-electron/main.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron', 'systeminformation'],
  sourcemap: true,
});
await build({
  entryPoints: ['preload.js'],
  outfile: 'dist-electron/preload.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
