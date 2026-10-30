import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('AudioWorklet captures fake microphone audio and cancellation permits another recording', async () => {
  test.setTimeout(60_000);
  const profile = await mkdtemp(path.join(os.tmpdir(), 'mira-capture-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.MIRA_TEST_EXECUTABLE;
  const app = await electron.launch({
    executablePath,
    args: [
      ...(executablePath ? [] : ['.']),
      `--user-data-dir=${profile}`,
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
    env: { ...env, NODE_ENV: 'production' },
  });
  try {
    const page = await app.firstWindow();
    await test.step('open the recorder', async () => {
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
    });
    await expect
      .poll(async () =>
        page.evaluate(async () => (await window.mira!.studio.state()).recordingMs ?? 0),
      )
      .toBeGreaterThan(200);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect
      .poll(async () => page.evaluate(async () => (await window.mira!.studio.state()).phase))
      .toBe('idle');
    await page.getByRole('button', { name: 'Start recording', exact: true }).click();
    await expect
      .poll(async () =>
        page.evaluate(async () => (await window.mira!.studio.state()).recordingMs ?? 0),
      )
      .toBeGreaterThan(200);
    await page.getByRole('button', { name: 'Finish recording', exact: true }).click();
    await expect
      .poll(async () => page.evaluate(async () => (await window.mira!.studio.state()).phase))
      .toBe('idle');
    await expect(page.getByRole('alert')).toContainText(/speech model|runtime unavailable/i);
    await expect(page.getByRole('button', { name: 'Start recording', exact: true })).toBeEnabled();
  } finally {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        app.close(),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            if (app.process().exitCode === null) app.process().kill();
            resolve();
          }, 5000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    await rm(profile, { recursive: true, force: true });
  }
});
