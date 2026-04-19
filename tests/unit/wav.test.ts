import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeInt16PcmAsWav } from '../../src/main/wav';

const tempFiles: string[] = [];

afterEach(async () => {
  await Promise.all(tempFiles.splice(0).map((p) => fs.unlink(p).catch(() => {})));
});

async function tmp(): Promise<string> {
  const p = path.join(os.tmpdir(), `mira-wav-test-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
  tempFiles.push(p);
  return p;
}

describe('writeInt16PcmAsWav', () => {
  it('writes a valid RIFF/WAVE header for an empty PCM payload', async () => {
    const out = await tmp();
    await writeInt16PcmAsWav(Buffer.alloc(0), out);
    const buf = await fs.readFile(out);
    expect(buf.length).toBe(44);
    expect(buf.subarray(0, 4).toString()).toBe('RIFF');
    expect(buf.subarray(8, 12).toString()).toBe('WAVE');
    expect(buf.subarray(12, 16).toString()).toBe('fmt ');
    expect(buf.subarray(36, 40).toString()).toBe('data');
    expect(buf.readUInt32LE(40)).toBe(0);
    expect(buf.readUInt32LE(24)).toBe(16000); // sample rate
    expect(buf.readUInt16LE(22)).toBe(1);     // mono
    expect(buf.readUInt16LE(34)).toBe(16);    // bit depth
  });

  it('writes correct sizes for a non-empty PCM payload', async () => {
    const out = await tmp();
    const samples = 1600; // 100ms @ 16kHz
    const pcm = Buffer.alloc(samples * 2);
    await writeInt16PcmAsWav(pcm, out);
    const buf = await fs.readFile(out);
    expect(buf.length).toBe(44 + samples * 2);
    expect(buf.readUInt32LE(4)).toBe(36 + samples * 2);
    expect(buf.readUInt32LE(40)).toBe(samples * 2);
  });
});
