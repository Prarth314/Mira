import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProviderName } from '../types/provider';

export type Settings = {
  defaultProvider: ProviderName;
  autoSend: boolean;
  showAdvancedProviders: boolean;
};

const DEFAULTS: Settings = {
  defaultProvider: 'anthropic',
  autoSend: false,
  showAdvancedProviders: false,
};

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

let cached: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<Settings>;
    cached = { ...DEFAULTS, ...parsed };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  cached = next;
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2));
  return next;
}

export function resetSettingsCache(): void {
  cached = null;
}
