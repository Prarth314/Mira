import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioState } from '../../src/types/studio';
const mock = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  chat: vi.fn(),
  transcribe: vi.fn(),
  route: vi.fn(),
  copy: vi.fn(),
  role: 'workspace',
  key: 'synthetic-test-key',
  windows: [] as {
    isDestroyed: () => boolean;
    webContents: { isDestroyed: () => boolean; send: (...args: unknown[]) => void };
  }[],
  appOn: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { on: mock.appOn },
  BrowserWindow: { getAllWindows: () => mock.windows },
  clipboard: { writeText: mock.copy },
}));
vi.mock('../../src/main/security', () => ({
  handle: (name: string, fn: (event: unknown, ...args: unknown[]) => unknown) =>
    mock.handlers.set(name, fn),
  windowRole: () => mock.role,
}));
vi.mock('../../src/main/project', () => ({
  selectedContext: () => [
    { path: 'synthetic.ts', content: 'synthetic attached source', sha256: 'test' },
  ],
  contextUnchanged: async () => true,
  projectVocabulary: () => null,
  rememberAlias: vi.fn(),
  vocabularyFileCurrent: vi.fn(),
}));
vi.mock('../../src/main/settings', () => ({
  getSettings: async () => ({ defaultProvider: 'openai' }),
}));
vi.mock('../../src/main/keystore', () => ({ getKey: async () => mock.key }));
vi.mock('../../src/providers', () => ({
  createProvider: () => ({ name: 'openai', chat: mock.chat }),
}));
vi.mock('../../src/main/stt', () => ({ transcribePcm: mock.transcribe }));
vi.mock('../../src/main/frontmost-app', () => ({
  getFrontmostApp: async () => ({
    name: 'Code',
    bundleId: null,
    processId: 1234567,
    windowId: '123',
  }),
}));
vi.mock('../../src/main/dev-tool-router', () => ({
  classifyApp: () => 'vscode',
  routeDevPrompt: mock.route,
}));
const event = { sender: { id: 1 } };
const invoke = (name: string, ...args: unknown[]) =>
  mock.handlers.get(`mira:studio:${name}`)!(event, ...args);
