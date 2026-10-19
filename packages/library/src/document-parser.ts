import { posix } from 'node:path';
import { OperationError } from '@scholoom/protocol/core';
import {
  type DocumentNode,
  documentNodeSchema,
  type LibraryInputs,
  type LibraryOutputs,
} from '@scholoom/protocol/library';
import { DOMParser, type Node as XmlNode } from '@xmldom/xmldom';
import { type DefaultTreeAdapterTypes, parse } from 'parse5';
import { type Entry, fromBuffer, type ZipFile } from 'yauzl';

export type DocumentMethod =
  | 'library.documentInfo'
  | 'library.readDocumentSection'
  | 'library.searchDocument'
  | 'library.readDocumentResource';
export type DocumentRequest = {
  [M in DocumentMethod]: {
    kind: 'document';
    format: 'epub' | 'html';
    method: M;
    input: LibraryInputs[M];
  };
}[DocumentMethod];
const MAX_DOCUMENT = 8 * 1024 * 1024;
const MAX_EXPANDED = 256 * 1024 * 1024;
const MAX_IMAGE = 1024 * 1024;
function invalid(message: string): never {
  throw new OperationError('invalidRequest', message);
}
function tooLarge(): never {
  throw new OperationError('tooLarge', '文档或解析结果超出读取容量。');
}

type SourceNode = {
  tag: string;
  value: string;
  attrs: Record<string, string>;
  children: SourceNode[];
};
function xml(bytes: Uint8Array, content = false) {
  const value = decode(bytes);
  try {
    return new DOMParser({
      onError: (level) => {
        if (level !== 'warning') invalid('XML材料损坏。');
      },
    }).parseFromString(value, content ? 'application/xhtml+xml' : 'application/xml');
  } catch {
    return invalid('XML材料损坏。');
  }
}
function decode(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_DOCUMENT) tooLarge();
  let encoding = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  else {
    const head = Buffer.from(bytes.subarray(0, 1024)).toString('latin1');
    const declaration = /^\s*<\?xml\b[^?]*\bencoding\s*=\s*["']([\w-]+)/i.exec(head)?.[1];
    const prefix = htmlSource(parse(head));
    const find = (node: SourceNode): string | undefined => {
      if (node.tag === 'meta') {
        if (node.attrs.charset) return node.attrs.charset;
        if (node.attrs['http-equiv']?.toLowerCase() === 'content-type')
          return /charset\s*=\s*([\w-]+)/i.exec(node.attrs.content ?? '')?.[1];
      }
      return node.children.map(find).find(Boolean);
    };
    encoding = declaration ?? find(prefix) ?? encoding;
  }
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return invalid('文档文字编码不支持或内容损坏。');
  }
}
function xmlElements(root: XmlNode, name: string): XmlNode[] {
  const result: XmlNode[] = [];
  const stack = [root];
  let count = 0;
  while (stack.length) {
    if (++count > 100000) tooLarge();
    const node = stack.pop();
    if (!node) break;
    if (node.nodeType === 1 && (node.localName ?? node.nodeName) === name) result.push(node);
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const child = node.childNodes.item(i);
      if (child) stack.push(child);
    }
  }
  return result;
}
function attribute(node: XmlNode, name: string): string {
  return node.nodeType === 1
    ? ((node as unknown as { getAttribute(name: string): string | null }).getAttribute(name) ?? '')
    : '';
}
function xmlSource(node: XmlNode, depth = 0, budget = { nodes: 0 }): SourceNode {
  if (depth > 64 || ++budget.nodes > 100000) tooLarge();
  const attrs: Record<string, string> = {};
  const element = node as unknown as {
    attributes?: { length: number; item(i: number): { name: string; value: string } | null };
  };
  for (let i = 0; i < (element.attributes?.length ?? 0); i++) {
    const a = element.attributes?.item(i);
    if (a) attrs[a.name] = a.value;
  }
  return {
    tag:
      node.nodeType === 3 || node.nodeType === 4
        ? 'text'
        : (node.localName ?? node.nodeName).toLowerCase(),
    value: node.nodeValue ?? '',
    attrs,
    children: Array.from({ length: node.childNodes.length }, (_, i) => node.childNodes.item(i))
      .filter((n): n is XmlNode => n !== null)
      .map((n) => xmlSource(n, depth + 1, budget)),
  };
}
function htmlSource(
  node: DefaultTreeAdapterTypes.Node,
  depth = 0,
  budget = { nodes: 0 },
): SourceNode {
  if (depth > 64 || ++budget.nodes > 100000) tooLarge();
  return {
    tag: node.nodeName === '#text' ? 'text' : node.nodeName,
    value: 'value' in node ? node.value : '',
    attrs: Object.fromEntries('attrs' in node ? node.attrs.map((a) => [a.name, a.value]) : []),
    children:
      'childNodes' in node ? node.childNodes.map((n) => htmlSource(n, depth + 1, budget)) : [],
  };
}

