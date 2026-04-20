import { systemPreferences, desktopCapturer, shell } from 'electron';

export type PermissionState = 'granted' | 'denied' | 'unknown' | 'restricted' | 'not-determined';

export type PermissionsReport = {
  microphone: PermissionState;
  screen: PermissionState;
  platform: NodeJS.Platform;
};

export async function probePermissions(): Promise<PermissionsReport> {
  if (process.platform !== 'darwin') {
    return { microphone: 'granted', screen: 'granted', platform: process.platform };
  }
  const mic = (systemPreferences.getMediaAccessStatus('microphone') ?? 'unknown') as PermissionState;
  // Screen recording: probe by attempting to enumerate sources. Empty list = denied/not-granted.
  let screen: PermissionState = 'unknown';
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
    screen = sources.length > 0 ? 'granted' : 'denied';
  } catch {
    screen = 'denied';
  }
  return { microphone: mic, screen, platform: process.platform };
}

export async function requestMicrophone(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;
  try {
    return await systemPreferences.askForMediaAccess('microphone');
  } catch {
    return false;
  }
}

export function openSettingsForMicrophone(): void {
  void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
}

export function openSettingsForScreen(): void {
  void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
}
