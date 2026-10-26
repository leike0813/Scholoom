import { type CallContext, OperationError } from '@scholoom/protocol/core';
import {
  type ResourceDescriptor,
  type ResourceDocumentInputs,
  type ResourceDocumentOutputs,
  type ResourceInputs,
  type ResourceLocator,
  type ResourceOutputs,
  type ResourcePortFactory,
  type ResourcePorts,
  type ResourceRef,
  resourceFormatForName,
} from '@scholoom/protocol/resources';

type DocumentMethod = keyof ResourceDocumentInputs;
export interface ResourceParser {
  run(
    load: (signal: AbortSignal) => Promise<ArrayBuffer>,
    format: 'pdf' | 'epub' | 'html',
    method: DocumentMethod,
    input: ResourceDocumentInputs[DocumentMethod],
    options: { signal?: AbortSignal | undefined; verify: () => Promise<void> },
  ): Promise<ResourceDocumentOutputs[DocumentMethod]>;
}
const changed = () => new OperationError('contentChanged', '资源内容已变化，请重新打开并核对。');
/** Resource orchestration owns no project, attachment, permission or draft records. */
export class ResourceAccess {
  private readonly pending = new Map<string, { controller: AbortController; owner: string }>();
  constructor(
    private readonly ports: ResourcePortFactory,
    private readonly parser: ResourceParser,
  ) {}

  private renderPort(ports: ResourcePorts) {
    if (ports.target) throw new OperationError('permissionDenied', '产物不开放跨项目读取。');
    if (!ports.render) throw new OperationError('unavailable', '产物资源提供者不可用。');
    return ports.render;
  }

