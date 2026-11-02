import assert from 'node:assert/strict';
import { lstatSync, readFileSync } from 'node:fs';
import { ReportProgramFiles } from '../../../packages/editor/report/files.mjs';

// Only trusted assertions run here; dependency JavaScript is read as bytes, never evaluated.
async function main() {
  const expected = JSON.parse(readFileSync('/resources/expected.json', 'utf8'));
  const passed = [];
  let current = 'frozen-view';
  const check = async (name, action) => {
    current = name;
    await action();
    passed.push(name);
    console.log(JSON.stringify({ passed: name }));
  };
  try {
    assert.equal(process.cwd(), '/resources');
    const files = new ReportProgramFiles('/resources/reports/entry.html');
    await check('entry-header-and-encoded-url', () => {
      assert.equal(files.entryURL, expected.entryURL);
      assert.deepEqual(files.manifest, expected.manifest);
      assert.equal(files.html, expected.html);
      const encoded = new ReportProgramFiles('/resources/reports/入口 space.html');
      assert.equal(
        encoded.entryURL,
        'scholoom-report://local/reports/%E5%85%A5%E5%8F%A3%20space.html',
      );
    });
    await check('approved-source-bytes-and-media', async () => {
      assert.equal(files.resolve('../assets/source.js'), expected.source.url);
      assert.equal(files.text(expected.source.url, true), expected.source.text);
      const response = files.response('../assets/source.js');
      assert.equal(response.headers.get('content-type'), 'application/javascript');
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        Buffer.from(expected.source.text),
      );
    });
    await check('literal-percent-path-and-encoded-slash-refusal', async () => {
      assert.equal(files.resolve('../assets/a%252fb.js'), expected.percent.url);
      assert.equal(files.text(expected.percent.url, true), expected.percent.text);
      const response = files.response('../assets/a%252fb.js');
      assert.equal(response.headers.get('content-type'), 'text/javascript');
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        Buffer.from(expected.percent.text),
      );
      assert.throws(() => files.resolve('../assets/a%2fb.js'), { code: 'unavailable' });
      assert.throws(() => files.response('../assets/a%2fb.js'), { code: 'unavailable' });
    });
    await check('normalized-declaration-and-javascript-media-check', async () => {
      assert.equal(files.resolve('../assets/data.json'), expected.json.url);
      assert.equal(files.text(expected.json.url), expected.json.text);
      assert.throws(() => files.text(expected.json.url, true), { code: 'unavailable' });
      const response = files.response('../assets/data.json');
      assert.equal(response.headers.get('content-type'), 'application/json');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(expected.json.text));
    });
    await check('unapproved-schemes-and-files', () => {
      for (const url of [
        'https://example.invalid/source.js',
        'file:///resources/assets/source.js',
        'node:fs',
        '../assets/undeclared.js',
      ]) {
        assert.throws(() => files.resolve(url), { code: 'unavailable' });
        assert.throws(() => files.response(url), { code: 'unavailable' });
        assert.throws(() => files.text(url), { code: 'unavailable' });
      }
    });
    await check('resources-traversal-refused', () => {
      assert.throws(() => new ReportProgramFiles('/resources/../entry.html'), {
        code: 'unavailable',
      });
      assert.throws(() => new ReportProgramFiles('/resources/reports/escape.html'), {
        code: 'unavailable',
      });
    });
    await check('preserved-symlink-nofollow', () => {
      assert(lstatSync('/resources/assets/link.js').isSymbolicLink());
      assert.throws(() => new ReportProgramFiles('/resources/reports/symlink.html'), {
        code: 'ELOOP',
      });
    });
    await check('sparse-dependency-and-entry-over-limit', () => {
      assert.equal(lstatSync('/resources/assets/oversize.js').size, 8 * 1024 * 1024 + 1);
      assert.equal(lstatSync('/resources/reports/oversize.html').size, 256 * 1024 + 1);
      assert.throws(() => new ReportProgramFiles('/resources/reports/oversize-dependency.html'), {
        code: 'resourceLimit',
      });
      assert.throws(() => new ReportProgramFiles('/resources/reports/oversize.html'), {
        code: 'resourceLimit',
      });
    });
    await check('invalid-utf8-dependency-text', async () => {
      assert.equal(files.resolve('../assets/invalid.js'), expected.invalid.url);
      const response = files.response('../assets/invalid.js');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([0x61, 0xc3, 0x28]));
      assert.throws(() => files.text(expected.invalid.url, true), {
        name: 'TypeError',
        code: 'ERR_ENCODING_INVALID_ENCODED_DATA',
      });
    });
    console.log(JSON.stringify({ state: 'passed', passed, firstFailure: null }));
  } catch (error) {
    console.error(
      JSON.stringify({
        state: 'failed',
        passed,
        firstFailure: {
          scenario: current,
          name: error.name,
          code: error.code,
          message: error.message,
          stack: error.stack,
        },
      }),
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
