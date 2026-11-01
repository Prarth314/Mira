import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProviderName } from '../types/provider';
import { atomicWrite, serialQueue } from './atomic-file';
import { providerName, record } from './validation';
import { MiraError } from '../types/MiraError';
import { text } from './validation';

export type Settings = {
  defaultProvider: ProviderName;
  autoSend: boolean;
  showAdvancedProviders: boolean;
  microphoneId: string;
};

const DEFAULTS: Settings = {
  defaultProvider: 'anthropic',
  autoSend: false,
  showAdvancedProviders: false,
  microphoneId: 'default',
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
    else if (key === 'microphoneId') {
      const id = text(input[key], 'Microphone selection', 256);
      if (
        [...id].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      )
        throw new MiraError('action_invalid', 'Invalid microphone selection');
      result.microphoneId = id;
    } else if (key === 'autoSend' || key === 'showAdvancedProviders') {
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
    const document = record(JSON.parse(raw));
    if ('version' in document && document.version !== 1) {
      throw new MiraError(
        'action_invalid',
        'Preferences were written by an unsupported version. Update Mira or reset preferences.',
      );
    }
    const parsed = validateSettings('version' in document ? document.settings : document);
    cached = { ...DEFAULTS, ...parsed };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') cached = { ...DEFAULTS };
    else
      throw new MiraError(
        'action_invalid',
        'Preferences could not be read. Reset preferences to recover; provider keys are kept separately.',
        error,
      );
  }
  return { ...cached };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const validated = validateSettings(patch);
  return enqueue(async () => {
    const current = await getSettings();
    const next = { ...current, ...validated };
    await atomicWrite(settingsPath(), JSON.stringify({ version: 1, settings: next }, null, 2));
    cached = next;
    return { ...next };
  });
}

export async function resetPreferences(): Promise<Settings> {
  return enqueue(async () => {
    const file = settingsPath();
    try {
      await fs.copyFile(file, `${file}.${Date.now()}.backup`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const defaults = { ...DEFAULTS };
    await atomicWrite(file, JSON.stringify({ version: 1, settings: defaults }, null, 2));
    cached = defaults;
    return { ...defaults };
  });
}

export function resetSettingsCache(): void {
  cached = null;
}
