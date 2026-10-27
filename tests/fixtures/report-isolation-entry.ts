/// <reference lib="dom" />

import type { ReportSnapshot } from '../../packages/protocol/dist/report-contracts.js';
import type { ResourceOutputs } from '../../packages/protocol/dist/resources.js';
import { reportFrameProbe } from './report-frame.js';

let current: Awaited<ReturnType<typeof reportFrameProbe>> | undefined;
let previous: typeof current;
let finish: (() => void) | undefined;
let selections = 0;
const parentViolations: Array<{ directive: string; target: string }> = [];
let windowMessages = 0;
let retained: MessagePort | undefined;
const portObservation = { closed: false, closeEventSupported: false, messages: [] as unknown[] };
document.addEventListener('securitypolicyviolation', (event) => {
  if (parentViolations.length < 32)
    parentViolations.push({ directive: event.effectiveDirective, target: event.blockedURI });
});
window.addEventListener('message', (event) => {
  if (event.data?.fixtureWindowProbe === true) windowMessages++;
  if (
    event.data?.fixtureRetainedPort === true &&
    !retained &&
    event.ports.length === 1 &&
    event.source === document.querySelector('iframe')?.contentWindow
  ) {
    retained = event.ports[0];
    if (!retained) return;
    portObservation.closeEventSupported = 'onclose' in retained;
    retained.onmessage = ({ data }) => {
      if (portObservation.messages.length < 16) portObservation.messages.push(data);
    };
    retained.addEventListener('close', () => {
      portObservation.closed = true;
    });
    retained.start();
  }
});
Reflect.set(window, 'isolationFixture', {
  async mount(
    snapshot: ReportSnapshot,
    files: ResourceOutputs['resources.read'][],
    strict: boolean,
  ) {
    current?.dispose();
    previous = current;
    const root = document.getElementById('fixture');
    if (!root) throw Error('Missing isolation fixture root');
    current = await reportFrameProbe(root, snapshot, files, strict, () => {
      selections++;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    return current.binding;
  },
  status: () => ({
    current: current?.stats,
    previous: previous?.stats,
    sourceURL: current?.sourceURL,
    selections,
    parentViolations,
    windowMessages,
    portObservation,
    hasRetainedPort: !!retained,
  }),
  retainedSend: (message: object) => retained?.postMessage(message),
  close: () => {
    current?.dispose();
    retained?.close();
  },
  finish: () => finish?.(),
  restore: (browse: object) => current?.restore(browse),
});
