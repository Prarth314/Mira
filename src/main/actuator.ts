import { spawn } from 'node:child_process';
import type { Action } from '../types/actions';
import { MiraError } from '../types/MiraError';
import { speak } from './tts';
import { routeDevPrompt } from './dev-tool-router';
import { cleanPrompt } from './prompt-cleanup';
import { getSettings } from './settings';

export type ActuatorResult = { ok: true; message: string } | { ok: false; error: { kind: string; message: string } };

export async function runAction(action: Action): Promise<ActuatorResult> {
  try {
    switch (action.kind) {
      case 'send_developer_prompt': {
        const settings = await getSettings();
        const cleaned = cleanPrompt(action.prompt);
        const autoSend = action.autoSend ?? settings.autoSend;
        const result = await routeDevPrompt(cleaned, { autoSend });
        const verb = result.autoSent ? 'sent' : 'pasted';
        return {
          ok: true,
          message: `${verb} into ${result.appName} (${result.target})`,
        };
      }
      case 'launch_app': {
        await execProcess('open', ['-a', action.appName]);
        return { ok: true, message: `launched ${action.appName}` };
      }
      case 'open_url': {
        await execProcess('open', [action.url]);
        return { ok: true, message: `opened ${action.url}` };
      }
      case 'set_volume': {
        await execProcess('osascript', ['-e', `set volume output volume ${action.level}`]);
        return { ok: true, message: `volume set to ${action.level}%` };
      }
      case 'describe_screen': {
        // Renderer captures and re-invokes chat with images attached.
        return { ok: true, message: 'screen capture requested' };
      }
      case 'speak': {
        await speak(action.text);
        return { ok: true, message: `spoke: ${action.text}` };
      }
      default: {
        const exhaustive: never = action;
        throw new MiraError('action_invalid', `unknown action: ${JSON.stringify(exhaustive)}`);
      }
    }
  } catch (e) {
    if (e instanceof MiraError) return { ok: false, error: { kind: e.kind, message: e.message } };
    return {
      ok: false,
      error: { kind: 'action_invalid', message: e instanceof Error ? e.message : String(e) },
    };
  }
}

function execProcess(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore' });
    child.on('error', (e) =>
      reject(new MiraError('action_invalid', `${cmd} spawn: ${e.message}`)),
    );
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new MiraError('action_invalid', `${cmd} exited ${code}`));
    });
  });
}
