import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { reportClientDomain } from '../report-client/domain.js';
import type { ConnectedConfiguration } from './types.js';

/** Real existing domain/server; the finite UI controls only invoke authenticated writer RPCs. */
export async function connectedDomain(root: string) {
  const domain = await reportClientDomain(root);
  const session = await domain.writer
    .call('session.create', {
      projectId: domain.project.id,
      title: 'Connected report session',
    })
    .catch(async (error) => {
      await domain.close();
      throw error;
    });
  let latest = domain.entry;
  const configuration: ConnectedConfiguration = {
    endpoint: domain.proxy.endpoint,
    projectId: domain.project.id,
    sessionId: session.id,
    entry: domain.entry,
  };
  const saved = domain.html.replace('Compare dose 10 and 20', 'Compare dose 20 and 30');
  let expectedHtml = domain.html;
  return {
    configuration,
    domain,
    async act(action: string) {
      if (action === 'save') {
        latest = await domain.writer.call('resources.save', {
          ref: latest.ref,
          basis: latest.basis,
          content: saved,
        });
        expectedHtml = saved;
        return { basis: latest.basis };
      }
      if (action === 'publish-without-source') {
        const manifest = {
          ...domain.manifest,
          sources: [],
          objects: domain.manifest.objects.map((value) => ({ ...value, sourceIndexes: [] })),
        };
        const content = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replaceAll('-', '\\u002d')}\n-->\n<html><body>Independent R2 without A</body></html>`;
        latest = await domain.writer.call('resources.save', {
          ref: latest.ref,
          basis: latest.basis,
          content,
        });
        expectedHtml = content;
        return latest;
      }
      if (action === 'advance-dependency') {
        const dependency = domain.manifest.resources[0];
        if (!dependency) throw new Error('Independent dependency is missing');
        return domain.writer.call('resources.save', {
          ref: dependency.ref,
          basis: dependency.basis,
          content: '[30,40]',
        });
      }
      if (action === 'revoke' || action === 'grant') {
        await domain.writer.call('library.grant', {
          read: action === 'grant',
          write: action === 'grant',
          send: false,
          autoBackup: false,
        });
        return { changed: true };
      }
      throw new Error('Unsupported fixed report control');
    },
    async facts() {
      let reportError: string | null = null;
      try {
        await domain.writer.call('resources.report', { ref: latest.ref, basis: latest.basis });
      } catch (error) {
        reportError =
          error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unexpected';
      }
      return {
        projectId: domain.project.id,
        sessionId: session.id,
        entry: domain.entry,
        latest,
        source: domain.source,
        html: await readFile(join(domain.project.path, 'report.html'), 'utf8'),
        expectedHtml,
        reportError,
        rpc: domain.facts(),
      };
    },
    close: domain.close,
  };
}
