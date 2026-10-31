import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectIndex, formatPrompt } from '../../src/main/project-index';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-project-'));
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'src', 'auth.ts'), 'export function refreshSession() {}');
  await fs.writeFile(path.join(root, '.env'), 'PRIVATE=do-not-read');
  await fs.writeFile(path.join(root, 'credentials.json'), '{}');
  await fs.writeFile(path.join(root, '.gitignore'), 'ignored.ts\n');
  await fs.writeFile(path.join(root, 'ignored.ts'), 'ignored');
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('explicit project context', () => {
  it('refreshes renamed filenames and rejects removed or redirected correction targets', async () => {
    const index = new ProjectIndex();
    await index.connect(root);
    expect(await index.currentFile('src/auth.ts')).toBe(true);
    await fs.rename(path.join(root, 'src/auth.ts'), path.join(root, 'src/session.ts'));
    expect(await index.currentFile('src/auth.ts')).toBe(false);
    await index.refresh();
    expect(index.search('')).toEqual(['src/session.ts']);
    expect(await index.currentFile('src/session.ts')).toBe(true);
    expect(await index.currentFile('../outside.ts')).toBe(false);
    index.disconnect();
    await expect(index.refresh()).rejects.toThrow();
  });

  it('does not reconnect after a pending index operation was explicitly disconnected', async () => {
    const index = new ProjectIndex();
    const connection = index.connect(root);
    index.disconnect();
    await expect(connection).rejects.toThrow('changed');
    expect(index.vocabulary()).toBeNull();
  });
  it('indexes filenames while excluding ignored and sensitive files', async () => {
    const index = new ProjectIndex();
    expect(await index.connect(root)).toMatchObject({ count: 1 });
    expect(index.search('auth')).toEqual(['src/auth.ts']);
    expect(index.vocabulary()?.files).toEqual(['src/auth.ts']);
    expect(index.vocabulary()?.projectId).not.toContain(root);
    for (const name of ['.env', 'credentials.json', 'ignored.ts', '../outside.ts']) {
      await expect(index.attach([name])).rejects.toThrow();
    }
  });
  it('detects stale attachments and clears scope on disconnect', async () => {
    const index = new ProjectIndex();
    await index.connect(root);
    const files = await index.attach(['src/auth.ts']);
    expect(await index.unchanged(files)).toBe(true);
    await fs.writeFile(path.join(root, 'src', 'auth.ts'), 'changed');
    expect(await index.unchanged(files)).toBe(false);
    index.disconnect();
    expect(index.vocabulary()).toBeNull();
    expect(index.search('')).toEqual([]);
    await expect(index.attach(['src/auth.ts'])).rejects.toThrow();
  });
  it('applies nested basename ignore rules throughout their own subtree', async () => {
    await fs.mkdir(path.join(root, 'src', 'nested'));
    await fs.writeFile(path.join(root, 'src', '.gitignore'), 'generated.ts\n');
    await fs.writeFile(path.join(root, 'src', 'generated.ts'), 'ignore');
    await fs.writeFile(path.join(root, 'src', 'nested', 'generated.ts'), 'ignore');
    const index = new ProjectIndex();
    await index.connect(root);
    expect(index.search('generated')).toEqual([]);
  });
  it('does not index symbolic-link directories outside the selected root', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'external.ts'), 'outside');
      await fs.symlink(
        outside,
        path.join(root, 'linked'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      const index = new ProjectIndex();
      await index.connect(root);
      expect(index.search('external')).toEqual([]);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
  it('fences attached source without letting embedded fences terminate the block', () => {
    const output = formatPrompt('Review this.', [
      { path: 'a.md', content: '```\nsource\n```', sha256: '' },
    ]);
    expect(output).toContain('````\n```\nsource\n```\n````');
  });
});
