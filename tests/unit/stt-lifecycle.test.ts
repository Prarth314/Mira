import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const state = vi.hoisted(() => ({
  directory: '',
  model: {
    name: 'synthetic-model.bin',
    sizeBytes: 16,
    sha256: '',
    url: 'https://synthetic.invalid/model',
  },
  run: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => state.directory, getAppPath: () => state.directory, isPackaged: false },
}));
vi.mock('../../src/main/model-info', () => ({ MODEL: state.model }));
vi.mock('../../src/main/speech-process', () => ({ runSpeechProcess: state.run }));
const bytes = Buffer.from('synthetic model!');
beforeEach(async () => {
  vi.resetModules();
  state.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-stt-lifecycle-'));
  state.model.sizeBytes = bytes.length;
  state.model.sha256 = createHash('sha256').update(bytes).digest('hex');
  state.run.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(bytes)),
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(state.directory, { recursive: true, force: true });
});

describe('actual STT storage and model lifecycle with synthetic transport', () => {
  it('cleans only owned abandoned download files after abrupt exit', async () => {
    const stt = await import('../../src/main/stt');
    const directory = path.join(state.directory, 'models');
    await fs.mkdir(directory);
    const owned = `${state.model.name}.12345678-1234-1234-1234-123456789abc.partial`;
    await fs.writeFile(path.join(directory, owned), 'partial');
    await fs.writeFile(path.join(directory, 'keep.partial'), 'unrelated');
    await stt.cleanupModelDownloads();
    expect(await fs.readdir(directory)).toEqual(['keep.partial']);
  });
  it('repairs a model deleted after a prior successful download', async () => {
    const stt = await import('../../src/main/stt');
    const model = await stt.downloadModel();
    await fs.rm(model);
    await stt.downloadModel();
    expect(await fs.readFile(model)).toEqual(bytes);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects short, oversized and corrupt transfers and removes partial data', async () => {
    const stt = await import('../../src/main/stt');
    for (const data of [Buffer.from('short'), Buffer.alloc(100), Buffer.alloc(bytes.length)]) {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(data));
      await expect(stt.downloadModel()).rejects.toThrow();
      expect(await fs.readdir(path.join(state.directory, 'models'))).toEqual([]);
    }
  });
  it('cancels an interrupted stream and permits retry', async () => {
    const stt = await import('../../src/main/stt');
    vi.mocked(fetch).mockImplementationOnce(
      async (_url, options) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(bytes.subarray(0, 3));
              options?.signal?.addEventListener(
                'abort',
                () => controller.error(new Error('cancelled')),
                { once: true },
              );
            },
          }),
        ),
    );
    const work = stt.downloadModel(() => stt.cancelModelDownload());
    await expect(work).rejects.toThrow();
    expect(await fs.readdir(path.join(state.directory, 'models'))).toEqual([]);
    await expect(stt.downloadModel()).resolves.toBeDefined();
  });
  it.each(['success', 'failure', 'cancel'])('cleans temporary audio after %s', async (outcome) => {
    const runtime = path.join(state.directory, 'vendor', 'whisper', 'runtime');
    await fs.mkdir(runtime, { recursive: true });
    const binary = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    await fs.writeFile(path.join(runtime, binary), 'synthetic-binary');
    await fs.writeFile(
      path.join(runtime, 'manifest.json'),
      JSON.stringify({
        platform: process.platform,
        arch: process.arch,
        files: { [binary]: createHash('sha256').update('synthetic-binary').digest('hex') },
      }),
    );
    const stt = await import('../../src/main/stt');
    await stt.downloadModel();
    const controller = new AbortController();
    state.run.mockImplementation(async (_binary: string, args: string[]) => {
      const output = args[args.indexOf('-of') + 1];
      if (outcome === 'cancel') {
        controller.abort(new Error('Cancelled'));
        throw controller.signal.reason;
      }
      if (outcome === 'failure') throw new Error('synthetic failure');
      await fs.writeFile(`${output}.txt`, 'synthetic transcript');
    });
    const work = stt.transcribePcm(Buffer.alloc(320), controller.signal);
    if (outcome === 'success') expect(await work).toBe('synthetic transcript');
    else await expect(work).rejects.toThrow();
    expect(await fs.readdir(path.join(state.directory, 'speech-scratch'))).toEqual([]);
  });
});
