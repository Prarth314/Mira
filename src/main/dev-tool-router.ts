import { spawn } from 'node:child_process';
import { clipboard } from 'electron';
import { MiraError } from '../types/MiraError';
import { getFrontmostApp, type FrontmostApp } from './frontmost-app';

export type DevToolTarget =
  | 'claude-code'
  | 'cursor'
  | 'warp'
  | 'iterm'
  | 'terminal'
  | 'vscode'
  | 'unknown';

export type RouteResult = {
  target: DevToolTarget;
  appName: string;
  pasted: boolean;
  autoSent: boolean;
};

export function classifyApp(app: FrontmostApp): DevToolTarget {
  const id = (app.bundleId ?? '').toLowerCase();
  const name = app.name.toLowerCase();

  if (id === 'com.anthropic.claudefordesktop' || name === 'claude') return 'claude-code';
  if (id === 'com.todesktop.230313mzl4w4u92' || name === 'cursor') return 'cursor';
  if (id === 'dev.warp.warp-stable' || name === 'warp') return 'warp';
  if (id === 'com.googlecode.iterm2' || name === 'iterm2' || name === 'iterm') return 'iterm';
  if (id === 'com.apple.terminal' || name === 'terminal') return 'terminal';
  if (id === 'com.microsoft.vscode' || name === 'code') return 'vscode';
  return 'unknown';
}

async function osascript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', script]);
    let err = '';
    child.stderr.on('data', (b: Buffer) => (err += b.toString()));
    child.on('error', (e) =>
      reject(new MiraError('permission_denied', `osascript spawn: ${e.message}`)),
    );
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(
        new MiraError(
          'permission_denied',
          `osascript exited ${code}: ${err.trim().slice(0, 200)}`,
        ),
      );
    });
  });
}

async function activateApp(appName: string): Promise<void> {
  await osascript(`tell application "${appName}" to activate`);
}

async function pressCmd(key: string): Promise<void> {
  await osascript(
    `tell application "System Events" to keystroke "${key}" using command down`,
  );
}

async function pressCmdEnter(): Promise<void> {
  await osascript(`tell application "System Events" to keystroke return using command down`);
}

async function pasteIntoFrontmost(): Promise<void> {
  await pressCmd('v');
}

/**
 * Send a prompt to the frontmost developer tool.
 *
 * Per-target focus discipline:
 * - cursor:     Cmd+L opens the AI chat panel with focus on input. Then paste.
 * - claude-code/warp/iterm/terminal: paste directly into focused terminal cell.
 * - vscode:     Cmd+I (Copilot inline chat) if available, else paste into active editor.
 * - unknown:    paste into focused element. Best effort.
 */
export async function routeDevPrompt(
  prompt: string,
  opts: { autoSend?: boolean } = {},
): Promise<RouteResult> {
  const app = await getFrontmostApp();
  const target = classifyApp(app);

  // Save and write to clipboard
  const previous = clipboard.readText();
  clipboard.writeText(prompt);
  // Brief delay to let clipboard settle (keystroke before clipboard sync = mojibake)
  await new Promise((r) => setTimeout(r, 60));

  let autoSent = false;
  try {
    switch (target) {
      case 'cursor':
        await activateApp(app.name);
        await new Promise((r) => setTimeout(r, 80));
        await pressCmd('l'); // open AI chat with focus on input
        await new Promise((r) => setTimeout(r, 120));
        await pasteIntoFrontmost();
        if (opts.autoSend) {
          await new Promise((r) => setTimeout(r, 80));
          await pressCmdEnter();
          autoSent = true;
        }
        break;

      case 'claude-code':
      case 'warp':
      case 'iterm':
      case 'terminal':
        await activateApp(app.name);
        await new Promise((r) => setTimeout(r, 60));
        await pasteIntoFrontmost();
        if (opts.autoSend) {
          await new Promise((r) => setTimeout(r, 60));
          await osascript(
            `tell application "System Events" to key code 36`, // Return key
          );
          autoSent = true;
        }
        break;

      case 'vscode':
        await activateApp(app.name);
        await new Promise((r) => setTimeout(r, 80));
        // Cmd+I = Copilot inline chat in modern VSCode. Falls back to plain paste otherwise.
        await pressCmd('i');
        await new Promise((r) => setTimeout(r, 120));
        await pasteIntoFrontmost();
        break;

      case 'unknown':
      default:
        await pasteIntoFrontmost();
        break;
    }
  } finally {
    // Restore the user's original clipboard ~700ms later (let paste finish first)
    setTimeout(() => clipboard.writeText(previous), 700);
  }

  return { target, appName: app.name, pasted: true, autoSent };
}
