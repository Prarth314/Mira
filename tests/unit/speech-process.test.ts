import { describe, expect, it } from 'vitest';
import { runSpeechProcess } from '../../src/main/speech-process';

describe('owned native speech subprocess', () => {
  it('waits for a successful actual process without collecting its output', async () => {
    await expect(
      runSpeechProcess(process.execPath, [
        '-e',
        'process.stdout.write("synthetic"); process.exit(0)',
      ]),
    ).resolves.toBeUndefined();
  });
  it('sanitizes actual process failures and handles missing executables', async () => {
    await expect(
      runSpeechProcess(process.execPath, [
        '-e',
        'process.stderr.write("synthetic-private-path"); process.exit(2)',
      ]),
    ).rejects.toThrow('failed or timed out');
    await expect(runSpeechProcess('mira-deliberately-missing-executable', [])).rejects.toThrow(
      'failed or timed out',
    );
  });
  it('terminates a running actual child on deadline', async () => {
    await expect(
      runSpeechProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
        timeoutMs: 100,
        graceMs: 100,
      }),
    ).rejects.toThrow('timed out');
  });
  it('cancels actual child processes and rejects pre-aborted work', async () => {
    const controller = new AbortController();
    const work = runSpeechProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
      signal: controller.signal,
    });
    const rejected = expect(work).rejects.toThrow('synthetic cancellation');
    controller.abort(new Error('synthetic cancellation'));
    await rejected;
    expect(() => runSpeechProcess(process.execPath, [], { signal: controller.signal })).toThrow();
  });
});
