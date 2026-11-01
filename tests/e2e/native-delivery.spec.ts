import { test, expect, _electron as electron } from '@playwright/test';
import { build } from 'esbuild';
import type { Destination } from '../../src/types/studio';
import type { RouteResult } from '../../src/main/dev-tool-router';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

test('Windows native adapter pastes only into an owned disposable fixture', async () => {
  test.setTimeout(60_000);
  if (process.platform !== 'win32' || process.env.MIRA_NATIVE_TEST !== '1')
    throw new Error(
      'Use npm run test:native on Windows. This is not a simulated destination test.',
    );
  const root = await mkdtemp(path.join(os.tmpdir(), 'mira-native-fixture-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const target = await electron.launch({
    args: [
      path.resolve('tests/fixtures/paste-target.cjs'),
      `--user-data-dir=${path.join(root, 'target')}`,
    ],
    env,
  });
  const harness = path.join(root, 'source.cjs');
  await build({
    stdin: {
      contents: `import { app, BrowserWindow } from 'electron';
    import { routeDevPrompt } from './src/main/dev-tool-router.ts';
    app.miraNativeRoute = routeDevPrompt;
    app.whenReady().then(() => { const win = new BrowserWindow({width:400,height:160}); win.loadURL('data:text/html,Mira disposable native source'); });
    app.on('window-all-closed',()=>app.quit());`,
      resolveDir: process.cwd(),
    },
    outfile: harness,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
  });
  const source = await electron.launch({
    args: [harness, `--user-data-dir=${path.join(root, 'source')}`],
    env: { ...env, NODE_ENV: 'production' },
  });
  let targetClosed = false;
  try {
    const targetPage = await target.firstWindow();
    await targetPage.getByLabel('Controlled paste target').focus();
    const destination = await target.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].show();
      BrowserWindow.getAllWindows()[0].focus();
      const buffer = BrowserWindow.getAllWindows()[0].getNativeWindowHandle();
      return {
        name: 'Code',
        bundleId: null,
        processId: process.pid,
        windowId: (buffer.length === 8
          ? buffer.readBigUInt64LE()
          : BigInt(buffer.readUInt32LE())
        ).toString(),
      };
    });
    const result = await source.evaluate(
      async ({ app }, value) => {
        return (
          app as unknown as {
            miraNativeRoute(
              prompt: string,
              opts: { destination: Destination },
            ): Promise<RouteResult>;
          }
        ).miraNativeRoute('Synthetic Mira native paste fixture. Do not execute anything.', {
          destination: value.destination,
        });
      },
      { destination },
    );
    expect(result.autoSent).toBe(false);
    await expect(targetPage.getByLabel('Controlled paste target')).toHaveValue(
      'Synthetic Mira native paste fixture. Do not execute anything.',
    );
    await target.close();
    targetClosed = true;
    const rejected = await source.evaluate(
      async ({ app }, value) => {
        try {
          await (
            app as unknown as {
              miraNativeRoute(
                prompt: string,
                opts: { destination: Destination },
              ): Promise<RouteResult>;
            }
          ).miraNativeRoute('Never paste into another window.', {
            destination: value.destination,
          });
          return false;
        } catch (error) {
          return error instanceof Error ? error.message : 'unknown';
        }
      },
      { destination },
    );
    expect(rejected).toContain('destination window closed');
    await mkdir('test-results', { recursive: true });
    await writeFile(
      'test-results/native-delivery.json',
      JSON.stringify(
        {
          schemaVersion: 1,
          commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          platform: process.platform,
          architecture: process.arch,
          osRelease: os.release(),
          syntheticTextReceived: true,
          closedTargetRejected: true,
          autoSent: result.autoSent,
          limitations: [
            'Disposable Electron target with explicit fixture focus and synthetic app classification; not a real VS Code certification.',
            'Controlled target receipt was inspected; production native paste remains attempted, not acknowledged.',
          ],
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    if (!targetClosed) await target.close();
    await source.close();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