function archivePath(base: string, value: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value.split('#')[0]?.split('?')[0] ?? '');
  } catch {
    return invalid('文档资源路径无效。');
  }
  if (
    !decoded ||
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    /^[a-z][a-z\d+.-]*:/i.test(decoded) ||
    decoded.startsWith('/')
  )
    return invalid('文档资源路径无效。');
  const path = posix.normalize(posix.join(posix.dirname(base), decoded));
  if (path === '..' || path.startsWith('../') || path.length > 1024)
    return invalid('文档资源超出容器。');
  return path;
}

class Archive {
  private constructor(
    readonly file: ZipFile,
    readonly entries: Map<string, Entry>,
  ) {}
  static async open(bytes: Buffer): Promise<Archive> {
    const file = await new Promise<ZipFile>((resolve, reject) =>
      fromBuffer(
        bytes,
        { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true },
        (error, value) => (error || !value ? reject(error) : resolve(value)),
      ),
    );
    try {
      const entries = await new Promise<Map<string, Entry>>((resolve, reject) => {
        const map = new Map<string, Entry>();
        let expanded = 0;
        let count = 0;
        file.on('error', reject);
        file.on('entry', (entry: Entry) => {
          try {
            if (++count > 10000) tooLarge();
            expanded += entry.uncompressedSize;
            if (expanded > MAX_EXPANDED) tooLarge();
            if (
              entry.fileName.includes('\0') ||
              map.has(entry.fileName) ||
              posix.normalize(entry.fileName).replace(/\/$/, '') !==
                entry.fileName.replace(/\/$/, '')
            )
              invalid('ZIP条目名称重复或无效。');
            map.set(entry.fileName, entry);
            file.readEntry();
          } catch (error) {
            reject(error);
          }
        });
        file.once('end', () => resolve(map));
        file.readEntry();
      });
      return new Archive(file, entries);
    } catch (error) {
      file.close();
      throw error;
    }
  }
  async read(name: string, limit = MAX_DOCUMENT): Promise<Buffer> {
    const entry = this.entries.get(name);
    if (!entry) return invalid('文档所引用的容器条目缺失。');
    if (entry.isEncrypted()) return invalid('暂不支持加密文档正文。');
    if (entry.uncompressedSize > limit) tooLarge();
    return new Promise<Buffer>((resolve, reject) =>
      this.file.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          reject(error);
          return;
        }
        const chunks: Buffer[] = [];
        let length = 0;
        stream.on('error', reject);
        stream.on('data', (chunk: Buffer) => {
          length += chunk.length;
          if (length > limit) {
            stream.destroy(new OperationError('tooLarge', '资源展开超限。'));
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => resolve(Buffer.concat(chunks, length)));
      }),
    );
  }
  close() {
    this.file.close();
  }
}

