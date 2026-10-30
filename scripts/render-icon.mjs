// Rasterize the code-native waveform mark without a remote asset or platform renderer.
import { deflateSync } from 'node:zlib';
import { promises as fs } from 'node:fs';

const size = 512;
const pixels = Buffer.alloc((size * 4 + 1) * size);
const clamp = (value) => Math.max(0, Math.min(1, value));
const bars = [[128, 36], [170, 72], [212, 110], [254, 90], [296, 124], [338, 66], [380, 30]];
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const qx = Math.abs(x + 0.5 - 256) - 144;
    const qy = Math.abs(y + 0.5 - 256) - 144;
    const alpha = clamp(0.5 - (Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 112));
    const mix = (x + y) / 1024;
    const base = [29 - 18 * mix, 25 - 9 * mix, 49 - 22 * mix];
    let ink = 0;
    for (const [cx, height] of bars) ink = Math.max(ink, clamp(0.5 - (Math.hypot(x + 0.5 - cx, Math.max(Math.abs(y + 0.5 - 256) - height, 0)) - 9)));
    const tint = clamp((x - 128) / 252);
    const color = [179 - 54 * tint, 154 + 72 * tint, 255 - 27 * tint];
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    for (let c = 0; c < 3; c++) pixels[offset + c] = Math.round(base[c] * (1 - ink) + color[c] * ink);
    pixels[offset + 3] = Math.round(alpha * 255);
  }
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
await fs.mkdir('build', { recursive: true });
await fs.writeFile('build/icon.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
]));
