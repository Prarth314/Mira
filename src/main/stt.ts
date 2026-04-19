import { app } from 'electron';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { MiraError } from '../types/MiraError';
import { writeInt16PcmAsWav } from './wav';

type ModelInfo = {
  name: string;
  url: string;
  sha256: string;
  sizeBytes: number;
};

const DEFAULT_MODEL: ModelInfo = {
  name: 'ggml-base.en.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  sizeBytes: 147951465,
};

let cachedBinary: string | null = null;
let modelReady: Promise<string> | null = null;

function modelDir(): string {
  return path.join(app.getPath('userData'), 'models');
}

function modelPath(): string {
  return path.join(modelDir(), DEFAULT_MODEL.name);
}

async function findWhisperBinary(): Promise<string> {
  if (cachedBinary) return cachedBinary;
  // Try PATH (e.g. brew install whisper-cpp installs `whisper-cli`)
  const candidates = ['whisper-cli', 'whisper-cpp', 'main'];
  for (const name of candidates) {
    const found = await which(name);
    if (found) {
      cachedBinary = found;
      return found;
    }
  }
  // Phase 5 will bundle a binary in vendor/whisper/
  const bundled = path.join(app.getAppPath(), 'vendor', 'whisper', 'whisper-cli');
  try {
    await fs.access(bundled, fs.constants.X_OK);
    cachedBinary = bundled;
    return bundled;
  } catch {
    throw new MiraError(
      'stt_failed',
      'whisper-cli not found. Install with: brew install whisper-cpp',
    );
  }
}

async function which(cmd: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn('/usr/bin/which', [cmd]);
    let out = '';
    child.stdout.on('data', (b: Buffer) => (out += b.toString()));
    child.on('close', (code) => resolve(code === 0 ? out.trim() : null));
    child.on('error', () => resolve(null));
  });
}

async function sha256OfFile(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return createHash('sha256').update(buf).digest('hex');
}

export type DownloadProgress = (downloaded: number, total: number) => void;

async function ensureModel(onProgress?: DownloadProgress): Promise<string> {
  if (modelReady) return modelReady;
  modelReady = (async () => {
    const target = modelPath();
    try {
      await fs.access(target);
      const got = await sha256OfFile(target);
      if (got === DEFAULT_MODEL.sha256) return target;
      // Mismatched checksum → re-download
      await fs.unlink(target);
    } catch {
      // not present
    }
    await fs.mkdir(modelDir(), { recursive: true });
    const tmp = `${target}.partial`;
    const res = await fetch(DEFAULT_MODEL.url);
    if (!res.ok || !res.body) {
      throw new MiraError('stt_failed', `model download failed: HTTP ${res.status}`);
    }
    const total = Number(res.headers.get('content-length') ?? DEFAULT_MODEL.sizeBytes);
    const reader = res.body.getReader();
    const writer = await fs.open(tmp, 'w');
    let downloaded = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
        downloaded += value.byteLength;
        onProgress?.(downloaded, total);
      }
    } finally {
      await writer.close();
    }
    const got = await sha256OfFile(tmp);
    if (got !== DEFAULT_MODEL.sha256) {
      await fs.unlink(tmp);
      throw new MiraError(
        'stt_failed',
        `model checksum mismatch (expected ${DEFAULT_MODEL.sha256}, got ${got})`,
      );
    }
    await fs.rename(tmp, target);
    return target;
  })().catch((e) => {
    modelReady = null;
    throw e;
  });
  return modelReady;
}

export async function transcribePcm(pcm: Buffer): Promise<string> {
  if (pcm.length === 0) return '';
  const binary = await findWhisperBinary();
  const model = await ensureModel();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-stt-'));
  const wavPath = path.join(tmpDir, 'input.wav');
  const outBase = path.join(tmpDir, 'out');
  try {
    await writeInt16PcmAsWav(pcm, wavPath);
    await runWhisper(binary, ['-m', model, '-f', wavPath, '-otxt', '-of', outBase, '-nt']);
    const text = await fs.readFile(`${outBase}.txt`, 'utf8');
    return text.trim();
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function runWhisper(binary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args);
    let stderr = '';
    child.stderr.on('data', (b: Buffer) => (stderr += b.toString()));
    child.on('error', (e) => reject(new MiraError('stt_failed', `whisper spawn: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new MiraError('stt_failed', `whisper exited ${code}: ${stderr.trim().slice(0, 400)}`));
    });
  });
}

export async function modelStatus(): Promise<{ present: boolean; path: string; sha256: string }> {
  return { present: await fileExists(modelPath()), path: modelPath(), sha256: DEFAULT_MODEL.sha256 };
}

export async function downloadModel(onProgress?: DownloadProgress): Promise<string> {
  return ensureModel(onProgress);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
