import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { setTimeout, clearTimeout } from 'node:timers';

/** Measurement-only: observe whisper children of this test's known Electron PID. */
export async function nativeMemorySampler(parentPid, stopFile) {
  if (process.platform !== 'win32')
    return {
      stop: async () => ({ status: 'unsupported-platform', peakWorkingSetMiB: null, samples: 0 }),
    };
  if (!Number.isSafeInteger(parentPid) || parentPid < 1)
    throw new Error('Invalid owned application PID');
  const script = `$miraParentId = ${parentPid}
$miraStop = '${stopFile.replaceAll("'", "''")}'
$miraPeak = 0; $miraSamples = 0; $miraQueryErrors = 0
Write-Output 'READY'
while (-not (Test-Path -LiteralPath $miraStop)) {
  try { Get-CimInstance Win32_Process -Filter "ParentProcessId = $miraParentId AND Name = 'whisper-cli.exe'" -ErrorAction Stop | ForEach-Object {
    $miraChildInfo = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
    if ($miraChildInfo) { $miraPeak = [Math]::Max($miraPeak, $miraChildInfo.PeakWorkingSet64 / 1MB); $miraSamples++ }
  } } catch { $miraQueryErrors++ }
  Start-Sleep -Milliseconds 250
}
@{peakWorkingSetMiB=$miraPeak;samples=$miraSamples;queryErrors=$miraQueryErrors} | ConvertTo-Json -Compress`;
  const child = spawn(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  let output = '';
  const ready = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
    child.stdout.on('data', (chunk) => {
      output = (output + chunk.toString()).slice(-4096);
      if (output.includes('READY')) {
        clearTimeout(timer);
        resolve(true);
      }
    });
    child.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.once('close', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
  return {
    stop: async () => {
      if (!ready) return { status: 'sampler-unavailable', peakWorkingSetMiB: null, samples: 0 };
      await writeFile(stopFile, 'stop');
      if (child.exitCode === null)
        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            child.kill();
            resolve();
          }, 5000);
          child.once('close', () => {
            clearTimeout(timer);
            resolve();
          });
        });
      try {
        const parsed = JSON.parse(output.trim().split(/\r?\n/).pop());
        return {
          status: parsed.samples ? 'observed-owned-whisper-child' : 'not-observed',
          peakWorkingSetMiB: parsed.samples ? parsed.peakWorkingSetMiB : null,
          samples: parsed.samples,
          queryErrors: parsed.queryErrors,
          samplingIntervalMs: 250,
        };
      } catch {
        return { status: 'sampler-unavailable', peakWorkingSetMiB: null, samples: 0 };
      }
    },
  };
}