const state = () => invoke('get') as StudioState;
beforeEach(async () => {
  vi.resetModules();
  mock.handlers.clear();
  vi.clearAllMocks();
  mock.role = 'workspace';
  mock.key = 'synthetic-test-key';
  mock.windows = [];
  mock.chat.mockResolvedValue({
    text: 'Keep auth.ts unchanged.',
    toolCalls: [],
    usage: { inputTokens: 1, outputTokens: 1 },
  });
  mock.transcribe.mockResolvedValue('Keep auth.ts unchanged.');
  const studio = await import('../../src/main/studio');
  studio.registerStudio();
});
describe('privileged studio orchestration (real handlers, synthetic external dependencies)', () => {
  it('cancels a destroyed owner while notifying only surviving web contents', () => {
    const { id } = invoke('start', 'dictate') as { id: string };
    const deadSend = vi.fn(() => {
      throw new TypeError('Object has been destroyed');
    });
    const liveSend = vi.fn();
    mock.windows = [
      { isDestroyed: () => false, webContents: { isDestroyed: () => true, send: deadSend } },
      { isDestroyed: () => false, webContents: { isDestroyed: () => false, send: liveSend } },
    ];
    const listeners = new Map<string, () => void>();
    let destroyed = false;
    const contents = {
      get id() {
        if (destroyed) throw new TypeError('Object has been destroyed');
        return 1;
      },
      once: (name: string, fn: () => void) => listeners.set(name, fn),
      on: (name: string, fn: () => void) => listeners.set(name, fn),
    };
    const created = mock.appOn.mock.calls.find(([name]) => name === 'web-contents-created')![1];
    created({}, contents);
    destroyed = true;
    expect(() => listeners.get('destroyed')!()).not.toThrow();
    expect(state()).toMatchObject({ phase: 'idle', sessionId: null });
    expect(deadSend).not.toHaveBeenCalled();
    expect(liveSend).toHaveBeenCalledWith(
      'mira:studio:state',
      expect.objectContaining({ phase: 'idle' }),
    );
    expect(() => invoke('chunk', { id, data: new ArrayBuffer(2) })).toThrow();
    expect(() => listeners.get('render-process-gone')!()).not.toThrow();
    const next = invoke('start', 'dictate') as { id: string };
    invoke('cancel', next.id);
  });
  it('lets the workspace cancel an overlay session without letting stale IDs cancel a new one', async () => {
    mock.role = 'overlay';
    const { id } = invoke('start', 'dictate') as { id: string };
    mock.handlers.get('mira:studio:cancelActive')!({ sender: { id: 2 } }, id);
    const next = invoke('start', 'dictate') as { id: string };
    expect(() => invoke('cancelActive', id)).toThrow();
    expect(state().sessionId).toBe(next.id);
    invoke('cancel', next.id);
  });
  it('local preparation needs no key and explicit copy includes only selected context', async () => {
    mock.key = '';
    await invoke('prepare', { prompt: 'Keep auth.ts unchanged.', mode: 'dictate' });
    expect(mock.chat).not.toHaveBeenCalled();
    expect(mock.copy).not.toHaveBeenCalled();
    await invoke('copy', state().draft!.id);
    expect(mock.copy.mock.calls[0][0]).toContain('synthetic attached source');
  });
  it('refines reviewed text while retaining the original and excluding attachments from providers', async () => {
    await invoke('prepare', { prompt: 'Keep auth.ts unchanged.', mode: 'dictate' });
    const draft = state().draft!;
    await invoke('edit', { id: draft.id, prompt: 'Keep auth.ts unchanged. Review it.' });
    await invoke('refine', draft.id);
    expect(mock.chat.mock.calls[0][0].messages).toEqual([
      { role: 'user', content: 'Keep auth.ts unchanged. Review it.' },
    ]);
    expect(JSON.stringify(mock.chat.mock.calls[0][0])).not.toContain('synthetic attached source');
    expect(state().draft).toMatchObject({ id: draft.id, original: draft.original });
  });
  it('cancels refinement without allowing late output to replace a newer draft', async () => {
    await invoke('prepare', { prompt: 'Keep auth.ts unchanged.', mode: 'dictate' });
    let complete!: (value: unknown) => void;
    mock.chat.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = invoke('refine', state().draft!.id);
    await vi.waitFor(() => expect(mock.chat).toHaveBeenCalled());
    invoke('cancel', state().sessionId);
    await invoke('prepare', { prompt: 'New synthetic draft.', mode: 'dictate' });
    complete({ text: 'Late result', toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } });
    await pending;
    expect(state().draft!.prompt).toBe('New synthetic draft.');
  });
  it('cancels processing on owner loss and ignores an old transcription', async () => {
    let complete!: (value: string) => void;
    mock.transcribe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { id } = invoke('start', 'dictate') as { id: string };
    const pending = invoke('finish', id);
    await vi.waitFor(() => expect(mock.transcribe).toHaveBeenCalled());
    (await import('../../src/main/studio')).cancelStudioOwner(1);
    await invoke('prepare', { prompt: 'Surviving draft.', mode: 'dictate' });
    complete('Old transcription');
    await pending;
    expect(state().draft!.prompt).toBe('Surviving draft.');
  });
  it('refuses foreign-owner chunks and duplicate uncertain delivery after editing/copying', async () => {
    mock.role = 'overlay';
    const { id } = invoke('start', 'dictate') as { id: string };
    expect(() =>
      mock.handlers.get('mira:studio:chunk')!(
        { sender: { id: 2 } },
        { id, data: new ArrayBuffer(2) },
      ),
    ).toThrow();
    await invoke('finish', id);
    mock.route.mockRejectedValueOnce(new Error('uncertain'));
    const draft = state().draft!;
    await invoke('deliver', draft.id);
    await invoke('edit', { id: draft.id, prompt: 'Edited synthetic instruction.' });
    await invoke('copy', draft.id);
    await expect(invoke('deliver', draft.id)).rejects.toThrow('already attempted');
    expect(mock.route).toHaveBeenCalledTimes(1);
    await expect(invoke('refine', draft.id)).rejects.toThrow('already attempted');
  });
});
