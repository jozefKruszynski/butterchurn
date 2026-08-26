// Per-preset render cost benchmark against dist/butterchurn.js.
// Usage: node test/visual/bench.mjs <preset.json>          (raw preset, WASM path)
//        node test/visual/bench.mjs "js:<preset name>"     (pre-converted pack, JS path)
// Build first; runs headless Chrome on the real GPU, prints mean/p50/p90 per frame.
import fs from 'fs';
import puppeteer from 'puppeteer';
import TestServer from './utils/testServer.js';

const FRAMES = 240;
const WARMUP = 60;
const SIZE = 1014;

// a path loads raw preset JSON (WASM path); "js:<name>" uses the
// pre-converted pack inside the page (JS path)
const arg = process.argv[2];
const jsName = arg.startsWith('js:') ? arg.slice(3) : null;
const preset = jsName ? null : JSON.parse(fs.readFileSync(arg, 'utf8'));
const audioData = JSON.parse(
  fs.readFileSync('test/fixtures/audioAnalysisData.json', 'utf8')
);

const server = new TestServer();
await server.start();

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
page.on('pageerror', (err) => console.error('page error:', String(err)));
await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
await page.goto(`${server.getUrl()}/test/visual/bench.html`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction(() => window.benchReady === true, { timeout: 15000 });

await page.evaluate(
  (params) => window.startBench(params),
  { width: SIZE, height: SIZE, preset, presetName: jsName, audioData, frames: FRAMES, seed: 12345 }
);
await page.waitForFunction(() => window.renderComplete === true, {
  timeout: 120000,
});

const timings = await page.evaluate(() => window.benchTimings);
const settled = timings.slice(WARMUP).sort((a, b) => a - b);
const mean = settled.reduce((s, v) => s + v, 0) / settled.length;
const pct = (p) => settled[Math.floor(settled.length * p)];
console.log(
  `frames=${settled.length} mean=${mean.toFixed(2)}ms p50=${pct(0.5).toFixed(2)}ms p90=${pct(0.9).toFixed(2)}ms max=${settled[settled.length - 1].toFixed(2)}ms`
);

await browser.close();
await server.stop();
