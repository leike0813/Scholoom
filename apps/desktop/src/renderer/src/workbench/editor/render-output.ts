import type { KernelClient } from '@scholoom/client';

export async function outputBytes(
  client: KernelClient,
  projectId: string,
  outputId: string,
  resource?: string,
  signal?: AbortSignal,
) {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (;;) {
    signal?.throwIfAborted();
    const result = await client.call('editor.output', {
      projectId,
      outputId,
      offset,
      ...(resource ? { resource } : {}),
    });
    signal?.throwIfAborted();
    if (result.byteLength > (resource ? 8388608 : 67108864))
      throw new Error('排版产物超过读取容量。');
    parts.push(Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0)));
    if (result.nextOffset === undefined) return new Blob(parts);
    if (result.nextOffset <= offset) throw new Error('产物读取位置未推进。');
    offset = result.nextOffset;
  }
}

export async function renderedHtml(
  client: KernelClient,
  projectId: string,
  outputId: string,
  blob: Blob,
  signal: AbortSignal,
) {
  const document = new DOMParser().parseFromString(await blob.text(), 'text/html');
  const urls: string[] = [];
  const cache = new Map<string, Promise<string>>();
  const asset = (path: string): Promise<string> => {
    let current = cache.get(path);
    if (!current) {
      if (cache.size >= 100) return Promise.reject(new Error('排版资源超过100项。'));
      current = outputBytes(client, projectId, outputId, path, signal).then((bytes) => {
        const extension = path.split('.').at(-1)?.toLowerCase();
        const types: Record<string, string> = {
          css: 'text/css',
          svg: 'image/svg+xml',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          webp: 'image/webp',
          woff2: 'font/woff2',
          woff: 'font/woff',
          gif: 'image/gif',
        };
        const url = URL.createObjectURL(
          new Blob([bytes], { type: types[extension ?? ''] ?? 'application/octet-stream' }),
        );
        urls.push(url);
        return url;
      });
      cache.set(path, current);
    }
    return current;
  };
  const local = (value: string) => value && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(value);
  try {
    for (const node of document.querySelectorAll(
      'script,iframe,object,embed,base,form,meta[http-equiv],link:not([rel="stylesheet"])',
    ))
      node.remove();
    for (const node of document.querySelectorAll('*')) {
      for (const attribute of [...node.attributes])
        if (/^on/i.test(attribute.name) || ['srcdoc', 'srcset', 'ping'].includes(attribute.name))
          node.removeAttribute(attribute.name);
    }
    for (const node of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
      const path = node.getAttribute('href') ?? '';
      if (local(path)) {
        const cssBlob = await outputBytes(client, projectId, outputId, path, signal);
        let css = await cssBlob.text();
        const replacements = new Map<string, string>();
        for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
          const value = match[1] ?? '';
          if (local(value)) {
            const relative = new URL(value, `https://local.invalid/${path}`).pathname.slice(1);
            try {
              replacements.set(match[0], `url("${await asset(relative)}")`);
            } catch {
              replacements.set(match[0], 'none');
            }
          }
        }
        for (const [before, after] of replacements) css = css.replaceAll(before, after);
        const style = document.createElement('style');
        style.textContent = css;
        node.replaceWith(style);
      } else node.remove();
    }
    for (const node of document.querySelectorAll<HTMLImageElement>('img')) {
      const path = node.getAttribute('src') ?? '';
      if (local(path)) {
        try {
          node.src = await asset(path);
        } catch {
          node.removeAttribute('src');
        }
      } else if (!path.startsWith('data:image/')) node.removeAttribute('src');
    }
    for (const node of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = node.getAttribute('href') ?? '';
      if (/^(https?:|mailto:)/i.test(href)) {
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
      } else if (!href.startsWith('#')) node.removeAttribute('href');
    }
    const csp = document.createElement('meta');
    csp.httpEquiv = 'Content-Security-Policy';
    csp.content =
      "default-src 'none'; img-src blob: data:; style-src 'unsafe-inline'; font-src blob: data:; script-src 'none'; connect-src 'none'; form-action 'none'";
    document.head.prepend(csp);
    return {
      html: `<!doctype html>\n${document.documentElement.outerHTML}`,
      release: () => {
        for (const url of urls) URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    for (const url of urls) URL.revokeObjectURL(url);
    throw error;
  }
}
