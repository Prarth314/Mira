import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('real app restarts preserve migrated settings and explicitly recover a future document', async () => {
  test.setTimeout(60_000);
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-recovery-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () =>
    electron.launch({
      executablePath: process.env.MIRA_TEST_EXECUTABLE,
      args: [...(process.env.MIRA_TEST_EXECUTABLE ? [] : ['.']), `--user-data-dir=${profile}`],
      env: { ...env, NODE_ENV: 'production' },
    });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    await fs.writeFile(
      path.join(profile, 'settings.json'),
      JSON.stringify({ defaultProvider: 'openai' }),
    );
    app = await launch();
    let page = await app.firstWindow();
    await page.waitForFunction(() => !!window.mira);
    expect((await page.evaluate(async () => window.mira!.settings.get())).microphoneId).toBe(
      'default',
    );
    await page.evaluate(async () =>
      window.mira!.settings.update({ microphoneId: 'synthetic-selected-device' }),
    );
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.waitForFunction(() => !!window.mira);
    expect((await page.evaluate(async () => window.mira!.settings.get())).microphoneId).toBe(
      'synthetic-selected-device',
    );
    expect(JSON.parse(await fs.readFile(path.join(profile, 'settings.json'), 'utf8')).version).toBe(
      1,
    );
    await app.close();
    app = undefined;
    const future = JSON.stringify({ version: 99, settings: {} });
    await fs.writeFile(path.join(profile, 'settings.json'), future);
    app = await launch();
    page = await app.firstWindow();
    await page
      .getByLabel('Prefer to type?')
      .fill('Synthetic local instruction despite corrupt preferences.');
    await page.getByRole('button', { name: 'Prepare instruction', exact: true }).click();
    await expect(page.getByLabel('Prepared prompt')).toHaveValue(
      'Synthetic local instruction despite corrupt preferences.',
    );
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByText('Recovery & diagnostics').click();
    await page.getByRole('button', { name: 'Reset preferences', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Preferences reset.' })).toBeVisible();
    expect((await page.evaluate(async () => window.mira!.settings.get())).microphoneId).toBe(
      'default',
    );
    const backups = (await fs.readdir(profile)).filter((name) => name.endsWith('.backup'));
    expect(backups).toHaveLength(1);
    expect(await fs.readFile(path.join(profile, backups[0]), 'utf8')).toBe(future);
  } finally {
    if (app) await app.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