type Section = { id: string; title: string };
class Publication {
  private archive: Archive | undefined;
  sections: Section[] = [];
  title = '';
  private encrypted = new Set<string>();
  constructor(
    private readonly bytes: Buffer,
    readonly format: 'html' | 'epub',
  ) {}
  async initialize() {
    if (this.format === 'html') {
      const tree = parse(decode(this.bytes));
      const source = htmlSource(tree);
      const title = (node: SourceNode): string =>
        node.tag === 'title' ? allText(node) : (node.children.map(title).find(Boolean) ?? '');
      this.title = title(source).trim().slice(0, 1024);
      this.sections = [{ id: 'document', title: this.title || '网页' }];
      return;
    }
    this.archive = await Archive.open(this.bytes);
    const root = xml(await this.archive.read('META-INF/container.xml'));
    const rootfile = xmlElements(root, 'rootfile').find(
      (node) => attribute(node, 'media-type') === 'application/oebps-package+xml',
    );
    if (!rootfile) return invalid('EPUB缺少包文档。');
    const opfPath = archivePath('container.xml', attribute(rootfile, 'full-path'));
    const opf = xml(await this.archive.read(opfPath));
    const pkg = xmlElements(opf, 'package')[0];
    if (!pkg || !/^[23]\./.test(attribute(pkg, 'version'))) invalid('EPUB版本不支持。');
    if (
      xmlElements(opf, 'meta').some(
        (node) =>
          attribute(node, 'property') === 'rendition:layout' &&
          node.textContent?.trim() === 'pre-paginated',
      ) ||
      xmlElements(opf, 'itemref').some((node) =>
        attribute(node, 'properties').includes('pre-paginated'),
      )
    )
      invalid('暂不支持固定版式EPUB。');
    this.title = (xmlElements(opf, 'title')[0]?.textContent ?? '').trim().slice(0, 1024);
    const items = xmlElements(opf, 'item');
    const manifest = new Map(items.map((item) => [attribute(item, 'id'), item]));
    const refs = xmlElements(opf, 'itemref');
    if (!refs.length) invalid('EPUB缺少阅读顺序。');
    for (const ref of refs) {
      const item = manifest.get(attribute(ref, 'idref'));
      if (!item) invalid('EPUB阅读顺序引用缺失。');
      if (
        attribute(item, 'media-type') !== 'application/xhtml+xml' &&
        attribute(item, 'media-type') !== 'text/html'
      )
        invalid('EPUB章节格式不支持。');
      const id = archivePath(opfPath, attribute(item, 'href'));
      if (this.sections.some((s) => s.id === id)) invalid('EPUB章节身份重复。');
      this.sections.push({ id, title: attribute(item, 'id').slice(0, 1024) });
    }
    const nav = items.find((item) => attribute(item, 'properties').split(/\s+/).includes('nav'));
    const spine = xmlElements(opf, 'spine')[0];
    const ncx = spine ? manifest.get(attribute(spine, 'toc')) : undefined;
    if (nav) {
      const navPath = archivePath(opfPath, attribute(nav, 'href'));
      const document = xml(await this.archive.read(navPath), true);
      const toc = xmlElements(document, 'nav').find((n) =>
        attribute(n, 'epub:type').split(/\s+/).includes('toc'),
      );
      if (toc)
        for (const link of xmlElements(toc, 'a')) {
          const href = attribute(link, 'href');
          if (!href || /^[a-z][a-z\d+.-]*:/i.test(href)) continue;
          const section = this.sections.find((s) => s.id === archivePath(navPath, href));
          if (section) section.title = (link.textContent ?? section.title).trim().slice(0, 1024);
        }
    } else if (ncx) {
      const navPath = archivePath(opfPath, attribute(ncx, 'href'));
      const document = xml(await this.archive.read(navPath));
      for (const point of xmlElements(document, 'navPoint')) {
        const content = xmlElements(point, 'content')[0];
        if (!content) continue;
        const section = this.sections.find(
          (s) => s.id === archivePath(navPath, attribute(content, 'src')),
        );
        if (section)
          section.title = (xmlElements(point, 'text')[0]?.textContent ?? section.title)
            .trim()
            .slice(0, 1024);
      }
    }
    if (this.archive.entries.has('META-INF/encryption.xml')) {
      const encryption = xml(await this.archive.read('META-INF/encryption.xml'));
      for (const ref of xmlElements(encryption, 'CipherReference'))
        this.encrypted.add(archivePath('encryption.xml', attribute(ref, 'URI')));
    }
  }
  async section(id: string) {
    if (!this.sections.some((section) => section.id === id)) invalid('章节引用无效。');
    if (this.encrypted.has(id)) invalid('暂不支持加密文档正文。');
    const archive = this.archive;
    if (this.format === 'epub' && !archive) invalid('文档容器不可用。');
    const source =
      this.format === 'html'
        ? htmlSource(parse(decode(this.bytes)))
        : xmlSource(xml(await (archive ?? invalid('文档容器不可用。')).read(id), true));
    return normalize(
      source,
      (href) => this.link(id, href),
      (src) => {
        if (/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)) return src;
        if (
          this.format !== 'epub' ||
          !src ||
          /^[a-z][a-z\d+.-]*:/i.test(src) ||
          src.startsWith('//')
        )
          return undefined;
        try {
          const path = archivePath(id, src);
          return this.archive?.entries.has(path) ? path : undefined;
        } catch {
          return undefined;
        }
      },
    );
  }
  private link(section: string, href: string) {
    if (/^(https?:|mailto:)/i.test(href)) return href.length <= 4096 ? href : undefined;
    if (!href || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) return undefined;
    const [path, fragment = ''] = href.split('#');
    try {
      const target = path ? (this.format === 'epub' ? archivePath(section, path) : '') : section;
      return this.sections.some((s) => s.id === target)
        ? `${encodeURIComponent(target)}#${fragment}`
        : undefined;
    } catch {
      return undefined;
    }
  }
  async resource(
    section: string,
    resourceId: string,
  ): Promise<{
    bytes: Buffer;
    mimeType: LibraryOutputs['library.readDocumentResource']['mimeType'];
  }> {
    const document = await this.section(section);
    const source = document.resources.get(resourceId);
    if (!source) invalid('资源引用无效。');
    let bytes: Buffer;
    if (/^data:/i.test(source)) {
      const encoded = source.slice(source.indexOf(',') + 1);
      if (encoded.length > Math.ceil(MAX_IMAGE / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
        tooLarge();
      bytes = Buffer.from(encoded, 'base64');
    } else bytes = await (this.archive ?? invalid('文档容器不可用。')).read(source, MAX_IMAGE);
    if (bytes.length > MAX_IMAGE) tooLarge();
    const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? 'image/png'
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        ? 'image/jpeg'
        : /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'))
          ? 'image/gif'
          : bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
              bytes.subarray(8, 12).toString('ascii') === 'WEBP'
            ? 'image/webp'
            : undefined;
    if (!mimeType) return invalid('图片格式不支持。');
    return { bytes, mimeType };
  }
  close() {
    this.archive?.close();
  }
}
function allText(node: SourceNode): string {
  return node.tag === 'text' ? node.value : node.children.map(allText).join('');
}
const allowed = new Set<string>(documentNodeSchema.properties.tag.enum);
const dropped = new Set([
  'head',
  'script',
  'style',
  'template',
  'noscript',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'video',
  'audio',
  'svg',
]);
const blocks = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
  'pre',
  'tr',
]);
function normalize(
  source: SourceNode,
  link: (href: string) => string | undefined,
  resource: (src: string) => string | undefined,
) {
  const nodes: DocumentNode[] = [];
  const resources = new Map<string, string>();
  let text = '';
  const append = (value: string, parent: number) => {
    if (!value) return;
    const start = text.length;
    text += value;
    nodes.push({ tag: 'text', parent, start, end: text.length, text: value });
  };
  const newline = (parent: number) => {
    if (text && !text.endsWith('\n')) append('\n', parent);
  };
  const visit = (source: SourceNode, parent: number, pre: boolean) => {
    if (nodes.length >= 100000) tooLarge();
    if (dropped.has(source.tag)) return;
    if (source.tag === 'text') {
      let value = pre ? source.value.replace(/\r\n?/g, '\n') : source.value.replace(/\s+/gu, ' ');
      if (!pre && (!text || /\s$/u.test(text))) value = value.replace(/^ /, '');
      append(value, parent);
      return;
    }
    const alias =
      source.tag === 'b'
        ? 'strong'
        : source.tag === 'i'
          ? 'em'
          : ['section', 'article', 'figure', 'main'].includes(source.tag)
            ? 'div'
            : source.tag;
    const tag = allowed.has(alias) ? (alias as DocumentNode['tag']) : undefined;
    if (tag && blocks.has(tag)) newline(parent);
    const index = tag ? nodes.length : parent;
    const node: DocumentNode | undefined = tag
      ? { tag, parent, start: text.length, end: text.length }
      : undefined;
    if (node) {
      const anchor = source.attrs.id;
      if (anchor && anchor.length <= 1024) node.anchor = anchor;
      if (tag === 'a') {
        const href = link(source.attrs.href ?? '');
        if (href) node.href = href;
      }
      if (tag === 'img') {
        node.alt = (source.attrs.alt || '图片').slice(0, 1024);
        const src = resource(source.attrs.src ?? '');
        if (src) {
          node.resourceId = `image:${resources.size}`;
          resources.set(node.resourceId, src);
        }
      }
      nodes.push(node);
    }
    if (tag === 'br') append('\n', parent);
    for (const child of source.children) visit(child, index, pre || tag === 'pre');
    if (tag === 'td' || tag === 'th') append('\t', index);
    if (tag && blocks.has(tag)) newline(index);
    if (node) node.end = text.length;
  };
  visit(source, -1, false);
  return { text, nodes, resources };
}
function fragment(
  document: Awaited<ReturnType<Publication['section']>>,
  offset: number,
  limit: number,
  textOnly = false,
) {
  const { text, nodes } = document;
  if (
    offset > text.length ||
    offset < 0 ||
    (offset > 0 &&
      /[\uD800-\uDBFF]/.test(text[offset - 1] ?? '') &&
      /[\uDC00-\uDFFF]/.test(text[offset] ?? ''))
  )
    invalid('文字读取位置无效。');
  let end = Math.min(text.length, offset + limit);
  if (
    end < text.length &&
    /[\uD800-\uDBFF]/.test(text[end - 1] ?? '') &&
    /[\uDC00-\uDFFF]/.test(text[end] ?? '')
  )
    end--;
  if (end === offset && offset < text.length) invalid('读取预算不足以容纳一个字符。');
  if (textOnly)
    return {
      offset,
      text: text.slice(offset, end),
      length: text.length,
      nodes: [],
      ...(end < text.length ? { nextOffset: end } : {}),
    };
  for (;;) {
    const result: DocumentNode[] = [];
    const indexes = new Map<number, number>();
    nodes.forEach((node, index) => {
      if (
        node.end < offset ||
        node.start > end ||
        (node.start !== node.end && (node.end <= offset || node.start >= end))
      )
        return;
      const parent = indexes.get(node.parent) ?? -1;
      const start = Math.max(offset, node.start),
        stop = Math.min(end, node.end);
      indexes.set(index, result.length);
      result.push({
        ...node,
        parent,
        start,
        end: stop,
        ...(node.tag === 'text' ? { text: text.slice(start, stop) } : {}),
      });
    });
    const value = {
      offset,
      text: text.slice(offset, end),
      length: text.length,
      nodes: result,
      ...(end < text.length ? { nextOffset: end } : {}),
    };
    if (result.length <= 4096 && Buffer.byteLength(JSON.stringify(value)) <= 512 * 1024)
      return value;
    if (end - offset <= 2) tooLarge();
    end = offset + Math.floor((end - offset) / 2);
    if (/[\uD800-\uDBFF]/.test(text[end - 1] ?? '') && /[\uDC00-\uDFFF]/.test(text[end] ?? ''))
      end--;
  }
}

