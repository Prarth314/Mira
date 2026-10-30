import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const mock = vi.hoisted(() => ({ directory: '', available: true }));
vi.mock('electron', () => ({
  app: { getPath: () => mock.directory },
  safeStorage: {
    isEncryptionAvailable: () => mock.available,
    getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}));
import { setKey, getKey, status } from '../../src/main/keystore';

beforeEach(async () => {
  mock.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-keystore-'));
  mock.available = true;
});
afterEach(async () => {
  await fs.rm(mock.directory, { recursive: true, force: true });
});

describe('secure-storage persistence contract', () => {
  it('serializes updates and removes only the selected provider key', async () => {
    await Promise.all([setKey('anthropic', 'synthetic-a'), setKey('openai', 'synthetic-b')]);
    expect(await status()).toEqual({ anthropic: true, openai: true });
    await setKey('anthropic', '');
    expect(await getKey('anthropic')).toBeNull();
    expect(await getKey('openai')).toBe('synthetic-b');
  });
  it('does not overwrite malformed encrypted-store contents', async () => {
    const file = path.join(mock.directory, 'keys.enc');
    await fs.writeFile(file, 'malformed');
    await expect(setKey('openai', 'synthetic-b')).rejects.toThrow();
    expect(await fs.readFile(file, 'utf8')).toBe('malformed');
  });
  it('fails closed when OS secure storage becomes unavailable', async () => {
    await setKey('openai', 'synthetic');
    const file = path.join(mock.directory, 'keys.enc');
    const before = await fs.readFile(file);
    mock.available = false;
    await expect(setKey('openai', 'replacement')).rejects.toThrow();
    expect(await fs.readFile(file)).toEqual(before);
  });
});
