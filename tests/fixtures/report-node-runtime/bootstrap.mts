import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createSocket } from 'node:dgram';
import { fstatSync, readFileSync, writeFileSync } from 'node:fs';
import { Socket } from 'node:net';
import { copyFrame, frameLimits } from '../report-async-dom/frame-budget.mjs';
import { TransferrableKeys as K } from '../../../packages/editor/vendor/worker-dom/src/transfer/TransferrableKeys.js';
import { createWorkerDOM, hydrate } from '../../../packages/editor/vendor/worker-dom/src/worker-thread/index.js';

async function denied(
  name: string,
  action: () => unknown,
  codes: readonly string[] = ['EACCES', 'EPERM'],
) {
  try {
    await action();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    assert(code && codes.includes(code), `${name}: ${String(error)}`);
    return code;
  }
  assert.fail(`${name}: unexpectedly succeeded`);
}

async function readRequest() {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of process.stdin.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      assert(size <= 1024, 'requestBytes');
      chunks.push(chunk);
      if (chunk.includes(10)) break;
    }
  } finally {
    process.stdin.pause();
  }
  const bytes = Buffer.concat(chunks);
  const newline = bytes.indexOf(10);
  assert(newline < 0 || newline === bytes.length - 1, 'oneRequest');
  const request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  assert.deepEqual(request, { request: 'fixed-node-runtime' });
  return request;
}

async function main() {
  const stdStreams = {
    stdin: fstatSync(0).isFIFO(),
    stdout: fstatSync(1).isFIFO(),
    stderr: fstatSync(2).isFIFO(),
  };
  assert.deepEqual(stdStreams, { stdin: true, stdout: true, stderr: true });
  const envKeys = Object.keys(process.env);
  assert(
    envKeys.every((key) => key === 'PWD'),
    'environmentKeys',
  );
  const request = await readRequest();
  const approved = readFileSync('/resources/approved.txt', 'utf8');
  assert.equal(approved, 'approved report bytes\n');

  const frames: ReturnType<typeof copyFrame>[] = [];
  const source = createWorkerDOM(
    (message) => {
      assert(frames.length < frameLimits.frames, 'frameCount');
      frames.push(
        copyFrame({
          sequence: frames.length + 1,
          phase: message[K.phase],
          nodes: new Uint16Array(message[K.nodes]),
          strings: message[K.strings],
          mutations: new Uint16Array(message[K.mutations]),
        }),
      );
    },
    () => {},
    () => {},
  );
  hydrate(
    source.document,
    [],
    {} as Parameters<typeof hydrate>[2],
    [],
    [],
    [800, 600],
    { storage: {}, errorMsg: null },
    { storage: {}, errorMsg: null },
  );
  source.document[K.observe]();
  const htmlNamespace = 'http://www.w3.org/1999/xhtml';
  const mathNamespace = 'http://www.w3.org/1998/Math/MathML';
  const section = source.document.createElement('section');
  const heading = source.document.createElement('h1');
  heading.textContent = 'Node runtime';
  section.appendChild(heading);
  const math = source.document.createElementNS(mathNamespace, 'math');
  const fraction = source.document.createElementNS(mathNamespace, 'mfrac');
  const numerator = source.document.createElementNS(mathNamespace, 'mi');
  const denominator = source.document.createElementNS(mathNamespace, 'mn');
  numerator.textContent = 'x';
  denominator.textContent = '2';
  fraction.appendChild(numerator);
  fraction.appendChild(denominator);
  math.appendChild(fraction);
  section.appendChild(math);
  source.document.body.appendChild(section);
  assert.equal(section.namespaceURI, htmlNamespace);
  assert.equal(heading.namespaceURI, htmlNamespace);
  assert.equal(heading.textContent, 'Node runtime');
  assert.equal(math.namespaceURI, mathNamespace);
  assert.equal(fraction.namespaceURI, mathNamespace);
  assert.equal(fraction.localName, 'mfrac');
  assert.deepEqual(math.children, [fraction]);
  assert.deepEqual(fraction.children, [numerator, denominator]);
  const children = fraction.children.map((node) => ({
    name: node.localName,
    namespace: node.namespaceURI,
    text: node.textContent,
  }));
  assert.deepEqual(children, [
    { name: 'mi', namespace: mathNamespace, text: 'x' },
    { name: 'mn', namespace: mathNamespace, text: '2' },
  ]);
  await Promise.resolve();
  assert(frames.some((frame) => frame.nodes.length > 0 && frame.mutations.length > 0));

  const denials = {
    tcp: await denied('tcp', async () => {
      const socket = new Socket();
      try {
        await new Promise<void>((resolve, reject) => {
          socket.once('error', reject);
          socket.once('connect', resolve);
          socket.setTimeout(1000, () => reject(new Error('tcpTimeout')));
          socket.connect(9, '127.0.0.1');
        });
      } finally {
        socket.destroy();
      }
    }),
    udp: await denied('udp', async () => {
      const socket = createSocket('udp4');
      try {
        await new Promise<void>((resolve, reject) => {
          socket.once('error', reject);
          socket.bind(0, '127.0.0.1', resolve);
        });
      } finally {
        try {
          socket.close();
        } catch (error) {
          assert.equal((error as NodeJS.ErrnoException).code, 'ERR_SOCKET_DGRAM_NOT_RUNNING');
        }
      }
    }),
    read: await denied('read', () => readFileSync('/etc/passwd'), ['ENOENT', 'EACCES', 'EPERM']),
    write: await denied(
      'write',
      () => writeFileSync('/resources/approved.txt', approved, { flag: 'r+' }),
      ['EACCES', 'EROFS', 'EPERM'],
    ),
    spawn: await denied(
      'spawn',
      () =>
        new Promise<void>((resolve, reject) => {
          const child = spawn('/runtime/node', ['--version'], { stdio: [0, 2, 2] });
          child.once('error', reject);
          child.once('close', () => resolve());
        }),
    ),
  };
  const result = JSON.stringify({
    accepted: true,
    stdStreams,
    envKeys,
    request,
    approved,
    dom: { htmlNamespace, mathNamespace, fraction: fraction.localName, children },
    frames,
    denials,
  });
  assert(Buffer.byteLength(result) + 1 <= frameLimits.bytes, 'resultBytes');
  process.stdout.write(`${result}\n`);
}

// Run only inside the caller-owned OS isolation scope: successful forbidden operations fail this probe.
main().catch((error) => {
  process.exitCode = 1;
  process.stdout.write(`${JSON.stringify({ accepted: false, error: String(error) })}\n`);
});
