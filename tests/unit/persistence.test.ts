import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { atomicWrite, serialQueue } from '../../src/main/atomic-file';

const state = vi.hoisted(() => ({ directory: '' }));
vi.mock('electron', () => ({ app: { getPath: () => state.directory } }));
import { getSettings, updateSettings, resetSettingsCache, validateSettings } from '../../src/main/settings';

beforeEach(async () => {
  state.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-settings-'));
  resetSettingsCache();
});
afterEach(async () => { await fs.rm(state.directory, { recursive: true, force: true }); });

describe('durable settings', () => {
  it('serializes concurrent updates and persists them across cache resets', async () => {
    await Promise.all([
      updateSettings({ defaultProvider: 'openai' }),
      updateSettings({ autoSend: true }),
    ]);
    resetSettingsCache();
    expect(await getSettings()).toMatchObject({ defaultProvider: 'openai', autoSend: true });
  });
  it('does not expose mutable cached state', async () => {
    const first = await getSettings();
    first.autoSend = true;
    expect((await getSettings()).autoSend).toBe(false);
  });
  it('rejects unknown fields, invalid types and prototype-like properties', () => {
    expect(() => validateSettings({ autoSend: 'true' })).toThrow();
    expect(() => validateSettings({ defaultProvider: 'other' })).toThrow();
    expect(() => validateSettings(JSON.parse('{"__proto__":{}}'))).toThrow();
  });
  it('does not poison the queue after a failed operation', async () => {
    const enqueue = serialQueue();
    await expect(enqueue(async () => { throw new Error('disk full'); })).rejects.toThrow();
    expect(await enqueue(async () => 42)).toBe(42);
  });
  it('replaces files without leaving partial contents or temporary files', async () => {
    const target = path.join(state.directory, 'atomic.json');
    await atomicWrite(target, 'old');
    await atomicWrite(target, 'new');
    expect(await fs.readFile(target, 'utf8')).toBe('new');
    expect(await fs.readdir(state.directory)).toEqual(['atomic.json']);
  });
});
