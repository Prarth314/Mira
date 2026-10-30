import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Scratch audio is confined to a dedicated directory under this app profile. */
export class SpeechScratch {
  constructor(private readonly profile: string) {}

  private async base(): Promise<string> {
    await fs.mkdir(this.profile, { recursive: true });
    const profile = await fs.realpath(this.profile);
    const target = path.join(profile, 'speech-scratch');
    await fs.mkdir(target, { recursive: true });
    if (
      (await fs.lstat(target)).isSymbolicLink() ||
      path.dirname(await fs.realpath(target)) !== profile
    ) {
      throw new Error('Speech scratch storage must remain inside the app profile');
    }
    return target;
  }

  async create(): Promise<string> {
    return fs.mkdtemp(path.join(await this.base(), 'mira-'));
  }

  async remove(directory: string): Promise<void> {
    const base = await this.base();
    const target = path.resolve(directory);
    if (path.dirname(target) !== base || !/^mira-[A-Za-z0-9]{6}$/.test(path.basename(target))) {
      throw new Error('Refusing to remove a directory outside Mira speech scratch storage');
    }
    await fs.rm(target, { recursive: true, force: true });
  }

  async cleanup(): Promise<void> {
    const base = await this.base();
    for (const entry of await fs.readdir(base, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        /^mira-[A-Za-z0-9]{6}$/.test(entry.name)
      ) {
        await this.remove(path.join(base, entry.name));
      }
    }
  }
}
