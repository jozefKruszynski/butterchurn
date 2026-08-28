import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { getBrowser, closeBrowser, createPage } from './utils/puppeteer.js';
import { renderButterchurn } from './utils/renderButterchurn.js';
import TestServer from './utils/testServer.js';
import { imageSnapshotConfig } from './setup.js';

const FRAMES_TO_RENDER = 120;
const SEED1 = 12345;
const SEED2 = 54321;

describe('Butterchurn Visual Regression Tests', () => {
  let testServer;
  let serverUrl;

  const width = 800;
  const height = 600;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    serverUrl = testServer.getUrl();
    await getBrowser();
  });

  afterAll(async () => {
    await closeBrowser();
    await testServer.stop();
  });

  const presetsSeedIndependent = [
    '_Mig_085',
    'Aderrasi - Potion of Spirits',
    'Flexi - mindblob mix',
    'Unchained - Rewop',
  ];

  const presetsSeedDependent = [
    'flexi + geiss - pogo cubes vs. tokamak vs. game of life [stahls jelly 4.5 finish]',
    'Flexi, martin + geiss - dedicated to the sherwin maxawow',
    'Geiss - Spiral Artifact',
    'martin - castle in the air',
    'martin - witchcraft reloaded',
    'yin - 191 - Temporal singularities',
  ];

  const testCases = [
    ...presetsSeedIndependent.map(preset => ({
      name: preset,
      seedIndependent: true
    })),
    ...presetsSeedDependent.map(preset => ({
      name: preset,
      seedIndependent: false
    }))
  ];

  let testAudioData;
  beforeAll(() => {
    const audioFilePath = path.join(process.cwd(), 'test/fixtures/audioAnalysisData.json');
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio analysis file not found: ${audioFilePath}\nPlease ensure audioAnalysisData.json is in the test/fixtures directory`);
    }
    testAudioData = JSON.parse(fs.readFileSync(audioFilePath, 'utf8'));
  });

  testCases.forEach(({ name, seedIndependent }) => {
    // JS preset tests (default, matches existing snapshots)
    test(`${name} - comprehensive regression test (JS)`, async () => {
      const page = await createPage();

      try {
        const audioData = testAudioData.slice(0, FRAMES_TO_RENDER);
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

        const screenshot1 = await renderButterchurn(page, serverUrl, width, height, name, audioData, FRAMES_TO_RENDER, SEED1, 'js');

        expect(screenshot1).toMatchImageSnapshot({
          ...imageSnapshotConfig,
          customSnapshotIdentifier: () => `${cleanName}-${SEED1}`
        });

        const screenshot2 = await renderButterchurn(page, serverUrl, width, height, name, audioData, FRAMES_TO_RENDER, SEED2, 'js');

        expect(screenshot2).toMatchImageSnapshot({
          ...imageSnapshotConfig,
          customSnapshotIdentifier: () => `${cleanName}-${SEED2}`
        });

        // Compare image hashes instead of raw buffers to avoid slow diff generation
        const hash1 = crypto.createHash('sha256').update(screenshot1).digest('hex');
        const hash2 = crypto.createHash('sha256').update(screenshot2).digest('hex');

        if (seedIndependent) {
          expect(hash2).toEqual(hash1);
        } else {
          expect(hash2).not.toEqual(hash1);
        }
      } finally {
        await page.close();
      }
    });

    // WASM preset tests (new, with _wasm suffix)
    test(`${name} - comprehensive regression test (WASM)`, async () => {
      const page = await createPage();

      try {
        const audioData = testAudioData.slice(0, FRAMES_TO_RENDER);
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

        const screenshot1 = await renderButterchurn(page, serverUrl, width, height, name, audioData, FRAMES_TO_RENDER, SEED1, 'wasm');

        expect(screenshot1).toMatchImageSnapshot({
          ...imageSnapshotConfig,
          customSnapshotIdentifier: () => `${cleanName}-${SEED1}_wasm`
        });

        const screenshot2 = await renderButterchurn(page, serverUrl, width, height, name, audioData, FRAMES_TO_RENDER, SEED2, 'wasm');

        expect(screenshot2).toMatchImageSnapshot({
          ...imageSnapshotConfig,
          customSnapshotIdentifier: () => `${cleanName}-${SEED2}_wasm`
        });

        // Compare image hashes instead of raw buffers to avoid slow diff generation
        const hash1 = crypto.createHash('sha256').update(screenshot1).digest('hex');
        const hash2 = crypto.createHash('sha256').update(screenshot2).digest('hex');

        if (seedIndependent) {
          expect(hash2).toEqual(hash1);
        } else {
          expect(hash2).not.toEqual(hash1);
        }
      } finally {
        await page.close();
      }
    });
  });

  // Preset blending is its own code path (mixFrameEquations, blend patterns);
  // these snapshots capture a mid-blend frame that the per-preset tests never see.
  const BLEND_FROM = 'Flexi - mindblob mix';
  const BLEND_TO = 'Unchained - Rewop';
  const BLEND_PRE_FRAMES = 60;
  const BLEND_MID_FRAMES = 45;
  const BLEND_TIME_SEC = 3.0;

  ['js', 'wasm'].forEach((presetType) => {
    const suffix = presetType === 'wasm' ? '_wasm' : '';
    test(`preset blend - mid-blend regression test (${presetType.toUpperCase()})`, async () => {
      const page = await createPage();

      try {
        const audioData = testAudioData.slice(0, BLEND_PRE_FRAMES + BLEND_MID_FRAMES);
        const screenshot = await renderButterchurn(
          page, serverUrl, width, height, BLEND_FROM, audioData,
          BLEND_PRE_FRAMES, SEED1, presetType,
          { blendPresetName: BLEND_TO, blendTime: BLEND_TIME_SEC, blendFrames: BLEND_MID_FRAMES }
        );

        expect(screenshot).toMatchImageSnapshot({
          ...imageSnapshotConfig,
          customSnapshotIdentifier: () => `blend-mindblob-to-rewop-${SEED1}${suffix}`
        });
      } finally {
        await page.close();
      }
    });
  });

  // The recoloring APIs are inert unless a host calls them, so nothing above
  // touches the ramp shader path or the frame-color override.
  const PALETTE_PRESET = 'Flexi - mindblob mix';
  const PALETTE_ANCHORS = [
    [16, 12, 40], [78, 30, 96], [166, 52, 92], [232, 120, 74], [252, 220, 176]
  ];
  // longer than the anchor cap: resampled down, never rejected
  const LONG_PALETTE = [
    [8, 8, 24], [40, 16, 64], [96, 24, 88], [140, 40, 96], [190, 72, 88],
    [224, 116, 76], [244, 176, 120], [252, 232, 200]
  ];

  test('artwork palette recoloring regression test (JS)', async () => {
    const page = await createPage();

    try {
      const audioData = testAudioData.slice(0, FRAMES_TO_RENDER);
      const render = (palette) => renderButterchurn(
        page, serverUrl, width, height, PALETTE_PRESET, audioData,
        FRAMES_TO_RENDER, SEED1, 'js', null, palette
      );
      const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

      // the ramp draws in the output shader pass, which only runs with output
      // AA on; every render here shares the setting so only the palette differs
      const AA = { outputFXAA: true };

      const plain = await render(AA);
      const recolored = await render({
        ...AA,
        paletteRamp: PALETTE_ANCHORS,
        paletteRampStrength: 1,
        paletteColors: PALETTE_ANCHORS
      });

      expect(recolored).toMatchImageSnapshot({
        ...imageSnapshotConfig,
        customSnapshotIdentifier: () => `palette-recoloring-${SEED1}`
      });
      expect(hash(recolored)).not.toEqual(hash(plain));

      // ramp only, no element colours: isolates the shader path, and proves a
      // palette longer than the anchor cap still recolors
      const longPalette = await render({
        ...AA,
        paletteRamp: LONG_PALETTE,
        paletteRampStrength: 1
      });
      expect(hash(longPalette)).not.toEqual(hash(plain));
    } finally {
      await page.close();
    }
  });
});
