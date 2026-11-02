import assert from 'node:assert/strict';
import { expect, test } from '@playwright/test';
import { createReportStyleAssets } from '../../packages/editor/src/report-style-assets.js';

const base = 'scholoom-report://local/reports/main.html';
const png = () =>
  Uint8Array.from(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDs0AAAAASUVORK5CYII=',
      'base64',
    ),
  );
const imageURL = 'scholoom-report://local/assets/pixel.png';
const cssURL = 'scholoom-report://local/assets/theme.css';

test('frozen style assets retain their original bytes and own one revocable render URL', async () => {
  const css = new TextEncoder().encode('p{color:red}');
  const image = png();
  const assets = createReportStyleAssets([
    { url: imageURL, mediaType: 'image/png', bytes: image },
    { url: cssURL, mediaType: 'text/css', bytes: css },
  ]);
  let address = '';
  try {
    css.fill(0);
    image.fill(0);
    expect(assets.resolve('../assets/theme.css', base, 'style')).toEqual({
      url: cssURL,
      text: 'p{color:red}',
    });
    address = assets.resolve('../assets/pixel.png', base, 'render').url;
    expect(address.startsWith('blob:')).toBe(true);
    expect(assets.resolve(imageURL, base, 'render').url).toBe(address);
    expect(new Uint8Array(await (await fetch(address)).arrayBuffer())).toEqual(png());
    for (const [target, kind] of [
      ['https://unapproved.invalid/pixel.png', 'render'],
      ['../assets/missing.png', 'render'],
      ['../assets/pixel.png#fragment', 'render'],
      ['../assets/pixel.png', 'style'],
      ['../assets/theme.css', 'render'],
    ] as const)
      assert.throws(() => assets.resolve(target, base, kind), { code: 'unavailable' });
  } finally {
    assets.close();
  }
  assert.throws(() => assets.resolve(imageURL, base, 'render'), { code: 'unavailable' });
  await expect(fetch(address)).rejects.toThrow();
});

test('render assets reject oversized raster and font headers before URL creation', () => {
  const image = png();
  new DataView(image.buffer).setUint32(16, 5000);
  const font = new Uint8Array(48);
  const view = new DataView(font.buffer);
  view.setUint32(0, 0x774f4632);
  view.setUint32(16, 8388609);
  const assets = createReportStyleAssets([
    { url: imageURL, mediaType: 'image/png', bytes: image },
    { url: 'scholoom-report://local/assets/font.woff2', mediaType: 'font/woff2', bytes: font },
    {
      url: 'scholoom-report://local/assets/animated.gif',
      mediaType: 'image/gif',
      bytes: new Uint8Array([71, 73, 70]),
    },
  ]);
  try {
    for (const target of [imageURL, 'scholoom-report://local/assets/font.woff2'])
      assert.throws(() => assets.resolve(target, base, 'render'), { code: 'resourceLimit' });
    assert.throws(() => assets.resolve('../assets/animated.gif', base, 'render'), {
      code: 'unavailable',
    });
  } finally {
    assets.close();
  }
});

test('asset inventory and CSS decoding are bounded without fallback', () => {
  assert.throws(
    () =>
      createReportStyleAssets([
        {
          url: 'https://unapproved.invalid/theme.css',
          mediaType: 'text/css',
          bytes: new Uint8Array(),
        },
      ]),
    { code: 'unavailable' },
  );
  assert.throws(
    () =>
      createReportStyleAssets(
        Array.from({ length: 33 }, (_, index) => ({
          url: `scholoom-report://local/${index}.css`,
          mediaType: 'text/css',
          bytes: new Uint8Array(),
        })),
      ),
    { code: 'resourceLimit' },
  );
  const assets = createReportStyleAssets([
    { url: cssURL, mediaType: 'text/css', bytes: new Uint8Array(65537) },
    {
      url: 'scholoom-report://local/assets/bad.css',
      mediaType: 'text/css',
      bytes: new Uint8Array([0xff]),
    },
  ]);
  try {
    assert.throws(() => assets.resolve(cssURL, base, 'style'), { code: 'resourceLimit' });
    assert.throws(() => assets.resolve('../assets/bad.css', base, 'style'));
  } finally {
    assets.close();
  }
});
