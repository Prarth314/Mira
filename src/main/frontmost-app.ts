import { spawn } from 'node:child_process';
import { MiraError } from '../types/MiraError';
import type { Destination } from '../types/studio';
import { systemPreferences } from 'electron';

export type FrontmostApp = Destination;

export async function nativeScript(
  command: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, signal, timeout: 10_000 });
    let out = '';
    let stderr = '';
    child.stdout.on('data', (b: Buffer) => {
      out = (out + b.toString()).slice(-32_768);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4096);
    });
    child.on('error', () =>
      reject(new MiraError('action_invalid', 'Native integration unavailable')),
    );
    child.on('close', (code) =>
      code === 0
        ? resolve(out.trim())
        : reject(
            new MiraError(
              'action_invalid',
              stderr.includes('Cannot activate destination')
                ? 'Windows refused destination activation. Copy your prompt manually.'
                : stderr.includes('Destination closed')
                  ? 'The destination window closed. Copy your prompt manually.'
                  : stderr.includes('Destination changed')
                    ? 'Destination identity or focus changed. Copy your prompt manually.'
                    : /Add-Type|Cannot find type|PSSecurityException|UnauthorizedAccess/i.test(
                          stderr,
                        )
                      ? 'Native system API initialization was unavailable. Copy your prompt manually.'
                      : `Native integration failed (${code}). Check destination and OS permissions.`,
            ),
          ),
    );
  });
}

export const WIN32 = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class MiraWindows {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
}
"@
`;

export function powershell(script: string, signal?: AbortSignal): Promise<string> {
  return nativeScript(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(`$ErrorActionPreference = 'Stop';\n${script}`, 'utf16le').toString('base64'),
    ],
    signal,
  );
}

export async function getFrontmostApp(signal?: AbortSignal): Promise<FrontmostApp> {
  if (process.platform === 'win32') {
    const result = await powershell(
      `${WIN32}
$handle = [MiraWindows]::GetForegroundWindow()
[uint32]$targetProcess = 0
[void][MiraWindows]::GetWindowThreadProcessId($handle, [ref]$targetProcess)
$processInfo = Get-Process -Id $targetProcess
@{ name = $processInfo.ProcessName; bundleId = $null; windowId = $handle.ToInt64().ToString(); processId = $targetProcess } | ConvertTo-Json -Compress
`,
      signal,
    );
    return JSON.parse(result) as FrontmostApp;
  }
  if (process.platform === 'darwin') {
    if (!systemPreferences.isTrustedAccessibilityClient(false)) {
      throw new MiraError(
        'permission_denied',
        'Native routing requires Accessibility permission. Local recording and manual copy remain available.',
      );
    }
    const result = await nativeScript(
      'osascript',
      [
        '-e',
        `tell application "System Events"
set frontApp to first application process whose frontmost is true
return (name of frontApp) & "|" & (bundle identifier of frontApp) & "|" & (unix id of frontApp)
end tell`,
      ],
      signal,
    );
    const [name, bundleId, pid] = result.split('|');
    return { name, bundleId: bundleId || null, processId: Number(pid) };
  }
  throw new MiraError('action_invalid', 'Native delivery is not available on this platform');
}
