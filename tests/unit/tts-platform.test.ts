import { describe, it, expect } from 'vitest';
import { isSupportedPlatform } from '../../src/main/tts';

describe('tts platform support', () => {
  it('matches the running platform', () => {
    expect(isSupportedPlatform()).toBe(process.platform === 'darwin');
  });
});
