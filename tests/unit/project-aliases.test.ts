import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectAliasStore } from '../../src/main/project-aliases';

let directory: string;
const project = 'a'.repeat(64);
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-aliases-'));
});
afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

describe('explicit project alias persistence', () => {
  it('serializes writes, survives restart and isolates projects', async () => {
    const store = new ProjectAliasStore(directory);
    await Promise.all([
      store.set(project, { phrase: 'Use Studio', path: 'src/useStudio.ts' }),
      store.set(project, { phrase: 'coordinator', path: 'src/session.ts' }),
    ]);
    expect(await new ProjectAliasStore(directory).read(project)).toHaveLength(2);
    expect(await store.read('b'.repeat(64))).toEqual([]);
    await store.set(project, { phrase: 'USE studio', path: 'hooks/useStudio.ts' });
    expect(await store.read(project)).toContainEqual({
      phrase: 'use studio',
      path: 'hooks/useStudio.ts',
    });
    expect(await store.remove(project, 'use studio')).toEqual([
      { phrase: 'coordinator', path: 'src/session.ts' },
    ]);
  });

  it('preserves corrupt and future documents rather than overwriting them', async () => {
    const file = path.join(directory, `${project}.json`);
    const store = new ProjectAliasStore(directory);
    for (const document of ['broken', '{"version":2,"aliases":[]}']) {
      await fs.writeFile(file, document);
      await expect(store.set(project, { phrase: 'studio', path: 'a.ts' })).rejects.toThrow(
        'preserved',
      );
      expect(await fs.readFile(file, 'utf8')).toBe(document);
    }
  });

  it('rejects path traversal and unbounded alias inputs', async () => {
    const store = new ProjectAliasStore(directory);
    await expect(store.read('../outside')).rejects.toThrow();
    for (const file of ['../a.ts', '/a.ts', 'src\\a.ts', 'src/./a.ts'])
      expect(() => store.set(project, { phrase: 'studio', path: file })).toThrow();
    expect(() => store.set(project, { phrase: 'x'.repeat(101), path: 'a.ts' })).toThrow();
  });
});
