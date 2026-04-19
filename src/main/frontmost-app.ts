import { spawn } from 'node:child_process';
import { MiraError } from '../types/MiraError';

export type FrontmostApp = {
  name: string;
  bundleId: string | null;
};

const SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  try
    set bid to bundle identifier of frontApp
  on error
    set bid to ""
  end try
  return appName & "|" & bid
end tell
`.trim();

export async function getFrontmostApp(): Promise<FrontmostApp> {
  if (process.platform !== 'darwin') {
    throw new MiraError('action_invalid', 'frontmost-app detection is macOS-only in v0.1');
  }
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', SCRIPT]);
    let out = '';
    let err = '';
    child.stdout.on('data', (b: Buffer) => (out += b.toString()));
    child.stderr.on('data', (b: Buffer) => (err += b.toString()));
    child.on('error', (e) =>
      reject(new MiraError('action_invalid', `osascript spawn: ${e.message}`)),
    );
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new MiraError('action_invalid', `osascript exited ${code}: ${err.trim()}`));
        return;
      }
      const [name, bundleId] = out.trim().split('|');
      resolve({ name: name ?? '', bundleId: bundleId || null });
    });
  });
}
