import { spawnSync } from 'node:child_process';
import path from 'node:path';

const executable = process.env.MIRA_TEST_EXECUTABLE ?? (process.platform === 'win32'
  ? 'release/win-unpacked/Mira.exe'
  : `release/${process.arch === 'arm64' ? 'mac-arm64' : 'mac'}/Mira.app/Contents/MacOS/Mira`);
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
  stdio: 'inherit', env: { ...process.env, MIRA_TEST_EXECUTABLE: path.resolve(executable) },
});
process.exit(result.status ?? 1);
