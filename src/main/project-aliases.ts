import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWrite, serialQueue } from './atomic-file';
import { MiraError } from '../types/MiraError';
import type { ProjectAlias } from '../types/vocabulary';
import { normalizePhrase } from './vocabulary';

export function validateAlias(value: ProjectAlias): ProjectAlias {
  if (
    typeof value.phrase !== 'string' ||
    value.phrase.length < 2 ||
    value.phrase.length > 100 ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._'$-]*$/.test(value.phrase) ||
    normalizePhrase(value.phrase).split(' ').length > 12 ||
    typeof value.path !== 'string' ||
    value.path.length > 1024 ||
    !value.path ||
    value.path.includes('\\') ||
    value.path.startsWith('/') ||
    value.path.split('/').some((part) => part === '..' || part === '.' || !part)
  )
    throw new MiraError('action_invalid', 'Use a short spoken phrase and an indexed project file.');
  return { phrase: normalizePhrase(value.phrase), path: value.path };
}

/** Only explicit aliases persist; transcripts and absolute project paths never do. */
export class ProjectAliasStore {
  private enqueue = serialQueue();
  constructor(private directory: string) {}

  private file(projectId: string) {
    if (!/^[a-f0-9]{64}$/.test(projectId)) throw new MiraError('action_invalid', 'Invalid project');
    return path.join(this.directory, `${projectId}.json`);
  }

  async read(projectId: string): Promise<ProjectAlias[]> {
    try {
      const file = this.file(projectId);
      if ((await fs.stat(file)).size > 300_000) throw new Error('Alias file too large');
      const doc = JSON.parse(await fs.readFile(file, 'utf8'));
      if (doc.version !== 1 || !Array.isArray(doc.aliases) || doc.aliases.length > 200)
        throw new Error('Invalid alias document');
      return doc.aliases.map((alias: ProjectAlias) => validateAlias(alias));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new MiraError(
        'action_invalid',
        'Project aliases could not be read. Existing data was preserved.',
      );
    }
  }

  set(projectId: string, value: ProjectAlias): Promise<ProjectAlias[]> {
    const alias = validateAlias(value);
    return this.enqueue(async () => {
      const aliases = (await this.read(projectId)).filter((item) => item.phrase !== alias.phrase);
      if (aliases.length >= 200)
        throw new MiraError('action_invalid', 'Remove an alias before adding more (limit 200).');
      aliases.push(alias);
      await atomicWrite(this.file(projectId), JSON.stringify({ version: 1, aliases }));
      return aliases;
    });
  }

  remove(projectId: string, phrase: string): Promise<ProjectAlias[]> {
    return this.enqueue(async () => {
      const aliases = (await this.read(projectId)).filter(
        (item) => item.phrase !== normalizePhrase(phrase),
      );
      await atomicWrite(this.file(projectId), JSON.stringify({ version: 1, aliases }));
      return aliases;
    });
  }
}
