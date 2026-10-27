// Fixed supervision oracle. No library, plugin, or product credentials.
import { connectHost } from '../../../packages/client/dist/host.js';

let input = '';
for await (const bytes of process.stdin) {
  input += bytes;
  if (Buffer.byteLength(input) > 8192) throw new Error('bootstrap too large');
}
const bootstrap = JSON.parse(input);
const mode = process.argv[2] ?? 'normal';
if (mode === 'wrong-instance') bootstrap.hostInstanceId = 'wrong-instance';
let session;
let lateRejected = false;
const timer = setInterval(() => {}, 1000);
try {
  session = await connectHost(bootstrap, {
    scope: 'fixed-host',
    async initialize() {
      if (mode === 'no-ready') await new Promise(() => {});
      if (mode === 'startup-error') throw new Error('fixed startup failure');
    },
    async invoke(method, value, callback) {
      if (method === 'echo') return callback('sample.read', value);
      if (method === 'read-with-callback') {
        void callback('sample.read', value).catch(() => {});
        await new Promise(setImmediate);
        return value;
      }
      if (method === 'late-result') return { value: lateRejected ? 1 : 0 };
      if (method === 'late-callback') {
        setImmediate(
          () =>
            void callback('sample.write', value).catch(() => {
              lateRejected = true;
            }),
        );
        return value;
      }
      if (method === 'read-writes') return callback('sample.write', value);
      if (method === 'outside-scope') return callback('sample.read', { value: value.value + 1 });
      if (method === 'write-with-callback') {
        void callback('sample.write', value).catch(() => {});
        return value;
      }
      if (method === 'drop') {
        session.close();
        await new Promise(() => {});
      }
      if (method === 'wait') {
        await callback('sample.read', value);
        return new Promise(() => {});
      }
      throw new Error('fixed unknown method');
    },
    async shutdown() {
      if (mode === 'shutdown-timeout') return new Promise(() => {});
      if (mode === 'shutdown-unknown') return 'unknown';
      clearInterval(timer);
      return 'closed';
    },
  });
  await session.closed;
} finally {
  clearInterval(timer);
}
