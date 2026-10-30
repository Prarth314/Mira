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
    await page.waitForFunction(() => !!window.mira);
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
    await test.step('cancel a pending microphone request without disrupting a later recording', async () => {
      await page.evaluate(() => {
        const devices = navigator.mediaDevices;
        const original = devices.getUserMedia.bind(devices);
        let complete: (stream: MediaStream) => void;
        const pending = new Promise<MediaStream>((resolve) => {
          complete = resolve;
        });
        Object.defineProperty(devices, 'getUserMedia', {
          configurable: true,
          value: () => {
            Object.defineProperty(devices, 'getUserMedia', { configurable: true, value: original });
            return pending;
          },
        });
        Object.assign(window, {
          completeLateCapture: async () => {
            const stream = await original({ audio: true });
            complete(stream);
            await new Promise((resolve) => setTimeout(resolve, 0));
            return stream.getTracks()[0].readyState;
          },
        });
      });
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
      await expect
        .poll(async () =>
          page.evaluate(async () => (await window.mira!.studio.state()).recordingMs ?? 0),
        )
        .toBeGreaterThan(200);
      const lateState = await page.evaluate(async () =>
        (window as unknown as { completeLateCapture(): Promise<string> }).completeLateCapture(),
      );
      expect(lateState).toBe('ended');
      await expect
        .poll(async () =>
          page.evaluate(async () => (await window.mira!.studio.state()).recordingMs ?? 0),
        )
        .toBeGreaterThan(400);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    });
    await test.step('first compact-recorder invocation records after the renderer handshake', async () => {
      const opened = app.waitForEvent('window');
      await page.getByRole('button', { name: 'Open compact recorder' }).click();
      const overlay = await opened;
      await expect
        .poll(async () => page.evaluate(async () => (await window.mira!.studio.state()).phase))
        .toBe('recording');
      await expect
        .poll(async () =>
          page.evaluate(async () => (await window.mira!.studio.state()).recordingMs ?? 0),
        )
        .toBeGreaterThan(200);
      await overlay.getByRole('button', { name: 'Dismiss overlay' }).click();
      await expect
        .poll(async () => page.evaluate(async () => (await window.mira!.studio.state()).phase))
        .toBe('idle');
    });
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
