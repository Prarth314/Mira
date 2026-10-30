import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';

const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
let name;
if (process.platform === 'darwin') {
  name = `Mira-${version}-macos-${process.arch}-internal.zip`;
  const app = `release/${process.arch === 'arm64' ? 'mac-arm64' : 'mac'}/Mira.app`;
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, `release/${name}`], {
    stdio: 'inherit',
  });
} else if (process.platform === 'win32') {
  name = `Mira Setup ${version}.exe`;
} else throw new Error('Internal desktop archives target Windows and macOS');

const file = path.join('release', name);
const hash = createHash('sha256');
for await (const chunk of createReadStream(file)) hash.update(chunk);
const sha256 = hash.digest('hex');
await fs.writeFile('release/SHA256SUMS.txt', `${sha256}  ${name}\n`);
await fs.writeFile(
  'release/internal-build.json',
  JSON.stringify(
    {
      version,
      platform: process.platform,
      architecture: process.arch,
      sourceCommit: process.env.GITHUB_SHA ?? null,
      unsigned: true,
      artifact: { name, sha256, bytes: (await fs.stat(file)).size },
    },
    null,
    2,
  ),
);
