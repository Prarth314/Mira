import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProviderName } from '../types/provider';
import { atomicWrite, serialQueue } from './atomic-file';
import { providerName, record } from './validation';
import { MiraError } from '../types/MiraError';

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
const enqueue = serialQueue();

export function validateSettings(value: unknown): Partial<Settings> {
  const input = record(value);
  const result: Partial<Settings> = {};
  for (const key of Object.keys(input)) {
    if (key === 'defaultProvider') result.defaultProvider = providerName(input[key]);
    else if (key === 'autoSend' || key === 'showAdvancedProviders') {
      if (typeof input[key] !== 'boolean') throw new MiraError('action_invalid', `Invalid ${key}`);
      result[key] = input[key];
    } else throw new MiraError('action_invalid', `Unknown setting: ${key}`);
  }
  return result;
}

export async function getSettings(): Promise<Settings> {
  if (cached) return { ...cached };
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');
    const parsed = validateSettings(JSON.parse(raw));
    cached = { ...DEFAULTS, ...parsed };
  } catch {
    cached = { ...DEFAULTS };
  }
  return { ...cached };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const validated = validateSettings(patch);
  return enqueue(async () => {
    const current = await getSettings();
    const next = { ...current, ...validated };
    await atomicWrite(settingsPath(), JSON.stringify(next, null, 2));
    cached = next;
    return { ...next };
  });
}

export function resetSettingsCache(): void {
  cached = null;
}
