import { app, clipboard } from 'electron';
import os from 'node:os';
import { handle } from './security';
import { modelStatus } from './stt';

export function registerDiagnostics(): void {
  const report = async () => {
    const model = await modelStatus();
    return {
      schemaVersion: 1,
      appVersion: app.getVersion(),
      packaged: app.isPackaged,
      platform: process.platform,
      architecture: process.arch,
      osRelease: os.release(),
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      logicalProcessors: os.availableParallelism(),
      totalMemoryGiB: Math.round(os.totalmem() / 1024 ** 3),
      mainProcessMemoryMiB: Math.round(process.memoryUsage().rss / 1024 ** 2),
      modelVerified: model.present,
      speechRuntimeAvailable: model.runtimeAvailable,
      modelDownloadActive: model.downloading,
    };
  };
  handle('mira:diagnostics:get', report, ['workspace']);
  handle(
    'mira:diagnostics:copy',
    async () => {
      await clipboard.writeText(JSON.stringify(await report(), null, 2));
    },
    ['workspace'],
  );
}
