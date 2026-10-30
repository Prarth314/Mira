import { app } from 'electron';
import { spawn } from 'node:child_process';
import { promises as fs, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { MiraError } from '../types/MiraError';
import { writeInt16PcmAsWav } from './wav';
import { MODEL } from './model-info';

let cachedBinary: string | null = null;
let modelReady: Promise<string> | null = null;
let downloadController: AbortController | null = null;
const progressListeners = new Set<DownloadProgress>();
export type DownloadProgress = (downloaded: number, total: number) => void;
const modelDir = () => path.join(app.getPath('userData'), 'models');
const modelPath = () => path.join(modelDir(), MODEL.name);

async function sha256OfFile(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function findWhisperBinary(): Promise<string> {
  if (cachedBinary) return cachedBinary;
  const directory = app.isPackaged
    ? path.join(process.resourcesPath, 'whisper')
    : path.join(app.getAppPath(), 'vendor', 'whisper', 'runtime');
  const name = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')) as {
      platform: string; arch: string; files: Record<string, string>;
    };
    if (manifest.platform !== process.platform || manifest.arch !== process.arch || !manifest.files[name]) throw new Error('Wrong runtime');
    for (const [file, digest] of Object.entries(manifest.files)) {
      if (!/^[a-zA-Z0-9._-]+$/.test(file) || !/^[a-f0-9]{64}$/.test(digest) ||
        await sha256OfFile(path.join(directory, file)) !== digest) throw new Error('Runtime integrity failure');
    }
    cachedBinary = path.join(directory, name);
    return cachedBinary;
  } catch {
    if (app.isPackaged) throw new MiraError('stt_failed', 'The bundled speech runtime is missing or damaged. Reinstall Mira.');
  }
  // Development-only fallback. Packaged apps never search an uncontrolled PATH.
  const found = await new Promise<string | null>((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'where.exe' : '/usr/bin/which', ['whisper-cli'], { windowsHide: true, timeout: 5000 });
    let out = '';
    child.stdout.on('data', (data: Buffer) => { out += data.toString(); });
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? out.trim().split(/\r?\n/)[0] : null));
  });
  if (found) { cachedBinary = found; return found; }
  throw new MiraError('stt_failed', 'Speech runtime unavailable. Developers: run npm run prepare:speech before recording.');
}

async function validModel(): Promise<boolean> {
  try {
    const stat = await fs.stat(modelPath());
    return stat.size === MODEL.sizeBytes && await sha256OfFile(modelPath()) === MODEL.sha256;
  } catch { return false; }
}

async function ensureModel(): Promise<string> {
  if (modelReady) return modelReady;
  const controller = new AbortController();
  downloadController = controller;
  modelReady = (async () => {
    if (await validModel()) return modelPath();
    await fs.mkdir(modelDir(), { recursive: true });
    const disk = await fs.statfs(modelDir());
    if (Number(disk.bavail) * Number(disk.bsize) < MODEL.sizeBytes + 10 * 1024 * 1024) {
      throw new MiraError('stt_failed', 'Not enough free disk space for the speech model.');
    }
    const partial = `${modelPath()}.partial`;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10 * 60_000)]);
    try {
      const response = await fetch(MODEL.url, { signal });
      if (!response.ok || !response.body) throw new MiraError('stt_failed', 'Could not download speech model.');
      const writer = await fs.open(partial, 'w', 0o600);
      let downloaded = 0;
      try {
        for await (const chunk of response.body) {
          signal.throwIfAborted();
          downloaded += chunk.byteLength;
          if (downloaded > MODEL.sizeBytes) throw new MiraError('stt_failed', 'Unexpected model download size.');
          await writer.writeFile(chunk);
          for (const listener of progressListeners) listener(downloaded, MODEL.sizeBytes);
        }
        await writer.sync();
      } finally { await writer.close(); }
      if (downloaded !== MODEL.sizeBytes || await sha256OfFile(partial) !== MODEL.sha256) {
        throw new MiraError('stt_failed', 'Model integrity check failed. Retry the download.');
      }
      signal.throwIfAborted();
      await fs.rename(partial, modelPath());
      return modelPath();
    } finally { await fs.rm(partial, { force: true }); }
  })().catch((error: unknown) => { modelReady = null; throw error; }).finally(() => {
    if (downloadController === controller) downloadController = null;
  });
  return modelReady;
}

export async function transcribePcm(pcm: Buffer, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  if (!pcm.length) return '';
  const binary = await findWhisperBinary();
  if (!await validModel()) throw new MiraError('stt_failed', 'Download the speech model from the workspace before recording.');
  signal?.throwIfAborted();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-stt-'));
  try {
    const wav = path.join(directory, 'input.wav');
    const output = path.join(directory, 'out');
    await writeInt16PcmAsWav(pcm, wav);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(binary, ['-m', modelPath(), '-f', wav, '-otxt', '-of', output, '-nt', '-l', 'en', '-t', '4'], {
        signal, windowsHide: true, timeout: 120_000,
      });
      let failed = false;
      child.stdout.resume();
      child.stderr.resume();
      child.on('error', () => { failed = true; });
      child.on('close', (code) => {
        if (signal?.aborted) reject(signal.reason);
        else if (!failed && code === 0) resolve();
        else reject(new MiraError('stt_failed', 'Speech processing failed or timed out. Try a shorter recording.'));
      });
    });
    signal?.throwIfAborted();
    return (await fs.readFile(`${output}.txt`, 'utf8')).trim();
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

export async function modelStatus() {
  return {
    present: await validModel(), path: modelPath(), sha256: MODEL.sha256,
    runtimeAvailable: await findWhisperBinary().then(() => true, () => false),
    downloading: downloadController !== null,
  };
}

export async function downloadModel(onProgress?: DownloadProgress): Promise<string> {
  if (onProgress) progressListeners.add(onProgress);
  try { return await ensureModel(); }
  finally { if (onProgress) progressListeners.delete(onProgress); }
}

export function cancelModelDownload(): void { downloadController?.abort(); }
