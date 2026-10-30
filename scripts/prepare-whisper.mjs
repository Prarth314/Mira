import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const commit = '306c88f4d1286aec1bf96e544632897886af5501';
const root = path.resolve('vendor/whisper');
const runtime = path.join(root, 'runtime');
await fs.mkdir(runtime, { recursive: true });

async function download(url, name, checksum) {
  const target = path.join(root, name);
  let bytes = await fs.readFile(target).catch(() => null);
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== checksum) {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Runtime download failed: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== checksum) throw new Error('Runtime archive checksum mismatch');
    await fs.writeFile(target, bytes);
  }
  return target;
}

const source = await download(`https://codeload.github.com/ggml-org/whisper.cpp/tar.gz/${commit}`, 'source.tar.gz',
  'f3585ebf64df3e41b26c45d93bdb38b423ca1de0bf40cc4b6d320254867a75df');
execFileSync('tar', ['-xf', source, '-C', root], { stdio: 'inherit' });
const sourceRoot = path.join(root, `whisper.cpp-${commit}`);
await fs.copyFile(path.join(sourceRoot, 'LICENSE'), path.join(runtime, 'LICENSE-whisper.txt'));

if (process.platform === 'win32' && process.arch === 'x64') {
  const archive = await download('https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip', 'runtime.zip',
    '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a');
  execFileSync('tar', ['-xf', archive, '-C', root], { stdio: 'inherit' });
  for (const file of await fs.readdir(path.join(root, 'Release'))) {
    if (file === 'whisper-cli.exe' || /^(ggml.*|whisper)\.dll$/.test(file)) {
      await fs.copyFile(path.join(root, 'Release', file), path.join(runtime, file));
    }
  }
} else if (process.platform === 'darwin') {
  const build = path.join(root, `build-${process.arch}`);
  execFileSync('cmake', ['-S', sourceRoot, '-B', build, '-DCMAKE_BUILD_TYPE=Release',
    '-DGGML_NATIVE=OFF', '-DBUILD_SHARED_LIBS=OFF', '-DWHISPER_BUILD_TESTS=OFF', '-DGGML_METAL_EMBED_LIBRARY=ON'], { stdio: 'inherit' });
  execFileSync('cmake', ['--build', build, '--config', 'Release', '--target', 'whisper-cli', '-j', '2'], { stdio: 'inherit' });
  await fs.copyFile(path.join(build, 'bin', 'whisper-cli'), path.join(runtime, 'whisper-cli'));
  await fs.chmod(path.join(runtime, 'whisper-cli'), 0o755);
} else {
  throw new Error(`Bundled speech is not certified for ${process.platform}/${process.arch}`);
}

const files = {};
for (const file of await fs.readdir(runtime)) {
  if (file === 'manifest.json') continue;
  files[file] = createHash('sha256').update(await fs.readFile(path.join(runtime, file))).digest('hex');
}
await fs.writeFile(path.join(runtime, 'manifest.json'), JSON.stringify({ version: '1.9.2', commit, platform: process.platform, arch: process.arch, files }, null, 2));
console.log(`Verified Whisper 1.9.2 prepared for ${process.platform}/${process.arch}`);
