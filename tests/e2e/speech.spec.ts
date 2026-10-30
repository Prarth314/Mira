import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('bundled Whisper transcribes official sample through owned IPC', async () => {
  test.skip(process.env.MIRA_SPEECH_TEST !== '1', 'Opt-in: downloads the pinned 148 MB model.');
  test.setTimeout(180_000);
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-speech-test-'));
  const sample = await fs.readFile('vendor/whisper/whisper.cpp-306c88f4d1286aec1bf96e544632897886af5501/samples/jfk.wav');
  let offset = 12;
  let pcm: Buffer | undefined;
  while (offset + 8 <= sample.length) {
    const length = sample.readUInt32LE(offset + 4);
    if (sample.toString('ascii', offset, offset + 4) === 'data') {
      pcm = sample.subarray(offset + 8, offset + 8 + length);
      break;
    }
    offset += 8 + length + (length % 2);
  }
  expect(pcm).toBeDefined();
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env: { ...env, NODE_ENV: 'production' } });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.mira);
    const result = await page.evaluate(async () => window.mira!.model.download());
    expect(result.ok).toBe(true);
    const id = await page.evaluate(async () => (await window.mira!.studio.start('dictate')).id);
    for (let i = 0; i < pcm!.length; i += 8192) {
      await page.evaluate(async ({ id, bytes }) => {
        await window.mira!.studio.chunk(id, new Uint8Array(bytes).buffer);
      }, { id, bytes: [...pcm!.subarray(i, i + 8192)] });
    }
    await page.evaluate(async (id) => window.mira!.studio.finish(id), id);
    const state = await page.evaluate(async () => window.mira!.studio.state());
    expect(state.error).toBeNull();
    expect(state.draft?.original.toLowerCase()).toContain('ask not what your country');
    expect(state.draft?.delivery).toBe('prepared');
    expect(state.phase).toBe('idle');
  } finally {
    await app.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
