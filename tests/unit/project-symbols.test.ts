import { describe, expect, it } from 'vitest';
import { projectSymbols } from '../../src/main/project-symbols';

const file = (content: string, path = 'src/session.ts') => ({ path, content, sha256: 'test' });

describe('explicit attachment declaration vocabulary', () => {
  it('extracts top-level TS declarations without parsing comments or strings as code', () => {
    const symbols = projectSymbols([
      file(`
      // function fakeFunction() {}
      const exampleText = 'export const fakeConstant = 10';
      export async function refreshSession() { const nestedValue = 1; }
      export const sessionTTL = 300;
      export interface SessionOptions { nestedProperty: string }
      export type SessionResult = string;
      export class SessionCoordinator {}
      enum SessionStatus { Active }
    `),
    ]);
    expect(symbols.map((item) => item.name)).toEqual([
      'exampleText',
      'refreshSession',
      'sessionTTL',
      'SessionOptions',
      'SessionResult',
      'SessionCoordinator',
      'SessionStatus',
    ]);
    expect(symbols.every((item) => item.path === 'src/session.ts')).toBe(true);
  });

  it('supports JSX and default declarations but skips imports and destructuring', () => {
    expect(
      projectSymbols([
        file(
          `import { fakeImport } from 'other';
      const { fakeBinding } = value;
      export default function SessionView() { return <div>function fakeText() {}</div>; }
    `,
          'view.tsx',
        ),
      ]).map((item) => item.name),
    ).toEqual(['SessionView']);
  });

  it('fails closed on invalid syntax, unsupported files and oversized snapshots', () => {
    expect(
      projectSymbols([
        file('export function broken('),
        file('export const fakeName = 1', 'notes.md'),
        file(' '.repeat(24_001)),
      ]),
    ).toEqual([]);
  });

  it('bounds declaration counts', () => {
    expect(
      projectSymbols([
        file(Array.from({ length: 250 }, (_, i) => `const value${i} = ${i};`).join('\n')),
      ]),
    ).toHaveLength(200);
  });
});
