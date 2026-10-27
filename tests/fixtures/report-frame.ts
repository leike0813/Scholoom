/// <reference lib="dom" />
import { isReportBridgeMessage, type ReportBridgeMessage, type ReportSnapshot } from '../../packages/protocol/dist/report-contracts.js';
import type { ResourceOutputs } from '../../packages/protocol/dist/resources.js';

type Bytes = ResourceOutputs['resources.read'];
type Binding = { version: 1; viewId: string; generation: number; basis: string };

// Investigation only. No production tab imports this candidate or grants it kernel access.
export async function reportFrameProbe(
  root: HTMLElement,
  snapshot: ReportSnapshot,
  files: Bytes[],
  strictScripts: boolean,
  select: () => Promise<void>,
) {
  const binding: Binding = { version: 1, viewId: crypto.randomUUID(), generation: 1, basis: snapshot.resource.basis };
  const entry = files.find((file) => file.basis === binding.basis && JSON.stringify(file.ref) === JSON.stringify(snapshot.resource.ref));
  if (!entry || entry.unit !== 'byte' || entry.truncated || entry.nextOffset !== undefined)
    throw Error('Incomplete fixture entry');
  const html = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(entry.data), (c) => c.charCodeAt(0)));
  const base = new URL(snapshot.resource.path ?? snapshot.resource.name, 'https://report.invalid/');
  const assets = snapshot.manifest.resources.map((item, index) => {
    const file = files.find((value) => value.basis === item.basis && JSON.stringify(value.ref) === JSON.stringify(item.ref));
    if (!file || file.unit !== 'byte' || file.truncated || file.nextOffset !== undefined) throw Error('Incomplete fixture dependency');
    return { path: new URL(item.path, base).href, token: `scholoom-probe-asset-${index}`, data: file.data, type: item.mediaType };
  });
  const template = document.createElement('template');
  template.innerHTML = html;
  const scripts: string[] = [];
  const resource = (value: string) => assets.find((asset) => asset.path === new URL(value, base).href)?.token;
  for (const node of template.content.querySelectorAll('base,meta,iframe,frame,object,embed')) node.remove();
  for (const node of template.content.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
    node.removeAttribute('srcset');
    if (node.tagName === 'SCRIPT') {
      if (node.getAttribute('type') === 'application/json') continue;
      if (node.hasAttribute('src')) throw Error('This investigation uses inline report scripts only');
      scripts.push(node.textContent ?? '');
      node.remove();
    } else {
      for (const attr of ['src', 'href', 'action', 'formaction', 'data', 'poster', 'xlink:href']) {
        const value = node.getAttribute(attr);
        if (value !== null) {
          const token = resource(value);
          if (token) node.setAttribute(attr, token);
          else node.removeAttribute(attr);
        }
      }
    }
  }
  for (const style of template.content.querySelectorAll('style')) {
    style.textContent = style.textContent?.replace(/url\(['"]?([^)'"\s]+)['"]?\)/g,
      (_all, path: string) => `url("${resource(path) ?? ''}")`) ?? '';
  }
  const nonce = crypto.randomUUID();
  const policy = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' blob:; img-src blob:; font-src blob:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'`;
  const payload = { binding, nonce, strictScripts, assets, scripts, html: template.innerHTML };
  const source = `(${bootstrap.toString()})(${JSON.stringify(payload).replaceAll('<', '\\u003c')})`;
  const url = URL.createObjectURL(new Blob([`<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}"><script nonce="${nonce}">${source}</script>`], { type: 'text/html' }));
  const iframe = document.createElement('iframe');
  iframe.title = '隔离报告原型';
  iframe.name = 'report-probe';
  iframe.sandbox.add('allow-scripts');
  iframe.referrerPolicy = 'no-referrer';
  iframe.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'");
  const channel = new MessageChannel();
  let active = true, handedOff = false, pending = false;
  let windowStart = performance.now(), requests = 0;
  const stats = { ready: false, accepted: 0, rejected: 0, latest: null as ReportBridgeMessage | null, reason: '', released: false };
  const reply = (message: object) => { if (active) channel.port1.postMessage({ ...binding, ...message }); };
  const reject = (code: 'invalidRequest' | 'resourceLimit' | 'unavailable') => {
    stats.rejected++;
    reply({ type: 'error', error: { code, message: 'Report isolation probe refused the message.' } });
  };
  const dispose = () => {
    if (!active) return;
    active = false;
    channel.port1.close();
    iframe.remove();
    URL.revokeObjectURL(url);
    stats.released = true;
  };
  channel.port1.onmessage = (event) => {
    if (!active) return;
    if (performance.now() - windowStart >= 1000) { windowStart = performance.now(); requests = 0; }
    if (++requests > 10) { reject('resourceLimit'); stats.reason = 'resourceLimit'; dispose(); return; }
    const message: unknown = event.data;
    if (!isReportBridgeMessage(message) || message.viewId !== binding.viewId ||
      message.generation !== binding.generation || message.basis !== binding.basis ||
      !['ready', 'state', 'select'].includes(message.type)) { reject('invalidRequest'); return; }
    if (message.type === 'select') {
      if (pending || message.objectIds.some((id) => !snapshot.manifest.objects.some((item) => item.objectId === id))) {
        reject(pending ? 'resourceLimit' : 'invalidRequest'); return;
      }
      pending = true;
      stats.accepted++;
      void select().then(() => reply({ type: 'queued' }), () => reject('unavailable')).finally(() => { pending = false; });
    } else {
      stats.accepted++;
      stats.latest = message;
      if (message.type === 'ready') stats.ready = true;
    }
  };
  channel.port1.start();
  iframe.onload = () => {
    if (handedOff) { stats.reason = 'navigation'; dispose(); return; }
    handedOff = true;
    iframe.contentWindow?.postMessage({ ...binding, type: 'restore', browse: null, draft: null, dirty: false }, '*', [channel.port2]);
  };
  iframe.src = url;
  root.replaceChildren(iframe);
  return { binding, stats, dispose, restore: (browse: object) => reply({ type: 'restore', browse, draft: null, dirty: false }) };
}