export async function executeDocument(
  bytes: Buffer,
  request: DocumentRequest,
): Promise<LibraryOutputs[DocumentMethod]> {
  const publication = new Publication(bytes, request.format);
  const reference = {
    attachmentId: request.input.attachmentId,
    materialVersionId: request.input.materialVersionId,
  };
  try {
    await publication.initialize();
    switch (request.method) {
      case 'library.documentInfo': {
        const { offset = 0, limit = 25 } = request.input;
        if (offset > publication.sections.length) invalid('章节分页位置无效。');
        return {
          ...reference,
          format: request.format,
          title: publication.title,
          sectionCount: publication.sections.length,
          sections: publication.sections.slice(offset, offset + limit),
          ...(offset + limit < publication.sections.length ? { nextOffset: offset + limit } : {}),
        };
      }
      case 'library.readDocumentSection': {
        const { sectionId, limit = 16384, anchor } = request.input;
        const document = await publication.section(sectionId);
        let offset = request.input.offset ?? 0;
        if (anchor) {
          const node = document.nodes.find((n) => n.anchor === anchor);
          if (!node) invalid('章节锚点不存在。');
          offset = node.start;
        }
        return {
          ...reference,
          sectionId,
          normalizationVersion: 1,
          ...fragment(document, offset, limit, request.input.textOnly),
        };
      }
      case 'library.searchDocument': {
        const { query, limit = 25 } = request.input;
        const hits: LibraryOutputs['library.searchDocument']['hits'] = [];
        const cursor = request.input.cursor ?? { sectionIndex: 0, offset: 0 };
        if (cursor.sectionIndex >= publication.sections.length) invalid('搜索继续位置无效。');
        const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
        const stop = Math.min(publication.sections.length, cursor.sectionIndex + 16);
        for (let index = cursor.sectionIndex; index < stop; index++) {
          const section = publication.sections[index];
          if (!section) invalid('搜索章节无效。');
          const document = await publication.section(section.id);
          pattern.lastIndex = index === cursor.sectionIndex ? cursor.offset : 0;
          if (pattern.lastIndex > document.text.length) invalid('搜索文字位置无效。');
          for (
            let match = pattern.exec(document.text);
            match;
            match = pattern.exec(document.text)
          ) {
            hits.push({
              sectionId: section.id,
              start: match.index,
              end: pattern.lastIndex,
              quote: document.text
                .slice(
                  Math.max(0, match.index - 80),
                  Math.min(document.text.length, pattern.lastIndex + 80),
                )
                .slice(0, 1024),
            });
            if (hits.length >= limit)
              return {
                ...reference,
                hits,
                complete: false,
                nextCursor: { sectionIndex: index, offset: pattern.lastIndex },
              };
          }
        }
        return {
          ...reference,
          hits,
          complete: stop === publication.sections.length,
          ...(stop < publication.sections.length
            ? { nextCursor: { sectionIndex: stop, offset: 0 } }
            : {}),
        };
      }
      case 'library.readDocumentResource': {
        const { sectionId, resourceId, offset = 0 } = request.input;
        const { bytes, mimeType } = await publication.resource(sectionId, resourceId);
        if (offset > bytes.length) invalid('图片读取位置无效。');
        const end = Math.min(bytes.length, offset + 256 * 1024);
        return {
          ...reference,
          mimeType,
          byteLength: bytes.length,
          offset,
          base64: bytes.subarray(offset, end).toString('base64'),
          ...(end < bytes.length ? { nextOffset: end } : {}),
        };
      }
    }
  } finally {
    publication.close();
  }
}
