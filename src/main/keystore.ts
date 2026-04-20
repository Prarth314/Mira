import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProviderName } from '../types/provider';
import { MiraError } from '../types/MiraError';

type KeystoreFile = Partial<Record<ProviderName, string>>;

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
  if (!safeStorage.isEncryptionAvailable()) {
    throw new MiraError(
      'permission_denied',
      'OS keychain (safeStorage) not available; cannot decrypt API keys',
    );
  }
  const json = safeStorage.decryptString(enc);
  try {
    return JSON.parse(json) as KeystoreFile;
  } catch {
    return {};
  }
}

async function writeAll(data: KeystoreFile): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new MiraError(
      'permission_denied',
      'OS keychain (safeStorage) not available; cannot encrypt API keys',
    );
  }
  const enc = safeStorage.encryptString(JSON.stringify(data));
  await fs.mkdir(path.dirname(keystorePath()), { recursive: true });
  await fs.writeFile(keystorePath(), enc);
}

export async function getKey(provider: ProviderName): Promise<string | null> {
  const all = await loadAll();
  return all[provider] ?? null;
}

export async function setKey(provider: ProviderName, value: string): Promise<void> {
  const trimmed = value.trim();
  const all = await loadAll();
  if (trimmed) all[provider] = trimmed;
  else delete all[provider];
  await writeAll(all);
}

export async function status(): Promise<Record<ProviderName, boolean>> {
  const all = await loadAll();
  return {
    anthropic: Boolean(all.anthropic),
    openai: Boolean(all.openai),
  };
}
