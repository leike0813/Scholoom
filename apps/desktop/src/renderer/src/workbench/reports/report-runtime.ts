import type { KernelClient } from '@scholoom/client';
import { createReportPresentation, createReportStyleAssets } from '@scholoom/editor';
import { limits, OperationError } from '@scholoom/protocol/core';
import {
  isReportBridgeMessage,
  isReportProgramCommand,
  type ReportBridgeMessage,
  type ReportProgramCommand,
  type ReportSnapshot,
  reportLimits,
} from '@scholoom/protocol/reports';
import type { ResourceOutputs } from '@scholoom/protocol/resources';
import { sameResourceRef } from '../resource-controller.js';

type Binding = Pick<ReportBridgeMessage, 'version' | 'viewId' | 'generation' | 'basis'>;
type Request = {
  command: ReportProgramCommand;
  bytes: number;
  resolve(): void;
  reject(error: unknown): void;
};
const unavailable = () => new OperationError('unavailable', '报告视图已失效，请重新检查。');
const address = (path: string) =>
  `scholoom-report://local/${path.split('/').map(encodeURIComponent).join('/')}`;

/** One product connection and frozen execution; no page script runs in this renderer. */
export function createReportRuntime(options: {
  client: KernelClient;
  directory: string;
  snapshot: ReportSnapshot;
  binding: Binding;
  initialState?:
    | Pick<
        Extract<ReportBridgeMessage, { type: 'state' | 'restore' }>,
        'browse' | 'draft' | 'dirty'
      >
    | undefined;
  container: HTMLElement;
  message(message: ReportBridgeMessage): void;
  failed(error: unknown): void;
}) {
  const { client, directory, container } = options;
  const binding = { ...options.binding };
  const key = { viewId: binding.viewId, generation: binding.generation };
  const instanceId = client.getSnapshot().status?.instanceId;
  const queue: Request[] = [];
  let queueBytes = 0;
  let closed = false;
  let failed = false;
  let opened = false;
  let requested = false;
  let pumping = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let presentation: ReturnType<typeof createReportPresentation> | undefined;
  let assets: ReturnType<typeof createReportStyleAssets> | undefined;
  let starting: Promise<ResourceOutputs['resources.reportOpen']> | undefined;
  const check = () => {
    const state = client.getSnapshot();
    if (
      closed ||
      failed ||
      state.phase !== 'connected' ||
      state.status?.dataDirectory !== directory ||
      !instanceId ||
      state.status.instanceId !== instanceId
    )
      throw unavailable();
  };
  const stop = () => client.call('resources.reportStop', key);
  const rejectQueue = (error: unknown) => {
    for (const request of queue.splice(0)) {
      queueBytes -= request.bytes;
      request.reject(error);
    }
  };
  function fail(error: unknown) {
    if (closed || failed) return;
    failed = true;
    clearTimeout(timer);
    rejectQueue(error);
    presentation?.invalidate(error);
    if (requested) void stop().catch(() => {});
    options.failed(error);
  }
  function schedule() {
    if (!closed && !failed && opened && !pumping)
      timer = setTimeout(
        () => {
          void pump();
        },
        queue.length ? 0 : 32,
      );
  }
  async function pump() {
    if (closed || failed || pumping || !opened) return;
    clearTimeout(timer);
    pumping = true;
    const request = queue.shift();
    try {
      check();
      const result = await client.call('resources.reportExchange', {
        ...key,
        ...(request ? { command: request.command } : {}),
      });
      check();
      for (const packet of result.packets) presentation?.receive(packet);
      check();
      request?.resolve();
    } catch (error) {
      request?.reject(error);
      fail(error);
    } finally {
      if (request) queueBytes -= request.bytes;
      pumping = false;
      schedule();
    }
  }
  function send(command: ReportProgramCommand): Promise<void> {
    try {
      check();
      if (!isReportProgramCommand(command))
        throw new OperationError('invalidRequest', '报告命令无效。');
      const bytes = new TextEncoder().encode(JSON.stringify(command)).byteLength;
      // A complete initial state can coexist with the presentation's bounded send window.
      if (queue.length >= 32 || queueBytes + bytes > 2 * reportLimits.bridgeBytes)
        throw new OperationError('resourceLimit', '报告输入积压超过容量。');
      queueBytes += bytes;
      return new Promise<void>((resolve, reject) => {
        queue.push({ command, bytes, resolve, reject });
        if (!pumping) {
          clearTimeout(timer);
          schedule();
        }
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  async function start() {
    check();
    const restored = options.initialState
      ? { ...options.initialState, ...binding, type: 'restore' as const }
      : undefined;
    if (restored && !isReportBridgeMessage(restored))
      throw new OperationError('tooLarge', '原草稿超过恢复容量，已保留原草稿。');
    requested = true;
    const result = await client.call('resources.reportOpen', {
      ...key,
      entry: { ref: options.snapshot.resource.ref, basis: binding.basis },
    });
    opened = true;
    if (closed || failed) {
      void stop().catch(() => {});
      throw unavailable();
    }
    check();
    if (
      !sameResourceRef(result.snapshot.resource.ref, options.snapshot.resource.ref) ||
      result.snapshot.resource.basis !== binding.basis ||
      !result.snapshot.resource.path ||
      result.status.stopConfirmed ||
      result.status.failure
    )
      throw unavailable();
    // The accepted OS start can precede the running receipt and usable data channel.
    let status = result.status;
    const deadline = performance.now() + limits.lifecycleMs;
    while (status.phase === 'starting' && !status.failure && !status.stopConfirmed) {
      if (performance.now() >= deadline)
        throw new OperationError('outcomeUnknown', '报告启动结果尚未确认，请重新检查。');
      await new Promise((resolve) => setTimeout(resolve, 32));
      check();
      status = await client.call('resources.reportGet', key);
      check();
      if (status.instanceId !== result.status.instanceId) throw unavailable();
    }
    if (status.failure) throw new OperationError(status.failure.code, status.failure.message);
    if (status.phase !== 'running' || !status.gateReleased || status.stopConfirmed)
      throw unavailable();
    const baseURL = address(result.snapshot.resource.path);
    const files = [];
    let total = 0;
    for (const item of result.snapshot.manifest.resources) {
      if (
        ['text/javascript', 'application/javascript', 'application/json'].includes(item.mediaType)
      )
        continue;
      const url = new URL(item.path, baseURL).href;
      const file = result.files.find((file) => address(file.path) === url);
      if (
        !file ||
        file.byteLength > reportLimits.dependencyBytes ||
        total + file.byteLength > reportLimits.loadBytes
      )
        throw new OperationError('resourceLimit', '报告冻结资源超过呈现容量。');
      total += file.byteLength;
      const bytes = new Uint8Array(file.byteLength);
      let offset = 0;
      while (offset < file.byteLength) {
        check();
        const part = await client.call('resources.reportRead', {
          ...key,
          path: file.path,
          offset,
          limit: 262144,
        });
        check();
        const chunk = Uint8Array.from(atob(part.base64), (char) => char.charCodeAt(0));
        if (
          part.size !== file.byteLength ||
          part.offset !== offset ||
          !chunk.length ||
          offset + chunk.length > bytes.length ||
          (part.nextOffset !== undefined
            ? part.nextOffset !== offset + chunk.length
            : offset + chunk.length !== bytes.length)
        )
          throw new OperationError('contentChanged', '报告冻结资源读取不完整。');
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      files.push({ url, bytes, mediaType: item.mediaType });
    }
    check();
    assets = createReportStyleAssets(files);
    presentation = createReportPresentation({
      document: container.ownerDocument,
      binding,
      styles: { baseURL, resolve: assets.resolve },
      send,
      message: (message) => {
        if (!closed && !failed) options.message(message);
      },
      failed: fail,
    });
    presentation.element.className = 'render-html';
    container.append(presentation.element);
    await presentation.ready;
    check();
    const native = presentation.element.contentDocument?.defaultView;
    if (!native) throw unavailable();
    const cssProperties = Array.from(
      native.getComputedStyle(native.document.documentElement),
    ).filter((key) => /^-?[-a-z][a-z0-9-]*$/.test(key));
    const events = new Set<string>();
    for (
      let prototype = native.HTMLElement.prototype;
      prototype;
      prototype = Object.getPrototypeOf(prototype)
    )
      for (const key of Object.getOwnPropertyNames(prototype))
        if (/^on[a-z]+$/.test(key)) events.add(key);
    const pending = send({
      ...binding,
      type: 'start',
      ...(restored ? { restorePending: true as const } : {}),
      viewport: [
        Math.min(16384, Math.max(1, container.clientWidth)),
        Math.min(16384, Math.max(1, container.clientHeight)),
      ],
      cssProperties,
      eventProperties: [...events],
    });
    const restoredPending = restored ? send(restored) : undefined;
    schedule();
    await Promise.all([pending, restoredPending]);
    return result;
  }
  return {
    start(): Promise<ResourceOutputs['resources.reportOpen']> {
      starting ??= start().catch((error) => {
        fail(error);
        throw error;
      });
      return starting;
    },
    send,
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      rejectQueue(unavailable());
      presentation?.close();
      assets?.close();
      if (requested) void stop().catch(() => {});
    },
  };
}
