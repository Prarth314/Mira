import { BrowserWindow } from 'electron';
import { handle } from './security';
import { record, text, providerName } from './validation';
import { getKey, setKey, status } from './keystore';
import { getSettings, updateSettings } from './settings';
import { downloadModel, modelStatus, cancelModelDownload } from './stt';
import { probePermissions, requestMicrophone, openSettingsForMicrophone } from './permissions';
import { registerStudio } from './studio';
import { hideOverlay } from './overlay-window';

export function registerIpc(): void {
  registerStudio();
  handle('mira:overlay:hide', () => { hideOverlay(); return { ok: true }; });
  handle('mira:keys:status', () => status());
  handle('mira:keys:save', async (_event, payload: unknown) => {
    const value = record(payload);
    try {
      await setKey(providerName(value.provider), text(value.key, 'API key', 4096, true));
      return { ok: true };
    } catch { return { ok: false, error: { kind: 'permission_denied', message: 'Could not save key in OS secure storage.' } }; }
  });
  handle('mira:provider:get', async () => ({ name: (await getSettings()).defaultProvider }));
  handle('mira:provider:set', async (_event, payload: unknown) => {
    const name = providerName(record(payload).name);
    await updateSettings({ defaultProvider: name });
    return { ok: true };
  });
  handle('mira:settings:get', () => getSettings());
  handle('mira:settings:update', (_event, payload: unknown) => updateSettings(record(payload)));
  handle('mira:permissions:probe', () => probePermissions());
  handle('mira:permissions:requestMic', async () => ({ granted: await requestMicrophone() }));
  handle('mira:permissions:openSettings', (_event, payload: unknown) => {
    if (record(payload).what !== 'mic') throw new Error('Screen capture is not enabled in this release.');
    openSettingsForMicrophone();
    return { ok: true };
  });
  handle('mira:model:status', async () => ({ ...await modelStatus(), keyConfigured: !!await getKey((await getSettings()).defaultProvider) }));
  handle('mira:model:cancel', () => { cancelModelDownload(); return { ok: true }; }, ['workspace']);
  handle('mira:model:download', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
      const modelPath = await downloadModel((downloaded, total) => {
        win?.webContents.send('mira:model:progress', { downloaded, total });
      });
      return { ok: true, path: modelPath };
    } catch { return { ok: false, error: { kind: 'stt_failed', message: 'Model download failed. Check your connection and available disk space, then retry.' } }; }
  });
}
