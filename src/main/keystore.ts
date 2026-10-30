import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProviderName } from '../types/provider';
import { MiraError } from '../types/MiraError';
import { atomicWrite, serialQueue } from './atomic-file';
import { providerName, text, record } from './validation';

type KeystoreFile = Partial<Record<ProviderName, string>>;
const enqueue = serialQueue();

function requireSecureStorage(): void {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
  ) {
    throw new MiraError(
      'permission_denied',
      'OS-backed secure storage is not available. Dictation remains usable without keys.',
    );
  }
}

function keystorePath(): string {
  return path.join(app.getPath('userData'), 'keys.enc');
}

async function readEncrypted(): Promise<Buffer | null> {
  try {
    return await fs.readFile(keystorePath());
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

async function loadAll(): Promise<KeystoreFile> {
  const enc = await readEncrypted();
  if (!enc) return {};
  requireSecureStorage();
  const json = safeStorage.decryptString(enc);
  try {
    const input = record(JSON.parse(json));
    const output: KeystoreFile = {};
    for (const [name, key] of Object.entries(input))
      output[providerName(name)] = text(key, 'Stored key', 4096);
    return output;
  } catch {
    throw new MiraError(
      'permission_denied',
      'Stored keys could not be read. Existing encrypted data was preserved.',
    );
  }
}

async function writeAll(data: KeystoreFile): Promise<void> {
  requireSecureStorage();
  const enc = safeStorage.encryptString(JSON.stringify(data));
  await atomicWrite(keystorePath(), enc);
}

export async function getKey(provider: ProviderName): Promise<string | null> {
  const all = await loadAll();
  return all[provider] ?? null;
}

export async function setKey(provider: ProviderName, value: string): Promise<void> {
  providerName(provider);
  const trimmed = text(value, 'API key', 4096, true).trim();
  return enqueue(async () => {
    const all = await loadAll();
    if (trimmed) all[provider] = trimmed;
    else delete all[provider];
    await writeAll(all);
  });
}

export async function status(): Promise<Record<ProviderName, boolean>> {
  const all = await loadAll();
  return {
    anthropic: Boolean(all.anthropic),
    openai: Boolean(all.openai),
  };
}