function bootstrap(payload: {
  binding: Binding; nonce: string; strictScripts: boolean; html: string; scripts: string[];
  assets: Array<{ token: string; data: string; type: string }>;
}) {
  if (payload.strictScripts) {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = 'script-src blob:';
    document.head.append(meta);
  }
  let port: MessagePort | undefined;
  const urls: string[] = [];
  const send = (message: object) => port?.postMessage({ ...payload.binding, ...message });
  Reflect.set(window, 'reportProbe', { send, raw: (message: object) => port?.postMessage(message), binding: payload.binding });
  window.addEventListener('pagehide', () => { port?.close(); for (const url of urls) URL.revokeObjectURL(url); });
  window.addEventListener('message', async (event) => {
    if (port || event.source !== parent || event.ports.length !== 1 || event.data?.type !== 'restore' ||
      event.data.viewId !== payload.binding.viewId || event.data.generation !== payload.binding.generation || event.data.basis !== payload.binding.basis) return;
    const bound = event.ports[0];
    if (!bound) return;
    port = bound;
    bound.onmessage = (message) => {
      const value = message.data;
      if (value?.type !== 'restore' || value.viewId !== payload.binding.viewId || value.generation !== payload.binding.generation || value.basis !== payload.binding.basis) return;
      Reflect.get(window, 'probeRestore')?.(value.browse);
    };
    bound.start();
    let html = payload.html;
    for (const asset of payload.assets) {
      const bytes = Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: asset.type }));
      urls.push(url);
      html = html.replaceAll(asset.token, url);
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    document.body.replaceChildren(template.content);
    for (const code of payload.scripts) {
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      urls.push(url);
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.nonce = payload.nonce;
        script.onload = () => resolve();
        script.onerror = () => reject(Error('Fixture report script did not execute'));
        script.src = url;
        document.body.append(script);
      });
    }
    send({ type: 'ready' });
  });
}
