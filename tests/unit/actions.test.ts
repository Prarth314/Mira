import { describe, it, expect } from 'vitest';
import { parseAction } from '../../src/types/actions';
import { MiraError } from '../../src/types/MiraError';

describe('parseAction', () => {
  it('parses launch_app with a valid name', () => {
    expect(parseAction({ kind: 'launch_app', appName: 'Calculator' })).toEqual({
      kind: 'launch_app',
      appName: 'Calculator',
    });
  });

  it('rejects launch_app with shell metachars', () => {
    expect(() => parseAction({ kind: 'launch_app', appName: 'Calc; rm -rf /' })).toThrow(
      MiraError,
    );
  });

  it('rejects launch_app with backticks', () => {
    expect(() => parseAction({ kind: 'launch_app', appName: 'Calc`whoami`' })).toThrow(MiraError);
  });

  it('parses open_url with https', () => {
    const a = parseAction({ kind: 'open_url', url: 'https://example.com' });
    expect(a).toEqual({ kind: 'open_url', url: 'https://example.com/' });
  });

  it('rejects open_url with javascript: protocol', () => {
    expect(() =>
      parseAction({ kind: 'open_url', url: 'javascript:alert(1)' }),
    ).toThrow(/protocol not allowed/);
  });

  it('rejects open_url with file: protocol', () => {
    expect(() => parseAction({ kind: 'open_url', url: 'file:///etc/passwd' })).toThrow(
      /protocol not allowed/,
    );
  });

  it('rejects open_url with data: protocol', () => {
    expect(() =>
      parseAction({ kind: 'open_url', url: 'data:text/html,<script>alert(1)</script>' }),
    ).toThrow(/protocol not allowed/);
  });

  it('rejects malformed open_url', () => {
    expect(() => parseAction({ kind: 'open_url', url: 'not a url' })).toThrow(/not a valid URL/);
  });

  it('clamps set_volume to 0..100', () => {
    expect(parseAction({ kind: 'set_volume', level: 150 })).toEqual({
      kind: 'set_volume',
      level: 100,
    });
    expect(parseAction({ kind: 'set_volume', level: -10 })).toEqual({
      kind: 'set_volume',
      level: 0,
    });
    expect(parseAction({ kind: 'set_volume', level: 73.6 })).toEqual({
      kind: 'set_volume',
      level: 74,
    });
  });

  it('rejects set_volume with non-numeric level', () => {
    expect(() => parseAction({ kind: 'set_volume', level: 'loud' })).toThrow(/must be a number/);
  });

  it('parses describe_screen', () => {
    expect(parseAction({ kind: 'describe_screen' })).toEqual({ kind: 'describe_screen' });
  });

  it('parses speak', () => {
    expect(parseAction({ kind: 'speak', text: 'hello' })).toEqual({
      kind: 'speak',
      text: 'hello',
    });
  });

  it('rejects empty speak', () => {
    expect(() => parseAction({ kind: 'speak', text: '' })).toThrow(/non-empty/);
  });

  it('rejects unknown kind', () => {
    expect(() => parseAction({ kind: 'rm_rf', path: '/' })).toThrow(/unknown action kind/);
  });

  it('rejects non-object inputs', () => {
    expect(() => parseAction(null)).toThrow();
    expect(() => parseAction('launch_app')).toThrow();
    expect(() => parseAction(42)).toThrow();
  });

  it('rejects missing kind', () => {
    expect(() => parseAction({ appName: 'Calculator' })).toThrow(/unknown action kind/);
  });
});
