import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Destination } from '../../src/types/studio';
const mock = vi.hoisted(() => ({
  clipboard: vi.fn(),
  powershell: vi.fn(),
  native: vi.fn(),
  frontmost: vi.fn(),
}));
vi.mock('electron', () => ({ clipboard: { writeText: mock.clipboard } }));
vi.mock('../../src/main/frontmost-app', () => ({
  getFrontmostApp: mock.frontmost,
  powershell: mock.powershell,
  nativeScript: mock.native,
  WIN32: 'fixed-native-types',
}));
import { routeDevPrompt } from '../../src/main/dev-tool-router';
const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
const target: Destination = { name: 'Code', bundleId: null, processId: 1234567, windowId: '1234' };
beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  vi.clearAllMocks();
  mock.powershell.mockResolvedValue('');
  mock.native.mockResolvedValue('');
  mock.frontmost.mockResolvedValue(target);
});
afterEach(() => Object.defineProperty(process, 'platform', descriptor));
describe('actual delivery adapter policy with mocked OS transport', () => {
  it.each(['line\nbreak', 'tab\there', 'escape\x1b', 'delete\x7f'])(
    'blocks terminal control characters before native or clipboard access',
    async (prompt) => {
      await expect(
        routeDevPrompt(prompt, { destination: { ...target, name: 'powershell' } }),
      ).rejects.toThrow('Multiline');
      expect(mock.clipboard).not.toHaveBeenCalled();
      expect(mock.powershell).not.toHaveBeenCalled();
    },
  );
  it('keeps prompt text out of native scripts, pastes without Enter, and never restores clipboard', async () => {
    const prompt = 'Synthetic $(do-not-execute) `literal` instruction';
    expect(await routeDevPrompt(prompt, { destination: target })).toMatchObject({
      autoSent: false,
      pasted: true,
    });
    expect(mock.clipboard).toHaveBeenCalledExactlyOnceWith(prompt);
    expect(mock.powershell).toHaveBeenCalledTimes(2);
    for (const [script] of mock.powershell.mock.calls) expect(script).not.toContain(prompt);
    expect(mock.powershell.mock.calls[1][0]).toContain("SendWait('^v')");
    expect(mock.powershell.mock.calls[1][0]).not.toContain('{ENTER}');
  });
  it('does not touch clipboard when a target is closed or cannot be activated', async () => {
    mock.powershell.mockRejectedValueOnce(new Error('target unavailable'));
    await expect(routeDevPrompt('Synthetic.', { destination: target })).rejects.toThrow();
    expect(mock.clipboard).not.toHaveBeenCalled();
  });
  it('does not retry uncertain paste after a focus change', async () => {
    mock.powershell.mockResolvedValueOnce('').mockRejectedValueOnce(new Error('focus changed'));
    await expect(routeDevPrompt('Synthetic.', { destination: target })).rejects.toThrow();
    expect(mock.powershell).toHaveBeenCalledTimes(2);
    expect(mock.clipboard).toHaveBeenCalledTimes(1);
  });
  it('rejects unsupported applications, self-targets, and malformed PIDs before native calls', async () => {
    for (const destination of [
      { ...target, name: 'unknown' },
      { ...target, processId: process.pid },
      { ...target, processId: -1 },
      { ...target, processId: '1;bad' },
    ])
      await expect(
        routeDevPrompt('Synthetic.', { destination: destination as Destination }),
      ).rejects.toThrow();
    expect(mock.powershell).not.toHaveBeenCalled();
  });
  it('checks macOS foreground identity before clipboard write', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    mock.frontmost.mockResolvedValue({ ...target, processId: 7654321 });
    await expect(routeDevPrompt('Synthetic.', { destination: target })).rejects.toThrow('changed');
    expect(mock.clipboard).not.toHaveBeenCalled();
  });
});