  private async projectLocation(
    ports: ResourcePorts,
    locator: Extract<ResourceLocator, { source: 'project' }>,
  ) {
    if (ports.target) {
      if (!locator.fileId)
        throw new OperationError('permissionDenied', '目标读取必须使用已登记的文件身份。');
      const result = await ports.target['project.readTarget']({
        targetProjectId: locator.projectId,
        request: { kind: 'describe', fileId: locator.fileId },
      });
      if (result.kind !== 'describe')
        throw new OperationError('unavailable', '目标描述不符合请求。');
      return result;
    }
    if (!locator.fileId) {
      if (!locator.path) throw new OperationError('invalidRequest', '缺少项目文件定位。');
      const source = await ports.project['project.material']({
        projectId: locator.projectId,
        path: locator.path,
      });
      return { fileId: source.fileId, path: locator.path };
    }
    const [location] = await ports.project['files.resolve']({
      projectId: locator.projectId,
      fileIds: [locator.fileId],
    });
    if (location?.state !== 'present' || location.kind !== 'file')
      throw new OperationError('notFound', '文件已回收或缺失。');
    return location;
  }
  async describe(locator: ResourceLocator, context: CallContext): Promise<ResourceDescriptor> {
    const ports = this.ports(context);
    if (locator.source === 'render') {
      return this.renderPort(ports).describe(locator);
    }
    if (locator.source === 'project') {
      const location = await this.projectLocation(ports, locator);
      const bytes = await this.projectBytes(ports, {
        projectId: locator.projectId,
        fileId: location.fileId,
        limit: 1,
      });
      const kind = resourceFormatForName(bytes.path);
      return {
        ref: { source: 'project', projectId: locator.projectId, fileId: location.fileId },
        name: bytes.path.split('/').at(-1) ?? bytes.path,
        path: bytes.path,
        basis: bytes.basis,
        format: kind,
        capabilities: {
          read: true,
          write: !ports.target && kind === 'text' && bytes.size <= 262144,
          readingRecords: false,
          render: /\.(md|markdown|qmd|tex)$/i.test(bytes.path),
        },
      };
    }
    const attachment = await ports.library['library.attachment']({
      attachmentId: locator.attachmentId,
    });
    if (attachment.materialVersionId !== locator.materialVersionId) throw changed();
    let readable = false;
    let unavailableReason = attachment.error?.message;
    try {
      const bytes = await ports.library['library.readAttachment']({
        attachmentId: locator.attachmentId,
        limit: 1,
      });
      if (bytes.materialVersionId !== locator.materialVersionId) throw changed();
      readable = true;
    } catch (error) {
      if (error instanceof OperationError && error.code === 'permissionDenied') throw error;
      unavailableReason = error instanceof Error ? error.message : '附件材料当前不可读。';
    }
    const status = await ports.library['library.status']({});
    if (!status.read) throw new OperationError('permissionDenied', '文献库读取未授权。');
    return {
      ref: locator,
      name: attachment.name,
      basis: locator.materialVersionId,
      format: resourceFormatForName(attachment.name),
      ...(!readable ? { unavailableReason: unavailableReason ?? '附件材料当前不可读。' } : {}),
      capabilities: {
        read: readable,
        write: false,
        readingRecords: true,
        render: false,
      },
    };
  }
  private async verify(ports: ResourcePorts, ref: ResourceRef, basis: string) {
    if (ref.source === 'render') {
      const descriptor = await this.renderPort(ports).describe(ref);
      if (descriptor.basis !== basis) throw changed();
      return;
    }
    if (ref.source === 'project') {
      await this.projectBytes(ports, {
        projectId: ref.projectId,
        fileId: ref.fileId,
        basis,
        limit: 1,
      });
    } else {
      const value = await ports.library['library.readAttachment']({
        attachmentId: ref.attachmentId,
        limit: 1,
      });
      if (value.materialVersionId !== ref.materialVersionId || basis !== ref.materialVersionId)
        throw changed();
    }
  }
  private async projectBytes(
    ports: ResourcePorts,
    input: Parameters<ResourcePorts['project']['files.readBytes']>[0],
  ) {
    if (!ports.target) {
      const { basis, ...request } = input;
      const result = await ports.project['files.readBytes']({
        ...request,
        ...(basis === undefined ? {} : { resourceBasis: basis }),
      });
      return { ...result, basis: result.resourceBasis };
    }
    const { projectId, fileId, basis, offset, limit } = input;
    let currentBasis = basis;
    if (!currentBasis) {
      const descriptor = await ports.target['project.readTarget']({
        targetProjectId: projectId,
        request: { kind: 'describe', fileId },
      });
      if (descriptor.kind !== 'describe')
        throw new OperationError('unavailable', '目标描述不符合请求。');
      currentBasis = descriptor.basis;
    }
    const result = await ports.target['project.readTarget']({
      targetProjectId: projectId,
      request: {
        kind: 'readBytes',
        fileId,
        basis: currentBasis,
        ...(offset === undefined ? {} : { offset }),
        ...(limit === undefined ? {} : { limit }),
      },
    });
    if (result.kind !== 'readBytes')
      throw new OperationError('unavailable', '目标字节不符合请求。');
    return result;
  }
  async read(
    input: ResourceInputs['resources.read'],
    context: CallContext,
  ): Promise<ResourceOutputs['resources.read']> {
    const { ref, basis, encoding, offset = 0, limit = 262144 } = input;
    const ports = this.ports(context);
    await this.verify(ports, ref, basis);
    if (ref.source === 'render') {
      const value = await this.renderPort(ports).read(input);
      await this.verify(ports, ref, basis);
      return value;
    }
    if (encoding === 'base64') {
      if (ref.source === 'project') {
        const value = await this.projectBytes(ports, {
          projectId: ref.projectId,
          fileId: ref.fileId,
          basis,
          offset,
          limit,
        });
        return {
          ref,
          basis,
          data: value.data,
          offset,
          size: value.size,
          unit: 'byte',
          truncated: false,
          ...(value.nextOffset === undefined ? {} : { nextOffset: value.nextOffset }),
        };
      }
      const value = await ports.library['library.readAttachment']({
        attachmentId: ref.attachmentId,
        offset,
        limit,
      });
      await this.verify(ports, ref, basis);
      return {
        ref,
        basis,
        data: value.base64,
        offset,
        size: value.byteLength,
        unit: 'byte',
        truncated: false,
        ...(value.nextOffset === undefined ? {} : { nextOffset: value.nextOffset }),
      };
    }
    let content: string;
    let truncated = false;
    if (ref.source === 'project' && !ports.target) {
      const location = await this.projectLocation(ports, ref);
      const source = await ports.project['files.read']({
        projectId: ref.projectId,
        path: location.path,
      });
      if (source.fileId !== ref.fileId) throw changed();
      content = source.content;
      truncated = source.truncated;
    } else {
      const value =
        ref.source === 'project'
          ? await this.projectBytes(ports, {
              projectId: ref.projectId,
              fileId: ref.fileId,
              basis,
              limit: 262144,
            })
          : await ports.library['library.readAttachment']({
              attachmentId: ref.attachmentId,
              limit: 262144,
            });
      truncated = value.nextOffset !== undefined;
      try {
        content = new TextDecoder('utf8', { fatal: true }).decode(
          Buffer.from('base64' in value ? value.base64 : value.data, 'base64'),
          { stream: truncated },
        );
      } catch {
        throw new OperationError('invalidRequest', '资源不是有效的 UTF-8 文本。');
      }
      if (content.includes('\0'))
        throw new OperationError('invalidRequest', '资源不是 UTF-8 文本。');
    }
    if (offset > content.length) throw new OperationError('invalidRequest', '文本位置超出范围。');
    await this.verify(ports, ref, basis);
    const end = Math.min(content.length, offset + limit);
    return {
      ref,
      basis,
      data: content.slice(offset, end),
      offset,
      size: content.length,
      unit: 'utf16',
      truncated,
      ...(end < content.length ? { nextOffset: end } : {}),
    };
  }
  async save(
    input: ResourceInputs['resources.save'],
    context: CallContext,
  ): Promise<ResourceDescriptor> {
    const { ref, basis, content } = input;
    if (ref.source !== 'project')
      throw new OperationError('permissionDenied', '附件正文为只读材料。');
    const ports = this.ports(context);
    await this.verify(ports, ref, basis);
    const descriptor = await this.describe(ref, context);
    if (!descriptor.capabilities.write)
      throw new OperationError('permissionDenied', '此资源不提供正文保存。');
    if (descriptor.basis !== basis) throw changed();
    const location = await this.projectLocation(ports, ref);
    const source = await ports.project['files.read']({
      projectId: ref.projectId,
      path: location.path,
    });
    if (source.fileId !== ref.fileId) throw changed();
    await this.verify(ports, ref, basis);
    const saved = await ports.project['project.saveFile']({
      projectId: ref.projectId,
      path: location.path,
      content,
      basis: source.basis,
      expectedFileId: ref.fileId,
      resourceBasis: basis,
    });
    if (saved.fileId !== ref.fileId || !saved.basis)
      throw new OperationError('outcomeUnknown', '保存已执行，但实际身份或依据未确认。');
    const published = await ports.project['files.readBytes']({
      projectId: ref.projectId,
      fileId: ref.fileId,
      basis: saved.basis,
      limit: 1,
    });
    return { ...descriptor, path: published.path, basis: published.resourceBasis };
  }
  cancel(requestId: string, context: CallContext): { ok: true } {
    const pending = this.pending.get(requestId);
    const owner = `${context.principal.kind}:${context.principal.id}:${context.moduleId}`;
    if (pending && pending.owner !== owner)
      throw new OperationError('permissionDenied', '不能中止其他调用方的资源读取。');
    pending?.controller.abort();
    return { ok: true };
  }
  async document(
    input: ResourceInputs['resources.document'],
    context: CallContext,
  ): Promise<ResourceOutputs['resources.document']> {
    if (!input.requestId) return this.readDocument(input, context);
    if (this.pending.has(input.requestId))
      throw new OperationError('invalidRequest', '资源读取身份已在使用。');
    if (this.pending.size >= 64) throw new OperationError('resourceLimit', '资源读取已达到容量。');
    const controller = new AbortController();
    this.pending.set(input.requestId, {
      controller,
      owner: `${context.principal.kind}:${context.principal.id}:${context.moduleId}`,
    });
    const signal = context.signal
      ? AbortSignal.any([context.signal, controller.signal])
      : controller.signal;
    try {
      return await this.readDocument(input, { ...context, signal });
    } catch (error) {
      if (signal.aborted) throw new OperationError('shuttingDown', '资源读取已中止。');
      throw error;
    } finally {
      this.pending.delete(input.requestId);
    }
  }
  private async readDocument(
    input: ResourceInputs['resources.document'],
    context: CallContext,
  ): Promise<ResourceOutputs['resources.document']> {
    context.signal?.throwIfAborted();
    const { ref, basis, request } = input;
    const ports = this.ports(context);
    await this.verify(ports, ref, basis);
    const descriptor = await this.describe(ref, context);
    context.signal?.throwIfAborted();
    if (descriptor.basis !== basis) throw changed();
    if (ref.source === 'library') {
      // The domain remains authoritative for attachment parsing and version checks.
      const call = ports.library[`library.${request.method}`] as (value: object) => Promise<object>;
      const value = await call({
        ...request.input,
        attachmentId: ref.attachmentId,
        materialVersionId: ref.materialVersionId,
      });
      const {
        attachmentId: _attachment,
        materialVersionId: _version,
        ...payload
      } = value as Record<string, unknown>;
      await this.verify(ports, ref, basis);
      return payload as ResourceOutputs['resources.document'];
    }
    const kind = descriptor.format;
    if (!['pdf', 'epub', 'html'].includes(kind))
      throw new OperationError('invalidRequest', '此资源不支持文档解析。');
    if ((kind === 'pdf') !== ['pdfInfo', 'readPdfPage'].includes(request.method))
      throw new OperationError('invalidRequest', '文档格式与读取方式不匹配。');
    const load = async (signal: AbortSignal) => {
      const parts: Buffer[] = [];
      let offset = 0;
      for (;;) {
        signal.throwIfAborted();
        const value = await this.read(
          {
            ref,
            basis,
            encoding: 'base64',
            offset,
            limit: 262144,
          },
          context,
        );
        parts.push(Buffer.from(value.data, 'base64'));
        if (value.nextOffset === undefined) break;
        if (value.nextOffset <= offset) throw new OperationError('unavailable', '资源读取未推进。');
        offset = value.nextOffset;
      }
      const bytes = Buffer.concat(parts);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    };
    return this.parser.run(load, kind as 'pdf' | 'epub' | 'html', request.method, request.input, {
      signal: context.signal,
      verify: () => this.verify(ports, ref, basis),
    });
  }
}
