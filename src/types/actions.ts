import { MiraError } from './MiraError';

export type Action =
  | { kind: 'send_developer_prompt'; prompt: string; autoSend?: boolean }
  | { kind: 'launch_app'; appName: string }
  | { kind: 'open_url'; url: string }
  | { kind: 'set_volume'; level: number }
  | { kind: 'describe_screen' }
  | { kind: 'speak'; text: string };

export type ActionKind = Action['kind'];

const APP_NAME_PATTERN = /^[A-Za-z0-9 .\-_]{1,64}$/;
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);
const MAX_DEV_PROMPT_LEN = 4000;

export function parseAction(raw: unknown): Action {
  if (!raw || typeof raw !== 'object') {
    throw new MiraError('tool_parse', 'action must be an object');
  }
  const r = raw as Record<string, unknown>;
  const kind = r.kind;

  switch (kind) {
    case 'send_developer_prompt': {
      const prompt = String(r.prompt ?? '').trim();
      if (!prompt) {
        throw new MiraError('action_invalid', 'send_developer_prompt prompt must be non-empty');
      }
      if (prompt.length > MAX_DEV_PROMPT_LEN) {
        throw new MiraError(
          'action_invalid',
          `send_developer_prompt prompt exceeds max length (${MAX_DEV_PROMPT_LEN})`,
        );
      }
      const autoSend = typeof r.autoSend === 'boolean' ? r.autoSend : undefined;
      return autoSend === undefined
        ? { kind: 'send_developer_prompt', prompt }
        : { kind: 'send_developer_prompt', prompt, autoSend };
    }
    case 'launch_app': {
      const appName = String(r.appName ?? '');
      if (!APP_NAME_PATTERN.test(appName)) {
        throw new MiraError('action_invalid', `launch_app appName must match ${APP_NAME_PATTERN}`);
      }
      return { kind: 'launch_app', appName };
    }
    case 'open_url': {
      const url = String(r.url ?? '');
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new MiraError('url_invalid', `open_url url is not a valid URL: ${url}`);
      }
      if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
        throw new MiraError('url_invalid', `open_url protocol not allowed: ${parsed.protocol}`);
      }
      return { kind: 'open_url', url: parsed.toString() };
    }
    case 'set_volume': {
      const raw = Number(r.level);
      if (!Number.isFinite(raw)) {
        throw new MiraError('action_invalid', 'set_volume level must be a number');
      }
      const level = Math.max(0, Math.min(100, Math.round(raw)));
      return { kind: 'set_volume', level };
    }
    case 'describe_screen': {
      return { kind: 'describe_screen' };
    }
    case 'speak': {
      const text = String(r.text ?? '');
      if (!text) {
        throw new MiraError('action_invalid', 'speak text must be a non-empty string');
      }
      return { kind: 'speak', text };
    }
    default:
      throw new MiraError('tool_parse', `unknown action kind: ${String(kind)}`);
  }
}
