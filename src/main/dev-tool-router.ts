import { clipboard } from 'electron';
import { MiraError } from '../types/MiraError';
import {
  getFrontmostApp,
  nativeScript,
  powershell,
  WIN32,
  type FrontmostApp,
} from './frontmost-app';

export type DevToolTarget =
  'claude-desktop' | 'cursor' | 'warp' | 'iterm' | 'terminal' | 'vscode' | 'unknown';
export type RouteResult = {
  target: DevToolTarget;
  appName: string;
  pasted: boolean;
  autoSent: false;
};

export function classifyApp(app: FrontmostApp): DevToolTarget {
  const id = (app.bundleId ?? '').toLowerCase();
  const name = app.name.toLowerCase();
  if (id === 'com.anthropic.claudefordesktop' || name === 'claude') return 'claude-desktop';
  if (id === 'com.todesktop.230313mzl4w4u92' || name === 'cursor') return 'cursor';
  if (id === 'dev.warp.warp-stable' || name === 'warp') return 'warp';
  if (id === 'com.googlecode.iterm2' || name === 'iterm2' || name === 'iterm') return 'iterm';
  if (
    id === 'com.apple.terminal' ||
    ['terminal', 'windowsterminal', 'powershell', 'pwsh', 'cmd'].includes(name)
  )
    return 'terminal';
  if (id === 'com.microsoft.vscode' || name === 'code') return 'vscode';
  return 'unknown';
}

export async function routeDevPrompt(
  prompt: string,
  opts: { autoSend?: boolean; destination?: FrontmostApp } = {},
): Promise<RouteResult> {
  const app = opts.destination ?? (await getFrontmostApp());
  const target = classifyApp(app);
  if (target === 'unknown')
    throw new MiraError('action_invalid', 'Unsupported destination. Copy the prompt instead.');
  if (
    !Number.isSafeInteger(app.processId) ||
    !app.processId ||
    app.processId < 1 ||
    app.processId === process.pid
  )
    throw new MiraError(
      'action_invalid',
      'Select an external developer tool using the recording shortcut.',
    );
  // A terminal paste can interpret embedded newlines as command submission.
  if (
    ['terminal', 'iterm', 'warp'].includes(target) &&
    [...prompt].some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159) || code === 0x2028 || code === 0x2029;
    })
  ) {
    throw new MiraError(
      'action_invalid',
      'Multiline terminal delivery requires manual paste. Use Copy prompt.',
    );
  }
  if (process.platform === 'win32') {
    if (!app.windowId || !/^\d+$/.test(app.windowId))
      throw new MiraError('action_invalid', 'Destination window is unavailable');
    // Clipboard is written only after destination identity and foreground activation are checked.
    await powershell(`${WIN32}
$handle = [IntPtr]::new([long]${app.windowId})
[uint32]$targetProcess = 0
if (-not [MiraWindows]::IsWindow($handle)) { throw 'Destination closed' }
[void][MiraWindows]::GetWindowThreadProcessId($handle, [ref]$targetProcess)
if ($targetProcess -ne ${app.processId}) { throw 'Destination changed' }
[void][MiraWindows]::SetForegroundWindow($handle)
Start-Sleep -Milliseconds 100
if ([MiraWindows]::GetForegroundWindow() -ne $handle) { throw 'Cannot activate destination' }
`);
    await clipboard.writeText(prompt);
    await powershell(`${WIN32}
$handle = [IntPtr]::new([long]${app.windowId})
[uint32]$targetProcess = 0
[void][MiraWindows]::GetWindowThreadProcessId($handle, [ref]$targetProcess)
if ($targetProcess -ne ${app.processId} -or [MiraWindows]::GetForegroundWindow() -ne $handle) { throw 'Destination changed before paste' }
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('^v')
`);
  } else if (process.platform === 'darwin') {
    const pid = Math.trunc(app.processId);
    const script = `tell application "System Events"
set targetProcess to first application process whose unix id is ${pid}
set frontmost of targetProcess to true
end tell`;
    await nativeScript('osascript', ['-e', script]);
    const current = await getFrontmostApp();
    if (current.processId !== app.processId)
      throw new MiraError('action_invalid', 'Destination changed before paste');
    await clipboard.writeText(prompt);
    await nativeScript('osascript', [
      '-e',
      `tell application "System Events"
if unix id of first application process whose frontmost is true is not ${pid} then error "Destination changed"
keystroke "v" using command down
end tell`,
    ]);
  } else
    throw new MiraError(
      'action_invalid',
      'Native delivery is unavailable. Copy the prompt instead.',
    );
  // OS keyboard injection does not acknowledge receipt. Do not claim confirmed delivery.
  // Leave the prompt on the clipboard; never overwrite a newer clipboard value on a timer.
  return { target, appName: app.name, pasted: true, autoSent: false };
}
