import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('production build opens with an isolated preload and settings bridge', async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'mira-e2e-'));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, NODE_ENV: 'production' }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
    const bridge = await page.evaluate(async () => ({
      keys: await window.mira?.keys.status(),
      settings: await window.mira?.settings.get(),
      node: typeof (globalThis as Record<string, unknown>).require,
    }));
    expect(bridge.keys).toEqual({ anthropic: false, openai: false });
    expect(bridge.settings?.defaultProvider).toBe('anthropic');
    expect(bridge.node).toBe('undefined');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
