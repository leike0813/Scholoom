/** Synthetic ZIP, EPUB, and HTML documents; not derived from real material. */

import { crc32, deflateRawSync } from 'node:zlib';

type ZipEntry = { name: string; data: string | Uint8Array };

const UTF8_NAME_FLAG = 0x0800;
const DOS_TIME = 0;
const DOS_DATE = 0x21;
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
const PNG = Buffer.from(PNG_BASE64, 'base64');

function zip(entries: ZipEntry[], storedNames: ReadonlySet<string> = new Set()): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data =
      typeof entry.data === 'string' ? Buffer.from(entry.data, 'utf8') : Buffer.from(entry.data);
    const stored = storedNames.has(entry.name);
    const compressed = stored ? data : deflateRawSync(data);
    const checksum = crc32(data) >>> 0;
    const method = stored ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_NAME_FLAG, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_NAME_FLAG, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);

    localParts.push(local, name, compressed);
    centralParts.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function zipFixture(entries: ZipEntry[]): Buffer {
  return zip(entries);
}

const CHAPTER_ONE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
  <head><meta charset="UTF-8" /><title>第一章</title></head>
  <body>
    <h1>第一章</h1>
    <p>Scholoom 文献 <strong>evidence</strong> 42.</p>
    <p><a href="ch2.xhtml#result">前往第二章结果</a></p>
  </body>
</html>`;

const CHAPTER_TWO = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
  <head><meta charset="UTF-8" /><title>第二章</title></head>
  <body>
    <h1>第二章</h1>
    <p id="result">Second chapter result 73 😀.</p>
    <p><img src="image.png" alt="合成 1×1 PNG" /></p>
    <table>
      <thead><tr><th>A</th><th>B</th></tr></thead>
      <tbody><tr><td>1</td><td>2</td></tr></tbody>
    </table>
  </body>
</html>`;

export function epubFixture(version: 2 | 3 = 3): Buffer {
  const packageDocument = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${version === 3 ? '3.0' : '2.0'}" unique-identifier="book-id" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:00000000-0000-4000-8000-000000000042</dc:identifier>
    <dc:title>Scholoom 合成文档</dc:title>
    <dc:language>zh-CN</dc:language>${version === 3 ? '\n    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>' : ''}
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml" />
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml" />
    <item id="image" href="image.png" media-type="image/png" />
    ${version === 3 ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />' : '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />'}
  </manifest>
  <spine${version === 2 ? ' toc="ncx"' : ''}>
    <itemref idref="ch1" />
    <itemref idref="ch2" />
  </spine>
</package>`;

  const navigation =
    version === 3
      ? `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN">
  <head><meta charset="UTF-8" /><title>目录</title></head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>目录</h1>
      <ol>
        <li><a href="ch1.xhtml">第一章</a></li>
        <li><a href="ch2.xhtml">第二章</a></li>
      </ol>
    </nav>
  </body>
</html>`
      : `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:00000000-0000-4000-8000-000000000042" /></head>
  <docTitle><text>Scholoom 合成文档</text></docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="ch1.xhtml" /></navPoint>
    <navPoint id="navPoint-2" playOrder="2"><navLabel><text>第二章</text></navLabel><content src="ch2.xhtml" /></navPoint>
  </navMap>
</ncx>`;

  return zip(
    [
      { name: 'mimetype', data: 'application/epub+zip' },
      {
        name: 'META-INF/container.xml',
        data: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`,
      },
      { name: 'OPS/package.opf', data: packageDocument },
      { name: 'OPS/ch1.xhtml', data: CHAPTER_ONE },
      { name: 'OPS/ch2.xhtml', data: CHAPTER_TWO },
      { name: version === 3 ? 'OPS/nav.xhtml' : 'OPS/toc.ncx', data: navigation },
      { name: 'OPS/image.png', data: PNG },
    ],
    new Set(['mimetype']),
  );
}

export const htmlFixture: string = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <title>网页样本</title>
  </head>
  <body>
    <h1>网页样本</h1>
    <p>Local HTML <em>evidence</em> 91.</p>
    <p><img src="data:image/png;base64,${PNG_BASE64}" alt="合成 1×1 PNG"></p>
    <img src="https://example.invalid/image.png" alt="远程图片">
    <p><a href="https://example.invalid/page">外部链接</a></p>
    <script>window.__unsafeDocument=true;</script>
  </body>
</html>`;
