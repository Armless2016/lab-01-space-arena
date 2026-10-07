import { createWriteStream, createReadStream, writeFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

const outputDir = path.resolve('./server/bench');
const tempLog = path.join(outputDir, 'slow-replay-demo.ndjson');
const csvPath = path.join(outputDir, 'rss-measurement.csv');
const svgPath = path.resolve('./docs/rss-backpressure.svg');
const SIZE_MB = 16;
const LINE = '{"type":"chat","player":"Pilot","message":"streaming match event"}\n';

await mkdir(outputDir, { recursive: true });
await mkdir(path.dirname(svgPath), { recursive: true });
const chunk = Buffer.from(LINE.repeat(1024));
const targetBytes = SIZE_MB * 1024 * 1024;
const file = createWriteStream(tempLog);
let written = 0;
while (written < targetBytes) {
  const bytes = Math.min(chunk.length, targetBytes - written);
  file.write(chunk.subarray(0, bytes));
  written += bytes;
}
await new Promise((resolve, reject) => { file.end(resolve); file.on('error', reject); });

const points = [];
const start = performance.now();
const sampleTimer = setInterval(() => {
  points.push({ ms: performance.now() - start, rss: process.memoryUsage().rss / 1024 / 1024 });
}, 25);
sampleTimer.unref?.();

let consumed = 0;
const slowSink = new Writable({
  write(buffer, _encoding, callback) {
    consumed += buffer.length;
    setTimeout(callback, 4);
  },
});
await pipeline(createReadStream(tempLog, { highWaterMark: 64 * 1024 }), slowSink);
clearInterval(sampleTimer);
points.push({ ms: performance.now() - start, rss: process.memoryUsage().rss / 1024 / 1024 });

const csv = ['elapsed_ms,rss_mb', ...points.map((p) => `${p.ms.toFixed(1)},${p.rss.toFixed(2)}`)].join('\n');
writeFileSync(csvPath, `${csv}\n`);

const width = 760;
const height = 380;
const pad = { l: 64, r: 24, t: 28, b: 54 };
const plotW = width - pad.l - pad.r;
const plotH = height - pad.t - pad.b;
const minRss = Math.min(...points.map((p) => p.rss));
const maxRss = Math.max(...points.map((p) => p.rss));
const minY = Math.floor(minRss - 2);
const maxY = Math.ceil(maxRss + 2);
const maxX = Math.max(...points.map((p) => p.ms));
const x = (v) => pad.l + (v / maxX) * plotW;
const y = (v) => pad.t + plotH - ((v - minY) / Math.max(1, maxY - minY)) * plotH;
const polyline = points.map((p) => `${x(p.ms).toFixed(1)},${y(p.rss).toFixed(1)}`).join(' ');
const yTicks = Array.from({ length: 5 }, (_, i) => minY + ((maxY - minY) * i) / 4);
const xTicks = Array.from({ length: 5 }, (_, i) => (maxX * i) / 4);
const grid = [
  ...yTicks.map((v) => `<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#d8dde6" stroke-width="1"/><text x="${pad.l-8}" y="${y(v)+4}" text-anchor="end" font-size="12" fill="#596273">${v.toFixed(0)}</text>`),
  ...xTicks.map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${pad.t}" y2="${height-pad.b}" stroke="#eef1f5" stroke-width="1"/><text x="${x(v)}" y="${height-pad.b+20}" text-anchor="middle" font-size="12" fill="#596273">${v.toFixed(0)}</text>`),
].join('');
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${width/2}" y="18" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#202735">RSS during slow streamed replay</text>
  ${grid}
  <line x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${height-pad.b}" stroke="#6b7280"/>
  <line x1="${pad.l}" x2="${width-pad.r}" y1="${height-pad.b}" y2="${height-pad.b}" stroke="#6b7280"/>
  <polyline fill="none" stroke="#245ea8" stroke-width="2.5" points="${polyline}"/>
  <text x="${width/2}" y="${height-12}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#596273">Elapsed time (ms)</text>
  <text x="16" y="${height/2}" transform="rotate(-90 16 ${height/2})" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#596273">RSS (MB)</text>
  <text x="${width-pad.r}" y="${pad.t+14}" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="#596273">16 MB file · 64 KiB chunks · 4 ms slow sink</text>
</svg>`;
writeFileSync(svgPath, svg);
await rm(tempLog, { force: true });
console.log(JSON.stringify({ file: `${SIZE_MB} MB`, consumedBytes: consumed, sampleCount: points.length, rssMinMB: Number(minRss.toFixed(2)), rssMaxMB: Number(maxRss.toFixed(2)), rssDeltaMB: Number((maxRss - minRss).toFixed(2)), csvPath, svgPath }, null, 2));
