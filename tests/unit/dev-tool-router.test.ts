import { describe, it, expect } from 'vitest';
import { classifyApp } from '../../src/main/dev-tool-router';

describe('classifyApp', () => {
  it('classifies Cursor by bundle id', () => {
    expect(classifyApp({ name: 'Cursor', bundleId: 'com.todesktop.230313mzl4w4u92' })).toBe(
      'cursor',
    );
  });

  it('classifies Cursor by name (fallback)', () => {
    expect(classifyApp({ name: 'Cursor', bundleId: null })).toBe('cursor');
  });

  it('classifies Warp', () => {
    expect(classifyApp({ name: 'Warp', bundleId: 'dev.warp.warp-stable' })).toBe('warp');
  });

  it('classifies iTerm', () => {
    expect(classifyApp({ name: 'iTerm2', bundleId: 'com.googlecode.iterm2' })).toBe('iterm');
    expect(classifyApp({ name: 'iTerm', bundleId: null })).toBe('iterm');
  });

  it('classifies Terminal.app', () => {
    expect(classifyApp({ name: 'Terminal', bundleId: 'com.apple.terminal' })).toBe('terminal');
  });

  it('classifies VSCode', () => {
    expect(classifyApp({ name: 'Code', bundleId: 'com.microsoft.vscode' })).toBe('vscode');
  });

  it('classifies Claude (desktop) as claude-code', () => {
    expect(
      classifyApp({ name: 'Claude', bundleId: 'com.anthropic.claudefordesktop' }),
    ).toBe('claude-code');
  });

  it('returns unknown for arbitrary apps', () => {
    expect(classifyApp({ name: 'Slack', bundleId: 'com.tinyspeck.slackmacgap' })).toBe(
      'unknown',
    );
    expect(classifyApp({ name: 'Notes', bundleId: null })).toBe('unknown');
  });
});
