import { describe, expect, it } from 'vitest';
import { speechRuntimeOptions } from '../../src/main/speech-policy';
describe('measured portable speech policy', () => {
  it.each([
    ['darwin', 3, ['-ng', '-t', '3']],
    ['darwin', 16, ['-ng', '-t', '4']],
    ['win32', 16, ['-t', '4']],
    ['win32', 1, ['-t', '1']],
    ['darwin', 0, ['-ng', '-t', '1']],
  ] as const)('bounds worker threads on %s', (platform, processors, expected) => {
    expect(speechRuntimeOptions(platform, processors)).toEqual(expected);
  });
});
