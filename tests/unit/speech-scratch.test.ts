import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SpeechScratch } from '../../src/main/speech-scratch';

let profile: string;
beforeEach(async () => {
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-scratch-test-'));
});
afterEach(async () => {
  await fs.rm(profile, { recursive: true, force: true });
});

describe('temporary speech retention', () => {
  it('cleans abandoned speech directories without touching unrelated profile files', async () => {
    const scratch = new SpeechScratch(profile);
    const abandoned = await scratch.create();
    await fs.writeFile(path.join(abandoned, 'input.wav'), 'synthetic audio');
    await fs.writeFile(path.join(profile, 'keep.txt'), 'keep');
    await scratch.cleanup();
    await expect(fs.access(abandoned)).rejects.toThrow();
    expect(await fs.readFile(path.join(profile, 'keep.txt'), 'utf8')).toBe('keep');
  });
  it('refuses deletion outside its dedicated root', async () => {
    const scratch = new SpeechScratch(profile);
    await expect(scratch.remove(profile)).rejects.toThrow();
    await expect(
      scratch.remove(path.join(profile, 'speech-scratch', '..', 'keep')),
    ).rejects.toThrow();
  });
  it('rejects scratch roots redirected outside the application profile', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-scratch-outside-'));
    try {
      await fs.symlink(
        outside,
        path.join(profile, 'speech-scratch'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      await expect(new SpeechScratch(profile).create()).rejects.toThrow();
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});
