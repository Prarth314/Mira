import { test, expect, _electron as electron } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { distribution } from '../../src/evaluation/metrics';
import { MODEL } from '../../src/main/model-info';
import { nativeMemorySampler } from '../../scripts/native-memory-sampler.mjs';

test('measure bounded desktop startup, cancellation, indexing and public-sample speech', async () => {
  test.setTimeout(600_000);
  if (process.env.MIRA_PERFORMANCE_TEST !== '1')
    throw new Error(
      'Run npm run test:performance; requires prepared speech runtime and downloads the public model.',
    );
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mira-performance-'));
  const runtimeManifest = JSON.parse(
    await fs.readFile('vendor/whisper/runtime/manifest.json', 'utf8'),
  );
  expect(runtimeManifest.platform).toBe(process.platform);
  expect(runtimeManifest.arch).toBe(process.arch);
  for (const [file, digest] of Object.entries(runtimeManifest.files)) {
    if (!/^[a-zA-Z0-9._-]+$/.test(file)) throw new Error('Invalid runtime manifest');
    expect(
      createHash('sha256')
        .update(await fs.readFile(path.join('vendor/whisper/runtime', file)))
        .digest('hex'),
    ).toBe(digest);
  }
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const startupMs: number[] = [];
  const launch = (profile: string) =>
    electron.launch({
      executablePath: process.env.MIRA_TEST_EXECUTABLE,
      args: [
        ...(process.env.MIRA_TEST_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${profile}`,
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
      env: { ...env, NODE_ENV: 'production' },
    });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  let nativeSampler: Awaited<ReturnType<typeof nativeMemorySampler>> | undefined;
  try {
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      app = await launch(path.join(root, `startup-${i}`));
      const page = await app.firstWindow();
      await expect(page.getByLabel('Prefer to type?')).toBeEnabled();
      await page.evaluate(async () => window.mira!.studio.state());
      startupMs.push(performance.now() - start);
      await app.close();
      app = undefined;
    }
    app = await launch(path.join(root, 'measurements'));
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.mira);
    const memory = async () =>
      app!.evaluate(({ app }) => {
        const processes = app.getAppMetrics();
        return {
          rssMiB: processes.reduce((sum, item) => sum + item.memory.workingSetSize / 1024, 0),
          cpuPercent: processes.reduce((sum, item) => sum + item.cpu.percentCPUUsage, 0),
        };
      });
    const idle = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(200);
      idle.push(await memory());
    }
    const cancelMs: number[] = [];
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Start recording', exact: true }).click();
      await expect
        .poll(() => page.evaluate(async () => (await window.mira!.studio.state()).recordingMs ?? 0))
        .toBeGreaterThan(200);
      const start = performance.now();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect
        .poll(() => page.evaluate(async () => (await window.mira!.studio.state()).phase))
        .toBe('idle');
      cancelMs.push(performance.now() - start);
    }
    const indexes = [];
    for (const count of [100, 1000, 5000]) {
      const folder = path.join(root, `project-${count}`);
      await fs.mkdir(folder);
      for (let offset = 0; offset < count; offset += 50)
        await Promise.all(
          Array.from({ length: Math.min(50, count - offset) }, (_, i) =>
            fs.writeFile(
              path.join(folder, `file${offset + i}.ts`),
              'export const syntheticValue = 1;',
            ),
          ),
        );
      await app.evaluate(({ dialog }, folder) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
      }, folder);
      const samples = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        const status = await page.evaluate(async () => window.mira!.project.connect());
        expect(status.project?.count).toBe(count);
        samples.push(performance.now() - start);
      }
      indexes.push({ eligibleFiles: count, ms: distribution(samples) });
    }
    const setupStart = performance.now();
    expect((await page.evaluate(async () => window.mira!.model.download())).ok).toBe(true);
    const modelSetupMs = performance.now() - setupStart;
    const sample = await fs.readFile(
      'vendor/whisper/whisper.cpp-306c88f4d1286aec1bf96e544632897886af5501/samples/jfk.wav',
    );
    let pcm: Buffer | undefined;
    for (let offset = 12; offset + 8 <= sample.length;) {
      const length = sample.readUInt32LE(offset + 4);
      if (sample.toString('ascii', offset, offset + 4) === 'data') {
        pcm = sample.subarray(offset + 8, offset + 8 + length);
        break;
      }
      offset += 8 + length + (length % 2);
    }
    if (!pcm) throw new Error('Public PCM sample missing');
    const speech = [];
    nativeSampler = await nativeMemorySampler(
      await app.evaluate(() => process.pid),
      path.join(root, 'stop-sampler'),
    );
    const responsivenessMs: number[] = [];
    let peakElectronMiB = 0;
    for (const seconds of [1, 5, pcm.length / 32000]) {
      const samples = [];
      let failures = 0;
      for (let i = 0; i < 3; i++) {
        const audio = pcm.subarray(0, Math.floor(seconds * 32000));
        const { id } = await page.evaluate(async () => window.mira!.studio.start('dictate'));
        for (let offset = 0; offset < audio.length; offset += 8192)
          await page.evaluate(
            async ({ id, bytes }) => window.mira!.studio.chunk(id, new Uint8Array(bytes).buffer),
            { id, bytes: [...audio.subarray(offset, offset + 8192)] },
          );
        const start = performance.now();
        let done = false;
        const processing = page
          .evaluate(async (id) => window.mira!.studio.finish(id), id)
          .finally(() => {
            done = true;
          });
        while (!done) {
          const ping = performance.now();
          await page.evaluate(async () => {
            await window.mira!.studio.state();
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          });
          responsivenessMs.push(performance.now() - ping);
          peakElectronMiB = Math.max(peakElectronMiB, (await memory()).rssMiB);
          await page.waitForTimeout(100);
        }
        await processing;
        samples.push(performance.now() - start);
        const state = await page.evaluate(async () => window.mira!.studio.state());
        if (state.error) failures++;
        if (seconds === pcm.length / 32000)
          expect(state.draft?.original.toLowerCase()).toContain('ask not what your country');
      }
      speech.push({
        audioSeconds: seconds,
        ms: distribution(samples),
        samplesMs: samples,
        errors: failures,
      });
    }
    const report = {
      schemaVersion: 1,
      kind: 'local-desktop-measurement',
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      worktreeDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      environment: {
        ...(await page.evaluate(async () => window.mira!.diagnostics.get())),
        cpuModel: os.cpus()[0]?.model,
        model: { name: MODEL.name, sha256: MODEL.sha256, sizeBytes: MODEL.sizeBytes },
        runtime: 'Pinned whisper.cpp v1.9.2 CPU runtime; each transcription starts a new process',
        runtimeManifest,
      },
      startupMs: distribution(startupMs),
      startupSamplesMs: startupMs,
      idle: {
        samples: idle.length,
        electronCpuPercent: distribution(idle.map((item) => item.cpuPercent)),
        electronWorkingSetMiB: distribution(idle.map((item) => item.rssMiB)),
      },
      cancellationMs: distribution(cancelMs),
      indexes,
      modelSetupMs,
      speech,
      ipcAndAnimationFrameMs: distribution(responsivenessMs),
      sampledPeakElectronWorkingSetMiB: peakElectronMiB,
      nativeWhisperMemory: await nativeSampler.stop(),
      limitations: [
        'Synthetic microphone cancellation; public upstream sample clips for speech. No real microphone or private recording.',
        'Startup includes process launch to enabled typed input and responding IPC; fresh profiles, warm filesystem possible.',
        'Speech wall time includes IPC, model verification, new process model loading, transcription, cleanup, and up to one 100 ms sampler interval.',
        'First speech request versus later requests reflects OS cache; load and inference are not separately instrumented.',
        'Electron memory is sampled separately from the owned native Whisper child. Windows native peak uses OS PeakWorkingSet64 observed while the child runs; short processes can be missed. Battery is unmeasured.',
        'A separate read-only Windows CIM sampler polls owned Whisper child PIDs every 250 ms; measurement overhead is included.',
        'Small sample groups show min/median/max; p95 is null below 20 observations. No consumer-device guarantee.',
      ],
    };
    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile(
      'test-results/desktop-performance.json',
      JSON.stringify(report, null, 2) + '\n',
    );
  } finally {
    await nativeSampler?.stop();
    if (app) await app.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
