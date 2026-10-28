import { isDeepStrictEqual } from 'node:util';
import { OperationError } from '@scholoom/protocol/core';
import { type ReportSnapshot, reportLimits } from '@scholoom/protocol/reports';
import type {
  ResourceDescriptor,
  ResourceEvidence,
  ResourcePort,
} from '@scholoom/protocol/resources';
import { decodeReportHeader, reportHeaderStart } from './report-codec.js';
import { relativeFile } from './resources.js';

type Evidence = Pick<ResourceDescriptor, 'ref' | 'basis'>;
export type ReportResourcePorts = Pick<ResourcePort, 'describe' | 'read'> & {
  /** Bound by the host; path descriptions must enforce private and native-link scope. */
  authorize(evidence: readonly ResourceEvidence[], access: 'read' | 'send'): Promise<void>;
};
const changed = () => new OperationError('contentChanged', '报告或其声明材料已变化。');
const denied = () => new OperationError('permissionDenied', '报告资源不在允许范围。');

/** Validates one complete report without owning files, authorization or a persistent cache. */
export class ReportResources {
  constructor(private readonly ports: ReportResourcePorts) {}

  async isReport(entry: Evidence): Promise<boolean> {
    await this.ports.authorize([entry], 'read');
    const resource = await this.verify(entry);
    if (resource.ref.source !== 'project' || resource.format !== 'html') return false;
    const head = await this.read(entry, reportHeaderStart.length + 3, true);
    await this.ports.authorize([entry], 'read');
    return new TextDecoder('utf-8').decode(head.bytes).startsWith(reportHeaderStart);
  }

  private async verify(evidence: Evidence) {
    const resource = await this.ports.describe(evidence.ref);
    if (!isDeepStrictEqual(resource.ref, evidence.ref) || resource.basis !== evidence.basis)
      throw changed();
    if (!resource.capabilities.read) throw denied();
    return resource;
  }

  private async read(evidence: Evidence, maximum: number, prefix = false) {
    let offset = 0;
    const chunks: Buffer[] = [];
    for (;;) {
      const limit = Math.min(262144, maximum - offset);
      const result = await this.ports.read({ ...evidence, encoding: 'base64', offset, limit });
      if (!isDeepStrictEqual(result.ref, evidence.ref) || result.basis !== evidence.basis)
        throw changed();
      if (
        result.unit !== 'byte' ||
        result.offset !== offset ||
        !Number.isSafeInteger(result.size) ||
        result.size < 0
      )
        throw new OperationError('invalidRequest', '报告字节分片无效。');
      if (!prefix && result.size > maximum)
        throw new OperationError('tooLarge', '报告资源超过容量。');
      const chunk = Buffer.from(result.data, 'base64');
      if (chunk.length > limit || result.truncated)
        throw new OperationError('tooLarge', '报告资源分片不完整。');
      chunks.push(chunk);
      offset += chunk.length;
      if ((prefix && offset === maximum) || result.nextOffset === undefined) {
        if ((!prefix || offset < maximum) && offset !== result.size) throw changed();
        return { bytes: Buffer.concat(chunks), size: result.size };
      }
      if (!chunk.length || result.nextOffset !== offset || offset >= maximum) throw changed();
    }
  }

