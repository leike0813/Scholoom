/// <reference lib="dom" />
import { OperationError } from '@scholoom/protocol/core';
import {
  reportRenderLimits as limits,
  type ReportManifest,
  reportLimits,
} from '@scholoom/protocol/reports';
import type { ReportStyleResolver } from './report-styles.js';

type FrozenAsset = {
  url: string;
  mediaType: ReportManifest['resources'][number]['mediaType'];
  bytes: Uint8Array;
};
function check(
  value: unknown,
  code: 'unavailable' | 'resourceLimit' = 'unavailable',
): asserts value {
  if (!value) throw new OperationError(code, '报告仅能呈现已批准且有界的冻结资源。');
}

function pixels(width: number, height: number) {
  check(
    width > 0 &&
      height > 0 &&
      width <= 4096 &&
      height <= 4096 &&
      width * height <= limits.imagePixels,
    'resourceLimit',
  );
  return width * height;
}
function raster(bytes: Uint8Array, mime: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png') {
    check(
      bytes.length >= 45 &&
        [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value),
    );
    check(view.getUint32(8) === 13 && view.getUint32(12) === 0x49484452);
    const count = pixels(view.getUint32(16), view.getUint32(20));
    let offset = 8;
    let chunks = 0;
    let data = false;
    let ended = false;
    while (offset < bytes.length) {
      check(++chunks <= 8192, 'resourceLimit');
      check(offset + 12 <= bytes.length);
      const size = view.getUint32(offset);
      const type = view.getUint32(offset + 4);
      check(offset + size + 12 <= bytes.length);
      check(type !== 0x6163544c); // Animated PNG needs a decoded-frame budget.
      if (type === 0x49444154) data = true;
      offset += size + 12;
      if (type === 0x49454e44) {
        check(size === 0 && offset === bytes.length);
        ended = true;
      }
    }
    check(data && ended);
    return count;
  }
  check(mime === 'image/jpeg' && bytes.length >= 4 && view.getUint16(0) === 0xffd8);
  let offset = 2;
  for (let segments = 0; offset + 4 <= bytes.length && segments < 8192; segments++) {
    check(bytes[offset++] === 0xff);
    while (bytes[offset] === 0xff) offset++;
    check(offset + 3 <= bytes.length);
    const marker = bytes[offset++]!;
    check(marker !== 0xda && marker !== 0xd9 && marker !== 0);
    const size = view.getUint16(offset);
    check(size >= 2 && offset + size <= bytes.length);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      check(size >= 8);
      return pixels(view.getUint16(offset + 5), view.getUint16(offset + 3));
    }
    offset += size;
  }
  throw new OperationError('unavailable', '报告图像格式不可用。');
}

/** Owns only render URLs for this frozen version; closing a view must also stop its presentation. */
export function createReportStyleAssets(assets: readonly FrozenAsset[]) {
  check(assets.length <= reportLimits.resources, 'resourceLimit');
  const files = new Map<string, FrozenAsset>();
  const urls = new Map<string, string>();
  let total = 0;
  let decodedPixels = 0;
  let decodedFonts = 0;
  let closed = false;
  for (const asset of assets) {
    const address = new URL(asset.url);
    check(
      address.protocol === 'scholoom-report:' &&
        address.host === 'local' &&
        !address.username &&
        !address.password &&
        !address.hash &&
        !address.search &&
        address.href === asset.url &&
        !files.has(asset.url),
    );
    check(
      asset.bytes instanceof Uint8Array && asset.bytes.length <= reportLimits.dependencyBytes,
      'resourceLimit',
    );
    total += asset.bytes.length;
    check(total <= reportLimits.loadBytes, 'resourceLimit');
    files.set(asset.url, { ...asset, bytes: Uint8Array.from(asset.bytes) });
  }
  const resolve: ReportStyleResolver = (specifier, baseURL, kind) => {
    check(!closed);
    const address = new URL(specifier, baseURL).href;
    const file = files.get(address);
    check(file);
    if (kind === 'style') {
      check(file.mediaType === 'text/css');
      check(file.bytes.length <= limits.cssBytes, 'resourceLimit');
      return { url: address, text: new TextDecoder('utf-8', { fatal: true }).decode(file.bytes) };
    }
    const existing = urls.get(address);
    if (existing) return { url: existing };
    if (file.mediaType === 'image/png' || file.mediaType === 'image/jpeg') {
      const count = raster(file.bytes, file.mediaType);
      check(decodedPixels + count <= limits.renderPixels, 'resourceLimit');
      decodedPixels += count;
    } else {
      // shortcut: animated/other raster codecs need independent frame and decode budgets.
      check(['font/woff', 'font/woff2', 'font/ttf', 'font/otf'].includes(file.mediaType));
      check(file.bytes.length >= 12);
      const view = new DataView(file.bytes.buffer, file.bytes.byteOffset, file.bytes.byteLength);
      const magic = view.getUint32(0);
      const compressed = file.mediaType === 'font/woff' || file.mediaType === 'font/woff2';
      check(
        magic ===
          (file.mediaType === 'font/woff'
            ? 0x774f4646
            : file.mediaType === 'font/woff2'
              ? 0x774f4632
              : file.mediaType === 'font/otf'
                ? 0x4f54544f
                : 0x00010000),
      );
      check(!compressed || file.bytes.length >= (file.mediaType === 'font/woff2' ? 48 : 44));
      const count = compressed ? view.getUint32(16) : file.bytes.length;
      check(
        count > 0 && count <= limits.fontBytes && decodedFonts + count <= limits.fontBytes * 2,
        'resourceLimit',
      );
      decodedFonts += count;
    }
    const url = URL.createObjectURL(
      new Blob([Uint8Array.from(file.bytes)], { type: file.mediaType }),
    );
    urls.set(address, url);
    return { url };
  };
  return {
    resolve,
    close() {
      if (closed) return;
      closed = true;
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
      files.clear();
    },
  };
}
