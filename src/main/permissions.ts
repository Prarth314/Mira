import { systemPreferences, shell } from 'electron';
export type PermissionState = 'granted' | 'denied' | 'unknown' | 'restricted' | 'not-determined';
export type PermissionsReport = { microphone: PermissionState; screen: PermissionState; platform: NodeJS.Platform };
export async function probePermissions(): Promise<PermissionsReport> {
  const microphone = process.platform === 'darwin' || process.platform === 'win32'
    ? systemPreferences.getMediaAccessStatus('microphone') as PermissionState : 'unknown';
  return { microphone, screen: 'restricted', platform: process.platform };
}
export async function requestMicrophone(): Promise<boolean> {
  return process.platform === 'darwin' ? systemPreferences.askForMediaAccess('microphone') : false;
}
export function openSettingsForMicrophone(): void {
  if (process.platform === 'darwin') void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
  else if (process.platform === 'win32') void shell.openExternal('ms-settings:privacy-microphone');
}
