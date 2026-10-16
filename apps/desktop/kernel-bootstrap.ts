import { realpath } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  createDevelopmentKernel,
  defaultDevelopmentDataDirectory,
} from '@scholoom/kernel/bootstrap';
import { isBootstrapRequest } from '@scholoom/protocol';
import { isFileLoadingAllowed, normalizePath, type Plugin, type ResolvedConfig } from 'vite';

export function kernelBootstrap(): Plugin {
  const runtime = resolve(process.env.SCHOOLOOM_DATA_DIR ?? defaultDevelopmentDataDirectory);
  let serving = 0;
  let configuration: ResolvedConfig | undefined;
  const isPrivateRuntime = async (filename: string): Promise<boolean> => {
    try {
      const file = await realpath(filename);
      if (configuration && !isFileLoadingAllowed(configuration, normalizePath(file))) return true;
      const directory = await realpath(runtime);
      const difference = relative(directory, file);
      return (
        difference === '' ||
        (!isAbsolute(difference) && difference !== '..' && !difference.startsWith(`..${sep}`))
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  };
  return {
    name: 'scholoom-kernel-bootstrap',
    enforce: 'pre',
    configResolved(config) {
      configuration = config;
    },
    config() {
      const deny = [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/.scholoom-dev/**',
        '**/.scholoom/**',
        '**/runtime/endpoint*',
        '**/runtime/lifecycle.sqlite*',
        '**/runtime/kernel.log',
      ];
      return { server: { fs: { deny } } };
    },
    async load(id) {
      if (!id.startsWith('\0') && (await isPrivateRuntime(id.split('?')[0] ?? ''))) {
        this.error('Private kernel runtime cannot be served.');
      }
      return null;
    },
    async configureServer(server) {
      const kernel = createDevelopmentKernel({
        dataDirectory: runtime,
        nodeExecutable: process.env.SCHOOLOOM_NODE_EXECUTABLE ?? process.execPath,
      });
      const initial = await kernel.bootstrap('ensure');
      if (initial.state !== 'running') {
        if (serving > 0) {
          await kernel.dispose();
          throw new Error('Development kernel handover failed; previous server retained.');
        }
        console.warn('Kernel unavailable. Workbench retry is available.');
      }
      serving += 1;
      server.httpServer?.once('close', () => {
        serving -= 1;
        void kernel.dispose();
      });
      server.middlewares.use(async (request, response, next) => {
        try {
          const pathname = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
          const filename = pathname.startsWith('/@fs/')
            ? pathname.slice('/@fs/'.length)
            : resolve(server.config.root, `.${pathname}`);
          const publicFile = server.config.publicDir
            ? resolve(server.config.publicDir, `.${pathname}`)
            : null;
          if (
            (await isPrivateRuntime(filename)) ||
            (publicFile !== null && (await isPrivateRuntime(publicFile)))
          ) {
            response.writeHead(403, { 'Cache-Control': 'no-store' }).end('Private kernel runtime.');
            return;
          }
        } catch {
          response.writeHead(403).end();
          return;
        }
        if (request.url !== '/__scholoom/kernel/bootstrap') {
          next();
          return;
        }
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        const address = server.httpServer?.address() as AddressInfo | null;
        const host = address ? `127.0.0.1:${address.port}` : '';
        const deny = (status: number, code: string, message: string) => {
          response.statusCode = status;
          response.end(JSON.stringify({ state: 'unknown', error: { code, message } }));
        };
        if (
          request.method !== 'POST' ||
          request.headers.host !== host ||
          request.headers.origin !== `http://${host}` ||
          !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '') ||
          request.headers['x-scholoom-bootstrap'] !== '1' ||
          request.headers['content-type'] !== 'application/json'
        ) {
          deny(403, 'permissionDenied', 'Local same-origin bootstrap required.');
          return;
        }
        try {
          let body = '';
          for await (const chunk of request) {
            body += chunk;
            if (Buffer.byteLength(body) > 4096) {
              deny(413, 'invalidRequest', 'Bootstrap request is too large.');
              return;
            }
          }
          const input: unknown = JSON.parse(body);
          if (!isBootstrapRequest(input)) {
            deny(400, 'invalidRequest', 'Invalid bootstrap request.');
            return;
          }
          const result = await kernel.bootstrap(input.mode);
          response.end(JSON.stringify(result));
        } catch {
          deny(400, 'invalidRequest', 'Bootstrap failed.');
        }
      });
    },
  };
}
