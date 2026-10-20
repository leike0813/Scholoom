import { constants } from 'node:fs';
import {
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, extname, join, posix, resolve, sep } from 'node:path';
import { fileFingerprint, privateDirectory } from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import type { ProjectMaterial } from '@scholoom/protocol/projects';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parse, stringify } from 'yaml';

export const relativeFile = (base: string, name: string) => {
  const value = posix.normalize(posix.join(posix.dirname(base), name.replaceAll('\\', '/')));
  if (
    !value ||
    value === '..' ||
    value.startsWith('../') ||
    posix.isAbsolute(name) ||
    /^[a-z]:/i.test(name)
  )
    throw new OperationError('permissionDenied', '资源超出项目范围。');
  return value;
};

/** Native paths originate only from the project material authority. */
export async function readMaterial(material: ProjectMaterial, limit = 8388608): Promise<Buffer> {
  const handle = await open(material.nativePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || fileFingerprint(before) !== material.basis)
      throw new OperationError('contentChanged', '材料在读取前已变化。');
    if (before.size > BigInt(limit)) throw new OperationError('tooLarge', '排版资源超过读取容量。');
    const content = await handle.readFile();
    if (fileFingerprint(await handle.stat({ bigint: true })) !== material.basis)
      throw new OperationError('contentChanged', '材料在读取中已变化。');
    return content;
  } finally {
    await handle.close();
  }
}

const passiveKeys = new Set([
  'title',
  'subtitle',
  'author',
  'date',
  'lang',
  'abstract',
  'keywords',
  'bibliography',
  'csl',
  'references',
  'link-citations',
  'toc',
  'number-sections',
  'documentclass',
  'classoption',
  'fontsize',
  'geometry',
  'papersize',
  'linestretch',
  'mainfont',
  'sansfont',
  'monofont',
  'reference-doc',
  'fig-cap-location',
  'tbl-cap-location',
  'cite-method',
  'biblio-title',
]);
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function frontMatter(text: string): { metadata: Record<string, unknown>; body: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/);
  return match
    ? {
        metadata: object(parse(match[1] ?? '', { maxAliasCount: 100 })),
        body: text.slice(match[0].length),
      }
    : { metadata: {}, body: text };
}
export function passiveMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => passiveKeys.has(key)));
}

type MarkdownNode = {
  type: string;
  url?: string;
  identifier?: string;
  alt?: string;
  children?: MarkdownNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
};
const markdownParser = unified().use(remarkParse).use(remarkGfm);
function passiveMarkdown(body: string) {
  const tree = markdownParser.parse(body) as MarkdownNode;
  const definitions = new Map<string, string>();
  const resources: string[] = [];
  const replacements: { from: number; to: number; text: string }[] = [];
  const walk = (node: MarkdownNode, visitor: (node: MarkdownNode) => void) => {
    visitor(node);
    for (const child of node.children ?? []) walk(child, visitor);
  };
  walk(tree, (node) => {
    if (node.type === 'definition' && node.identifier && node.url)
      definitions.set(node.identifier.toLowerCase(), node.url);
  });
  walk(tree, (node) => {
    const url =
      node.type === 'image'
        ? node.url
        : node.type === 'imageReference'
          ? definitions.get(node.identifier?.toLowerCase() ?? '')
          : undefined;
    if (url && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) resources.push(decodeURIComponent(url));
    if (node.type !== 'html' && (!url || !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url))) return;
    const from = node.position?.start.offset;
    const to = node.position?.end.offset;
    if (from !== undefined && to !== undefined)
      replacements.push({
        from,
        to,
        text: node.type === 'html' ? '（原始 HTML 未展示）' : `${node.alt ?? ''}（外部图片未加载）`,
      });
  });
  for (const replacement of replacements.sort((a, b) => b.from - a.from))
    body = body.slice(0, replacement.from) + replacement.text + body.slice(replacement.to);
  return { body, resources };
}

export async function atomicRecord(path: string, value: unknown): Promise<void> {
  await privateDirectory(dirname(path));
  const candidate = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(candidate, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  await rename(candidate, path);
}
export async function readRecord<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new OperationError('unavailable', '排版记录无法读取，请保留现场核查。');
  }
}
export async function readOutput(root: string, path: string, offset: number, limit: number) {
  const target = await realpath(resolve(root, path));
  if (!target.startsWith(`${resolve(root)}${sep}`))
    throw new OperationError('permissionDenied', '产物资源越界。');
  const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new OperationError('invalidRequest', '产物不是普通文件。');
    const buffer = Buffer.alloc(Math.min(limit, Math.max(0, info.size - offset)));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
    return {
      base64: buffer.subarray(0, bytesRead).toString('base64'),
      byteLength: info.size,
      ...(offset + bytesRead < info.size ? { nextOffset: offset + bytesRead } : {}),
    };
  } finally {
    await handle.close();
  }
}

