import { registerHooks } from 'node:module';
import { Script, constants as vmConstants } from 'node:vm';
import { OperationError } from '@scholoom/protocol/core';
import { isReportBridgeMessage, isReportProgramCommand } from '@scholoom/protocol/reports';
import { ReportRenderOutput } from '../src/report-output.js';
import { reportStyleProperties } from '../src/report-styles.js';
import { TransferrableKeys as K } from '../vendor/worker-dom/src/transfer/TransferrableKeys.js';
import {
  Event,
  eventDispatching,
  eventPassive,
  markNativeEvent,
} from '../vendor/worker-dom/src/worker-thread/Event.js';
import { createWorkerDOM, hydrate } from '../vendor/worker-dom/src/worker-thread/index.js';
import { get } from '../vendor/worker-dom/src/worker-thread/nodes.js';
import {
  consume as consumeStrings,
  store as storeString,
} from '../vendor/worker-dom/src/worker-thread/strings.js';
import { HTMLTextAreaElement } from './textarea.mjs';

const htmlNamespace = 'http://www.w3.org/1999/xhtml';
const refused = () => new OperationError('unavailable', '报告请求的页面能力不可用。');

/** One fresh P process. Node/DOM globals are compatibility adapters; OS isolation is mandatory. */
export function createReportProgram(files, port) {
  let binding;
  let source;
  let failed = false;
  let closed = false;
  let moduleHooks;
  let ready = false;
  let receiveInitialRestore;
  let bridgeMessages = 0;
  const bridgeListeners = new Set();
  const nativeEvents = new WeakSet();
  const output = new ReportRenderOutput({ send: port.send, failed: fail });
  function fail(error) {
    if (failed || closed) return;
    failed = true;
    output.close(error);
    port.failed(error, binding);
  }
  function active() {
    if (closed || failed) throw refused();
  }
  const preventDefault = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function () {
    if (
      nativeEvents.has(this) &&
      this.isTrusted &&
      this[eventDispatching] &&
      this.cancelable &&
      !this[eventPassive]
    ) {
      const error = new OperationError('unavailable', '报告依赖不支持的跨进程同步取消默认动作。');
      fail(error);
      throw error;
    }
    return preventDefault.call(this);
  };
  const bridge = Object.freeze({
    postMessage(value) {
      active();
      if (
        !binding ||
        !value ||
        !['state', 'select'].includes(value.type) ||
        (!ready && value.type === 'select')
      )
        throw refused();
      if (['version', 'viewId', 'generation', 'basis'].some((key) => Object.hasOwn(value, key)))
        throw new OperationError('invalidRequest', '页面动作不能选择视图或报告版本。');
      const message = { ...value, ...binding };
      if (!isReportBridgeMessage(message) || bridgeMessages >= 4)
        throw new OperationError('resourceLimit', '报告桥消息无效或超过容量。');
      bridgeMessages++;
      void port
        .send(message)
        .catch(fail)
        .finally(() => {
          bridgeMessages--;
        });
    },
    addEventListener(type, listener) {
      active();
      if (type !== 'message' || typeof listener !== 'function' || bridgeListeners.size >= 32)
        throw refused();
      bridgeListeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'message') bridgeListeners.delete(listener);
    },
  });

  async function start(command) {
    if (binding) throw refused();
    binding = {
      version: 1,
      viewId: command.viewId,
      generation: command.generation,
      basis: command.basis,
    };
    const restoration = command.restorePending
      ? new Promise((resolve) => {
          receiveInitialRestore = resolve;
        })
      : undefined;
    source = createWorkerDOM(
      (message) => {
        if (failed || closed) return;
        try {
          output.write({
            phase: message[K.phase],
            nodes: new Uint16Array(message[K.nodes]),
            strings: message[K.strings],
            mutations: new Uint16Array(message[K.mutations]),
          });
        } catch (error) {
          fail(error);
        }
      },
      () => {},
      () => {},
    );
    hydrate(
      source.document,
      [],
      {},
      [...new Set([...command.cssProperties, ...reportStyleProperties])],
      command.eventProperties,
      command.viewport,
      { storage: {}, errorMsg: null },
      { storage: {}, errorMsg: null },
    );
    const document = source.document;
    // Parse before observing: scripts are collected, never forwarded to the rendering host.
    document.body.innerHTML = files.html;
    const scripts = [...(document.querySelectorAll('script') ?? [])].map((element, index) => ({
      type: element.getAttribute('type') ?? '',
      src: element.getAttribute('src'),
      defer: element.hasAttribute('defer'),
      async: element.hasAttribute('async'),
      code: element.textContent,
      url: new URL(`#inline-${index}`, files.entryURL).href,
      element,
    }));
    for (const script of scripts) script.element.remove();
    let root = document.body.children.find(
      (element) => element.localName === 'html' && element.namespaceURI === htmlNamespace,
    );
    const head =
      (root ?? document.body).children.find((element) => element.localName === 'head') ??
      document.createElement('head');
    const parsedBody = (root ?? document.body).children.find(
      (element) => element.localName === 'body',
    );
    if (parsedBody) {
      const content = [...parsedBody.childNodes];
      for (const child of [...document.body.childNodes]) child.remove();
      for (const child of content) document.body.appendChild(child);
      for (const attr of parsedBody.attributes)
        document.body.setAttributeNS(attr.namespaceURI ?? htmlNamespace, attr.name, attr.value);
      parsedBody.remove();
    } else if (root) {
      root.remove();
      for (const child of [...root.childNodes]) {
        if (child !== head) document.body.appendChild(child);
      }
    }
    root ??= document.createElement('html');
    root.remove();
    head.remove();
    document.body.remove();
    root.appendChild(head);
    root.appendChild(document.body);
    document.appendChild(root);
    document.documentElement = root;
    document.head = head;
    Object.assign(source, {
      HTMLTextAreaElement,
      scholoomReport: bridge,
      fetch: async (specifier) => files.response(String(specifier)),
    });
    // Node channel events cannot use WorkerDOM's Event with Node's EventTarget.
    for (const name of ['WebSocket', 'EventSource', 'BroadcastChannel'])
      source[name] = class {
        constructor() {
          throw refused();
        }
      };
    for (const [name, value] of Object.entries(source))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    globalThis.window = globalThis.self = globalThis;
    document.defaultView = globalThis;
    const denyNavigation = () => {
      const error = refused();
      fail(error);
      throw error;
    };
    const location = { assign: denyNavigation, replace: denyNavigation, reload: denyNavigation };
    Object.defineProperty(location, 'href', { get: () => files.entryURL, set: denyNavigation });
    for (const target of [source, document, globalThis])
      Object.defineProperty(target, 'location', {
        configurable: false,
        get: () => location,
        set: denyNavigation,
      });
    source.open = globalThis.open = denyNavigation;
    document.write = document.writeln = denyNavigation;

    const nodes = [];
    const mutations = [];
    const childLists = [];
    const stack = [root];
    while (stack.length) {
      const element = stack.pop();
      const id = element[K.index];
      if (![document.body, root, head].includes(element)) nodes.push(...element[K.creationFormat]);
      if (element.nodeType === 1)
        for (const attr of element.attributes)
          mutations.push(
            0,
            id,
            storeString(attr.name),
            storeString(attr.namespaceURI ?? htmlNamespace),
            storeString(attr.value) + 1,
          );
      if (element !== root && element.childNodes.length)
        childLists.push([
          2,
          id,
          0,
          0,
          element.childNodes.length,
          0,
          ...element.childNodes.map((node) => node[K.index]),
        ]);
      stack.push(...[...element.childNodes].reverse());
    }
    document[K.observe]();
    for (const childList of childLists.reverse()) mutations.push(...childList);
    output.write({
      phase: 1,
      nodes: new Uint16Array(nodes),
      strings: consumeStrings(),
      mutations: new Uint16Array(mutations),
      roots: { html: root[K.index], head: head[K.index] },
    });
    await output.drained();
    active();
    const modules = new Map();
    for (const script of scripts) {
      if (!['', 'text/javascript', 'application/javascript', 'module'].includes(script.type))
        throw refused();
      if (script.type === 'module' && !script.src) modules.set(script.url, script.code);
    }
    moduleHooks = registerHooks({
      resolve(specifier, context, next) {
        if (
          !context.parentURL?.startsWith('scholoom-report:') &&
          !specifier.startsWith('scholoom-report:')
        )
          return next(specifier, context);
        const url = new URL(specifier, context.parentURL ?? files.entryURL).href;
        if (!modules.has(url))
          files.text(files.resolve(specifier, context.parentURL ?? files.entryURL), true);
        return { url, shortCircuit: true };
      },
      load(url, context, next) {
        if (!url.startsWith('scholoom-report:')) return next(url, context);
        return {
          format: 'module',
          source: modules.has(url) ? modules.get(url) : files.text(url, true),
          shortCircuit: true,
        };
      },
    });
    const execute = async (script) => {
      active();
      if (script.type === 'module')
        await import(script.src ? files.resolve(script.src) : script.url);
      else {
        const url = script.src ? files.resolve(script.src) : script.url;
        // Main-context evaluation preserves classic globals and the report URL for import().
        new Script(script.src ? files.text(url, true) : script.code, {
          filename: url,
          importModuleDynamically: vmConstants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
        }).runInThisContext();
      }
    };
    const deferred = [];
    for (const script of scripts) {
      if (script.async && (script.src || script.type === 'module'))
        void execute(script).catch(fail);
      else if (script.type === 'module' || (script.src && script.defer)) deferred.push(script);
      else await execute(script);
    }
    for (const script of deferred) await execute(script);
    document.readyState = 'interactive';
    document.dispatchEvent(new source.Event('DOMContentLoaded', { bubbles: true }));
    document.readyState = 'complete';
    source.document.dispatchEvent(new source.Event('load', { bubbles: false }));
    await Promise.resolve();
    await output.drained();
    if (restoration) {
      const restored = await restoration;
      active();
      for (const listener of bridgeListeners) listener({ data: restored });
      await Promise.resolve();
      await output.drained();
    }
    active();
    ready = true;
    await port.send({ ...binding, type: 'ready' });
  }

  async function receive(command) {
    active();
    if (!isReportProgramCommand(command))
      throw new OperationError('invalidRequest', '报告运行命令无效。');
    if (command.type === 'start') {
      void start(command).catch(fail);
      return;
    }
    if (command.type === 'consume') {
      output.consume(command.sequences);
      return;
    }
    if (
      !binding ||
      ['version', 'viewId', 'generation', 'basis'].some((key) => command[key] !== binding[key])
    )
      throw refused();
    if (command.type === 'input') {
      if (!ready) throw refused();
      const input = command.input;
      const node = get(input.nodeId);
      if (!node || !source.document.body.contains(node))
        throw new OperationError('contentChanged', '报告输入节点已失效。');
      // shortcut: the current input contract cannot represent a multiple selection set.
      if (node.localName === 'select' && node.multiple) throw refused();
      source.document[K.allowTransfer] = false;
      try {
        for (const key of ['value', 'checked', 'selectedIndex'])
          if (input[key] !== undefined) node[key] = input[key];
      } finally {
        source.document[K.allowTransfer] = true;
      }
      const event = Object.assign(
        new source.Event(input.eventType, { bubbles: input.bubbles, cancelable: input.cancelable }),
        input,
        { type: input.eventType, target: node },
      );
      nativeEvents.add(event);
      node.dispatchEvent(markNativeEvent(event));
      await Promise.resolve();
      active();
      const receipt = {
        ...binding,
        type: 'inputConfirmed',
        nodeId: input.nodeId,
        revision: input.revision,
        through: output.checkpoint(),
      };
      for (const key of ['value', 'checked', 'selectedIndex'])
        if (input[key] !== undefined) receipt[key] = node[key];
      await port.send(receipt);
      return;
    }
    if (!ready && command.type === 'restore' && receiveInitialRestore) {
      const resolve = receiveInitialRestore;
      receiveInitialRestore = undefined;
      resolve(command);
      return;
    }
    if (!ready || !['restore', 'queued', 'error'].includes(command.type)) throw refused();
    for (const listener of bridgeListeners) listener({ data: command });
  }
  return {
    receive: (command) => receive(command).catch(fail),
    fail,
    close() {
      if (closed) return;
      closed = true;
      output.close();
      bridgeListeners.clear();
      moduleHooks?.deregister();
    },
  };
}