  private async each<T>(items: readonly T[], action: (item: T) => Promise<void>) {
    let next = 0;
    // A failed candidate waits for its already-started reads before returning.
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(items.length, reportLimits.parallelReads) }, async () => {
        while (next < items.length) await action(items[next++] as T);
      }),
    );
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  }

  async snapshot(entry: Evidence, access: 'read' | 'send' = 'read'): Promise<ReportSnapshot> {
    return (await this.load(entry, access, false)).snapshot;
  }

  async freeze(entry: Evidence, access: 'read' | 'send' = 'read') {
    return this.load(entry, access, true);
  }

  async historical(resource: ResourceDescriptor, content: string, access: 'read' | 'send') {
    const bytes = Buffer.from(content);
    if (bytes.length > reportLimits.entryBytes)
      throw new OperationError('tooLarge', '报告入口超过容量。');
    const matches = (locator: unknown) => isDeepStrictEqual(locator, resource.ref);
    const history = new ReportResources({
      authorize: (evidence, mode) => this.ports.authorize(evidence, mode),
      describe: async (locator) => {
        const current = await this.ports.describe(locator);
        if (!matches(locator)) return current;
        if (!matches(current.ref) || !current.capabilities.read) throw denied();
        return { ...resource, capabilities: { ...current.capabilities, write: false } };
      },
      read: async (input) => {
        if (!matches(input.ref)) return this.ports.read(input);
        if (input.basis !== resource.basis) throw changed();
        const offset = input.offset ?? 0;
        const end = Math.min(bytes.length, offset + (input.limit ?? 262144));
        return {
          ref: resource.ref,
          basis: resource.basis,
          data: bytes.subarray(offset, end).toString('base64'),
          offset,
          size: bytes.length,
          unit: 'byte',
          truncated: false,
          ...(end < bytes.length ? { nextOffset: end } : {}),
        };
      },
    });
    return history.snapshot({ ref: resource.ref, basis: resource.basis }, access);
  }

  private async load(entry: Evidence, access: 'read' | 'send', retainBytes: boolean) {
    if (entry.ref.source !== 'project') throw denied();
    const projectId = entry.ref.projectId;
    await this.ports.authorize([entry], access);
    const resource = await this.verify(entry);
    if (resource.format !== 'html' || !resource.path) throw denied();
    const content = await this.read(entry, reportLimits.entryBytes);
    const files: { path: string; bytes: Buffer }[] = retainBytes
      ? [{ path: resource.path, bytes: content.bytes }]
      : [];
    let html: string;
    try {
      html = new TextDecoder('utf-8', { fatal: true }).decode(content.bytes);
    } catch {
      throw new OperationError('invalidRequest', '报告入口必须是UTF-8文本。');
    }
    const manifest = decodeReportHeader(html);
    const evidence = [entry, ...manifest.resources, ...manifest.sources].map(({ ref, basis }) => ({
      ref,
      basis,
    }));
    for (const [index, item] of evidence.entries()) {
      if (
        evidence
          .slice(0, index)
          .some(
            (previous) =>
              isDeepStrictEqual(previous.ref, item.ref) && previous.basis !== item.basis,
          )
      )
        throw changed();
    }
    await this.ports.authorize(evidence, access);
    let loaded = content.size;
    const paths = new Set<string>();
    const dependencies = manifest.resources.map((item) => {
      if (item.ref.source !== 'project' || item.ref.projectId !== projectId) throw denied();
      if (
        !item.path ||
        item.path.startsWith('\\') ||
        /[\0?#]/.test(item.path) ||
        /^[a-z][a-z\d+.-]*:/i.test(item.path)
      )
        throw denied();
      const path = relativeFile(resource.path as string, item.path);
      if (paths.has(path)) throw new OperationError('invalidRequest', '报告依赖路径重复。');
      paths.add(path);
      return { item, path };
    });
    const verifyPath = async ({ item, path }: (typeof dependencies)[number]) => {
      const resolved = await this.ports.describe({ source: 'project', projectId, path });
      if (!isDeepStrictEqual(resolved.ref, item.ref) || resolved.basis !== item.basis)
        throw changed();
      if (!resolved.capabilities.read) throw denied();
      if (
        ['html', 'pdf', 'epub'].includes(resolved.format) ||
        /\.(svg|svgz)$/i.test(resolved.name) ||
        (item.mediaType.startsWith('image/') && resolved.format !== 'image')
      )
        throw denied();
    };
    await this.each(dependencies, async (dependency) => {
      await verifyPath(dependency);
      const value = await this.read(dependency.item, reportLimits.dependencyBytes);
      loaded += value.size;
      if (loaded > reportLimits.loadBytes)
        throw new OperationError('tooLarge', '报告加载集超过容量。');
      await verifyPath(dependency);
      if (retainBytes) files.push({ path: dependency.path, bytes: value.bytes });
    });
    await this.each(manifest.sources, async (source) => {
      const description = await this.verify(source);
      if (isDeepStrictEqual(source.ref, entry.ref)) throw denied();
      if (description.format === 'html') {
        const head = await this.read(source, reportHeaderStart.length + 3, true);
        if (new TextDecoder('utf-8').decode(head.bytes).startsWith(reportHeaderStart))
          throw new OperationError('invalidRequest', '报告来源不能递归引用报告。');
      }
    });
    await this.ports.authorize(evidence, access);
    await this.each(evidence, (item) => this.verify(item).then(() => {}));
    await this.each(dependencies, verifyPath);
    const current = await this.verify(entry);
    if (current.path !== resource.path) throw changed();
    await this.ports.authorize(evidence, access);
    return { snapshot: { resource: current, manifest }, files };
  }
}