export async function snapshot(
  input: string,
  directory: string,
  material: (path: string) => Promise<ProjectMaterial>,
  format: 'html' | 'pdf' | 'docx',
) {
  const seen = new Set<string>();
  const dependencies: { path: string; basis: string }[] = [];
  const diagnostics: { code: string; message: string; path?: string }[] = [];
  let bytes = 0;
  let fileId = '';
  let basis = '';
  let config: Record<string, unknown> = {};
  const document = /\.(md|markdown|qmd)$/i.test(input);
  if (document) {
    const folders = posix
      .dirname(input)
      .split('/')
      .filter((part) => part !== '.');
    if (folders.length > 32) throw new OperationError('resourceLimit', '稿件目录层级超过32层。');
    for (let depth = 0; depth <= folders.length; depth++) {
      const configPath = posix.join(...folders.slice(0, depth), '_quarto.yml');
      try {
        const source = await material(configPath);
        const data = await readMaterial(source, 262144);
        bytes += data.length;
        const loaded = object(parse(data.toString('utf8'), { maxAliasCount: 100 }));
        dependencies.push({ path: configPath, basis: source.basis });
        const output = object(object(loaded.format)[format]);
        const selected = { ...loaded, ...output };
        for (const key of ['bibliography', 'csl', 'reference-doc']) {
          const relative = (value: unknown) =>
            typeof value === 'string'
              ? posix.relative(posix.dirname(input), relativeFile(configPath, value))
              : value;
          if (selected[key] !== undefined)
            selected[key] = Array.isArray(selected[key])
              ? selected[key].map(relative)
              : relative(selected[key]);
        }
        config = { ...config, ...selected };
      } catch (error) {
        if (
          !(error instanceof OperationError && error.code === 'notFound') &&
          (error as NodeJS.ErrnoException).code !== 'ENOENT'
        )
          throw error;
      }
    }
  }
  const visit = async (path: string, optional = false): Promise<void> => {
    if (seen.has(path)) return;
    if (dependencies.length >= 100)
      throw new OperationError('resourceLimit', '排版依赖超过100项。');
    seen.add(path);
    let source: ProjectMaterial;
    try {
      source = await material(path);
    } catch (error) {
      if (optional && error instanceof OperationError && error.code === 'notFound') return;
      throw error;
    }
    let data = await readMaterial(source);
    if (path === input) {
      fileId = source.fileId;
      basis = source.basis;
    }
    bytes += data.length;
    if (bytes > 33554432) throw new OperationError('resourceLimit', '排版依赖总量超过32MiB。');
    dependencies.push({ path, basis: source.basis });
    const extension = extname(path).toLowerCase();
    const references: string[] = [];
    if (['.qmd', '.md', '.markdown'].includes(extension)) {
      const parsed = frontMatter(data.toString('utf8'));
      const selected = { ...parsed.metadata, ...object(object(parsed.metadata.format)[format]) };
      const metadata = path === input ? { ...config, ...selected } : selected;
      for (const key of [
        'filters',
        'extensions',
        'pre-render',
        'post-render',
        'engine',
        'execute',
      ]) {
        if (metadata[key] !== undefined || object(metadata.project)[key] !== undefined)
          diagnostics.push({
            code: 'executionExcluded',
            message: `普通预览未运行工程配置：${key}`,
            path,
          });
      }
      const passive = passiveMetadata(metadata);
      for (const key of ['bibliography', 'csl', 'reference-doc']) {
        const values = Array.isArray(passive[key]) ? passive[key] : [passive[key]];
        for (const value of values) if (typeof value === 'string') references.push(value);
      }
      // Only the render snapshot changes; the manuscript remains untouched.
      const { body, resources } = passiveMarkdown(parsed.body);
      references.push(...resources);
      for (const match of body.matchAll(/\{\{<\s*include\s+["']?([^\s"'>]+)["']?\s*>\}\}/g))
        if (match[1]) references.push(match[1]);
      const common = {
        ...passive,
        execute: { enabled: false, eval: false },
        'latex-auto-install': false,
      };
      data = Buffer.from(`---\n${stringify(common)}---\n${body}`);
    } else if (['.tex', '.sty', '.cls'].includes(extension)) {
      const text = data.toString('utf8');
      for (const match of text.matchAll(
        /\\(input|include|bibliography|addbibresource|includegraphics)(?:\[[^\]]*\])?\{([^}]+)\}/g,
      )) {
        for (let name of (match[2] ?? '').split(',')) {
          if (!extname(name))
            name +=
              match[1] === 'bibliography'
                ? '.bib'
                : match[1] === 'includegraphics'
                  ? '.png'
                  : '.tex';
          references.push(name);
        }
      }
    }
    const target = join(directory, path);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, data, { mode: 0o600 });
    for (const reference of references)
      await visit(relativeFile(/\.(tex|sty|cls)$/i.test(path) ? '__tex_root__' : path, reference));
  };
  await visit(input);
  if (document) {
    await writeFile(
      join(directory, '.scholoom-passive.lua'),
      `function RawBlock() return {} end\nfunction RawInline() return {} end\nfunction Image(image)\n  local src = image.src\n  if src:match('^%a[%w+.-]*:') or src:match('^[/\\\\]') then return pandoc.Str(image.caption and pandoc.utils.stringify(image.caption) or '') end\n  return image\nend\n`,
    );
    await writeFile(
      join(directory, '_quarto.yml'),
      stringify({
        project: { type: 'default' },
        execute: { enabled: false },
        filters: ['.scholoom-passive.lua'],
        format: {
          html: {
            'html-math-method': 'mathml',
            'embed-resources': true,
            'code-tools': false,
            'code-copy': false,
          },
          pdf: { 'latex-auto-install': false, 'pdf-engine-opts': ['-no-shell-escape'] },
          docx: {},
        },
      }),
    );
  }
  return { fileId, basis, dependencies, diagnostics };
}

export const outputSize = async (path: string) => (await stat(path)).size;

export async function outputStorageSize(root: string): Promise<number> {
  let total = 0;
  let entries = 0;
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > 16) throw new OperationError('resourceLimit', '排版产物目录层级过深。');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (++entries > 1000) throw new OperationError('resourceLimit', '排版产物文件超过1000项。');
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path, depth + 1);
      else if (entry.isFile()) total += (await stat(path)).size;
      else throw new OperationError('invalidRequest', '排版产物包含非普通文件。');
      if (total > 134217728) throw new OperationError('resourceLimit', '排版产物总量超过128MiB。');
    }
  };
  await visit(root, 0);
  return total;
}
