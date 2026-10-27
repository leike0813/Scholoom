/// <reference lib="dom" />
// This code is saved as an actual report script; it does not run in the trusted parent.
export function reportProbeScript(): string {
  return `(${pageProbes.toString()})();`;
}
function pageProbes() {
  const bridge = Reflect.get(window, 'reportProbe');
  const violations: Array<{ directive: string; target: string }> = [];
  document.addEventListener('securitypolicyviolation', (event) => {
    if (violations.length < 32)
      violations.push({ directive: event.effectiveDirective, target: event.blockedURI });
  });
  let peer: RTCPeerConnection | undefined;
  let rtc = 'idle';
  Reflect.set(window, 'reportProbes', {
    violations,
    async positive() {
      const image = document.getElementById('pixel') as HTMLImageElement;
      await image.decode();
      await document.fonts.load('16px Probe');
      let parentDOM = false;
      try {
        parentDOM = !!parent.document.body;
      } catch {
        /* opaque origin */
      }
      return {
        image: image.naturalWidth,
        font: [...document.fonts].some((f) => f.family === 'Probe' && f.status === 'loaded'),
        origin: self.origin,
        parentDOM,
        preload: typeof Reflect.get(window, 'scholoomDesktop'),
        node: typeof Reflect.get(window, 'process'),
        require: typeof Reflect.get(window, 'require'),
      };
    },
    async network(base: string) {
      const tasks: Promise<unknown>[] = [];
      const attempted: string[] = [];
      const attempt = (name: string, action: () => Promise<unknown> | void) => {
        attempted.push(name);
        try {
          tasks.push(Promise.resolve(action()).catch(() => {}));
        } catch {
          /* CSP or sandbox refusal */
        }
      };
      attempt('fetch', () => fetch(`${base}/fetch`));
      attempt(
        'xhr',
        () =>
          new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${base}/xhr`);
            xhr.onload = xhr.onerror = () => resolve();
            xhr.send();
          }),
      );
      attempt('beacon', () => {
        navigator.sendBeacon(`${base}/beacon`, 'synthetic');
      });
      attempt(
        'websocket',
        () =>
          new Promise<void>((resolve) => {
            const socket = new WebSocket(`${base.replace('http:', 'ws:')}/ws`);
            socket.onerror = () => resolve();
            socket.onopen = () => {
              socket.close();
              resolve();
            };
          }),
      );
      attempt('image', () => {
        const image = new Image();
        image.src = `${base}/image`;
        return image.decode();
      });
      attempt('font', () => new FontFace('Remote', `url(${base}/font)`).load());
      attempt(
        'stylesheet',
        () =>
          new Promise<void>((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `${base}/css`;
            link.onload = link.onerror = () => resolve();
            document.head.append(link);
          }),
      );
      attempt('import', () => {
        const style = document.createElement('style');
        style.textContent = `@import url('${base}/import');`;
        document.head.append(style);
      });
      attempt(
        'worker',
        () =>
          new Promise<void>((resolve) => {
            const worker = new Worker(`${base}/worker.js`);
            worker.onmessage = worker.onerror = () => {
              worker.terminate();
              resolve();
            };
          }),
      );
      attempt('blob-worker', async () => {
        const url = URL.createObjectURL(
          new Blob([`fetch('${base}/worker-blob').finally(()=>self.postMessage('done'));`], {
            type: 'text/javascript',
          }),
        );
        try {
          await new Promise<void>((resolve) => {
            const worker = new Worker(url);
            worker.onmessage = worker.onerror = () => {
              worker.terminate();
              resolve();
            };
          });
        } finally {
          URL.revokeObjectURL(url);
        }
      });
      attempt('nested', () => {
        const iframe = document.createElement('iframe');
        iframe.src = `${base}/frame`;
        document.body.append(iframe);
      });
      attempt('srcdoc', () => {
        const iframe = document.createElement('iframe');
        iframe.srcdoc = `<img src="${base}/srcdoc">`;
        document.body.append(iframe);
      });
      attempt('object', () => {
        const object = document.createElement('object');
        object.data = `${base}/object`;
        document.body.append(object);
      });
      attempt('form', () => {
        const form = document.createElement('form');
        form.action = `${base}/form`;
        document.body.append(form);
        form.submit();
      });
      let popup = false;
      attempt('popup', () => {
        const opened = window.open(`${base}/popup`);
        popup = !!opened;
        opened?.close();
      });
      attempt(
        'nonce-script',
        () =>
          new Promise<void>((resolve) => {
            const script = document.createElement('script');
            script.nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? '';
            script.src = `${base}/script`;
            script.onload = script.onerror = () => resolve();
            document.body.append(script);
          }),
      );
      await Promise.all(tasks);
      return {
        attempted,
        popup,
        escapedScript: Reflect.get(window, '__externalScriptExecuted') === true,
        settled: true,
      };
    },
    navigate(kind: string, base: string) {
      const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? '';
      const body =
        `<img src="${base}/navigation-image"><link rel="stylesheet" href="${base}/navigation-css"><script nonce="${nonce}">window.navigationProbeRan=true;fetch('${base}/navigation-fetch')</` +
        'script>';
      if (kind === 'http') location.href = `${base}/navigated`;
      if (kind === 'meta') {
        const meta = document.createElement('meta');
        meta.httpEquiv = 'refresh';
        meta.content = `0;url=${base}/redirect`;
        document.head.append(meta);
      }
      if (kind === 'blob') {
        const url = URL.createObjectURL(new Blob([body], { type: 'text/html' }));
        location.href = url;
      }
      if (kind === 'data') location.href = `data:text/html,${encodeURIComponent(body)}`;
      if (kind === 'document') {
        document.open();
        document.write(`<img src="${base}/document-image">`);
        document.close();
      }
    },
    send: (message: object) => bridge.send(message),
    raw: (message: object) => bridge.raw(message),
    binding: bridge.binding,
    retainPort: () => bridge.retainPort(),
    async rtc(url: string) {
      rtc = 'starting';
      try {
        peer = new RTCPeerConnection({ iceServers: [{ urls: url }] });
        peer.onicegatheringstatechange = () => {
          if (peer?.iceGatheringState === 'complete') rtc = 'complete';
        };
        peer.onicecandidateerror = () => {
          rtc = 'error';
        };
        peer.createDataChannel('network-probe');
        await peer.setLocalDescription(await peer.createOffer());
        if (rtc === 'starting') rtc = 'gathering';
      } catch {
        rtc = 'refused';
      }
      return rtc;
    },
    rtcState: () => rtc,
    closeRTC: () => {
      peer?.close();
      rtc = 'closed';
    },
    busy() {
      const start = Date.now();
      while (Date.now() - start < 250) {
        /* finite hostile workload */
      }
      return { start, end: Date.now() };
    },
  });
}
