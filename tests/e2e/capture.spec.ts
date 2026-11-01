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
    await test.step('explicit setup check releases its temporary stream', async () => {
      await page.getByRole('button', { name: 'Check microphone access', exact: true }).click();
      await expect(page.getByText('Microphone access checked.', { exact: false })).toBeVisible();
    });
    await test.step('open the recorder', async () => {
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
    });
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const next = await window.mira!.studio.state();
          return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
        }),
      )
      .toBeGreaterThan(200);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect
      .poll(async () => page.evaluate(async () => (await window.mira!.studio.state()).phase))
      .toBe('idle');
    await page.getByRole('button', { name: 'Start recording', exact: true }).click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const next = await window.mira!.studio.state();
          return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
        }),
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
          page.evaluate(async () => {
            const next = await window.mira!.studio.state();
            return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
          }),
        )
        .toBeGreaterThan(200);
      const lateState = await page.evaluate(async () =>
        (window as unknown as { completeLateCapture(): Promise<string> }).completeLateCapture(),
      );
      expect(lateState).toBe('ended');
      await expect
        .poll(async () =>
          page.evaluate(async () => {
            const next = await window.mira!.studio.state();
            return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
          }),
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
          page.evaluate(async () => {
            const next = await window.mira!.studio.state();
            return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
          }),
        )
        .toBeGreaterThan(200);
      await overlay.getByRole('button', { name: 'Dismiss overlay' }).click();
      await expect
        .poll(async () => page.evaluate(async () => (await window.mira!.studio.state()).phase))
        .toBe('idle');
    });
    await test.step('device loss and workspace hide cancel capture and release tracks', async () => {
      await page.evaluate(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
          configurable: true,
          value: async (constraints: MediaStreamConstraints) => {
            const stream = await original(constraints);
            Object.assign(window, { syntheticCapture: stream });
            return stream;
          },
        });
      });
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const next = await window.mira!.studio.state();
            return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
          }),
        )
        .toBeGreaterThan(200);
      await page.evaluate(() =>
        (window as unknown as { syntheticCapture: MediaStream }).syntheticCapture
          .getTracks()[0]
          .dispatchEvent(new Event('ended')),
      );
      await expect(page.getByRole('alert')).toContainText('Microphone disconnected');
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as unknown as { syntheticCapture: MediaStream }
              ).syntheticCapture.getTracks()[0].readyState,
          ),
        )
        .toBe('ended');
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const next = await window.mira!.studio.state();
            return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
          }),
        )
        .toBeGreaterThan(200);
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((win) => win.getTitle() === 'Mira')!
          .hide(),
      );
      await expect
        .poll(() => page.evaluate(async () => (await window.mira!.studio.state()).phase))
        .toBe('idle');
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as unknown as { syntheticCapture: MediaStream }
              ).syntheticCapture.getTracks()[0].readyState,
          ),
        )
        .toBe('ended');
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((win) => win.getTitle() === 'Mira')!
          .show(),
      );
    });
    await test.step('an unavailable selected microphone fails safely without silently switching', async () => {
      await page.evaluate(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
          configurable: true,
          value: (constraints: MediaStreamConstraints) => {
            Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
              configurable: true,
              value: original,
            });
            if (
              typeof constraints.audio !== 'object' ||
              (constraints.audio.deviceId as ConstrainDOMStringParameters)?.exact !==
                'synthetic-missing-device'
            )
              throw new Error('Selected device was not requested');
            return Promise.reject(
              new DOMException('Synthetic unavailable device', 'OverconstrainedError'),
            );
          },
        });
      });
      await page.evaluate(async () =>
        window.mira!.settings.update({ microphoneId: 'synthetic-missing-device' }),
      );
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Selected microphone is unavailable');
      await expect
        .poll(() => page.evaluate(async () => (await window.mira!.studio.state()).phase))
        .toBe('idle');
      await page.evaluate(async () => window.mira!.settings.update({ microphoneId: 'default' }));
    });
    await test.step('simulated suspend and destruction of the owning overlay cancel sessions', async () => {
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const next = await window.mira!.studio.state();
            return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
          }),
        )
        .toBeGreaterThan(200);
      await app.evaluate(({ powerMonitor }) => {
        powerMonitor.emit('suspend');
      });
      await expect
        .poll(() => page.evaluate(async () => (await window.mira!.studio.state()).phase))
        .toBe('idle');
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as unknown as { syntheticCapture: MediaStream }
              ).syntheticCapture.getTracks()[0].readyState,
          ),
        )
        .toBe('ended');
      await page.getByRole('button', { name: 'Open compact recorder' }).click();
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const next = await window.mira!.studio.state();
            return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
          }),
        )
        .toBeGreaterThan(200);
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()
          .find((win) => win.getTitle() !== 'Mira')!
          .destroy();
      });
      await expect
        .poll(() => page.evaluate(async () => (await window.mira!.studio.state()).phase))
        .toBe('idle');
    });
    await test.step('a simulated AudioWorklet processor failure stops its tracks', async () => {
      await page.evaluate(() => {
        const Original = window.AudioWorkletNode;
        window.AudioWorkletNode = class extends Original {
          constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
            super(context, name, options);
            Object.assign(window, { syntheticWorklet: this });
          }
        };
      });
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const next = await window.mira!.studio.state();
            return next.phase === 'recording' ? (next.recordingMs ?? 0) : 0;
          }),
        )
        .toBeGreaterThan(200);
      await page.evaluate(() =>
        (
          window as unknown as { syntheticWorklet: AudioWorkletNode }
        ).syntheticWorklet.dispatchEvent(new Event('processorerror')),
      );
      await expect(page.getByRole('alert')).toContainText('Audio processing stopped');
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as unknown as { syntheticCapture: MediaStream }
              ).syntheticCapture.getTracks()[0].readyState,
          ),
        )
        .toBe('ended');
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
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
