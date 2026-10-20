import { join, posix } from 'node:path';
import { OperationError } from '@scholoom/protocol/core';
import type { EditorInputs } from '@scholoom/protocol/editor';
import { parse, stringify } from 'yaml';

const OUTPUT_LIMIT = 1_048_576;
const PATH_LIMIT = 100;
const formats = new Set(['markdown', 'gfm', 'commonmark']);
type CSL = {
  id?: string;
  title?: string;
  author?: Array<{ family?: string }>;
  issued?: { 'date-parts'?: number[][] };
  [key: string]: unknown;
};
type Bibliography = { sources: CSL[]; project_biblios: string[] };
type PandocAst = { blocks: unknown[]; 'pandoc-api-version': number[]; heading_ids?: string[] };
type PandocCapabilitiesResult = {
  version: string;
  api_version: number[];
  output_formats: string;
  highlight_languages: string;
};

const valueOptions = new Set([
  '--columns',
  '--dpi',
  '--wrap',
  '--markdown-headings',
  '--reference-location',
]);
const flagOptions = new Set([
  '--atx-headers',
  '--biblatex',
  '--bibtex',
  '--email-obfuscation',
  '--incremental',
  '--listings',
  '--natbib',
  '--no-highlight',
  '--number-sections',
  '--preserve-tabs',
  '--reference-links',
  '--self-contained',
  '--section-divs',
  '--standalone',
  '--strip-comments',
  '--table-of-contents',
]);

type Services = {
  run: (args: readonly string[], input?: string) => Promise<string>;
  read: (path: string) => Promise<string>;
  resources: string;
};

let capabilities: Promise<PandocCapabilitiesResult> | undefined;

function fail(code: ConstructorParameters<typeof OperationError>[0], message: string): never {
  throw new OperationError(code, message);
}

function bounded(text: string): string {
  if (Buffer.byteLength(text, 'utf8') > OUTPUT_LIMIT) fail('tooLarge', '转换结果超出容量。');
  return text;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fail('unavailable', 'Pandoc 返回内容无法解析。');
  }
}

function markdownFormat(format: string | undefined): string {
  const value = format || 'markdown';
  const base = value.split(/[+-]/, 1)[0] ?? '';
  if (!formats.has(base) || !/^(markdown|gfm|commonmark)(?:[+-][a-z][a-z0-9_-]*)*$/.test(value)) {
    return fail('invalidRequest', '转换格式无效。');
  }
  return value;
}

function safeOptions(options: string[] | undefined): string[] {
  const result = options ?? [];
  for (let i = 0; i < result.length; i++) {
    const option = result[i] ?? '';
    const [name, inlineValue] = option.split('=', 2);
    if (name && valueOptions.has(name)) {
      const value = inlineValue ?? result[++i];
      if (!value || value.startsWith('-')) fail('invalidRequest', '转换选项无效。');
      if (
        (name === '--columns' || name === '--dpi') &&
        (!/^\d+$/.test(value) || Number(value) > 10000)
      )
        fail('invalidRequest', '转换选项数值无效。');
      if (name === '--wrap' && !['none', 'auto', 'preserve'].includes(value))
        fail('invalidRequest', '换行选项无效。');
      if (name === '--markdown-headings' && !['atx', 'setext'].includes(value))
        fail('invalidRequest', '标题格式无效。');
      if (name === '--reference-location' && !['block', 'section', 'document'].includes(value))
        fail('invalidRequest', '引用位置无效。');
    } else if (!flagOptions.has(option)) {
      fail('invalidRequest', '转换选项无效。');
    }
  }
  return result;
}

function relativePath(path: string): string {
  const portablePath = path.replaceAll('\\', '/');
  const normalized = posix.normalize(portablePath);
  if (
    !path ||
    path.includes('\0') ||
    posix.isAbsolute(portablePath) ||
    /^[a-z]:/i.test(portablePath) ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    return fail('permissionDenied', '文献路径必须位于项目内。');
  }
  return normalized;
}

async function readLimited(path: string, services: Services): Promise<string> {
  const content = await services.read(relativePath(path));
  if (Buffer.byteLength(content, 'utf8') > OUTPUT_LIMIT) fail('tooLarge', '输入文件超出容量。');
  return content;
}

async function getCapabilities(services: Services): Promise<PandocCapabilitiesResult> {
  capabilities ??= (async () => {
    const results = await Promise.allSettled([
      services.run(['--version']),
      services.run(['--to', 'json'], ' '),
      services.run(['--list-output-formats']),
      services.run(['--list-highlight-languages']),
    ]);
    const unknown = results.find(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof OperationError &&
        result.reason.code === 'outcomeUnknown',
    );
    if (unknown?.status === 'rejected') throw unknown.reason;
    const [version, astText, output_formats, highlight_languages] = results.map((result) => {
      if (result.status === 'rejected') throw result.reason;
      return result.value;
    }) as [string, string, string, string];
    const ast = parseJson<PandocAst>(astText);
    return { version, api_version: ast['pandoc-api-version'], output_formats, highlight_languages };
  })().catch((error: unknown) => {
    capabilities = undefined;
    throw error;
  });
  return capabilities;
}

function metadata(text: string): Record<string, unknown> {
  const match = text.match(/^\s*---\s*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/);
  if (!match) return {};
  const parsed: unknown = parse(match[1] ?? '');
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function bibliographyPaths(value: unknown): string[] {
  const list = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  if (list.length > PATH_LIMIT) fail('resourceLimit', '文献路径数量超出范围。');
  return list.map((item) => {
    if (typeof item !== 'string' || !/\.(?:bib|bibtex|json)$/i.test(item))
      fail('invalidRequest', '仅支持 BibTeX 与 CSL JSON 文献文件。');
    return relativePath(item);
  });
}

async function loadBibliography(
  input: EditorInputs['editor.convert'],
  services: Services,
): Promise<Bibliography> {
  if ((input.paths?.length ?? 0) > PATH_LIMIT) fail('resourceLimit', '文献路径数量超出范围。');
  const document = input.content ?? (input.path ? await readLimited(input.path, services) : '');
  let paths: string[];
  let refBlock: string | undefined;
  let projectBiblios: string[];
  if (input.paths?.length) {
    paths = input.paths.map((path) => {
      if (!/\.(?:bib|bibtex|json)$/i.test(path))
        fail('invalidRequest', '仅支持 BibTeX 与 CSL JSON 文献文件。');
      return relativePath(path);
    });
    if (typeof input.json === 'string') {
      const extra = parseJson<{ refBlock?: string; etag?: string }>(input.json);
      refBlock = extra.refBlock;
    }
    projectBiblios = paths;
  } else {
    const frontMatter = metadata(document);
    const documentBibliographies = bibliographyPaths(
      frontMatter.bibliography ?? frontMatter.bibliographies,
    );
    paths = documentBibliographies.map((path) =>
      relativePath(posix.join(posix.dirname(input.path ?? ''), path)),
    );
    projectBiblios = paths;
    const references = frontMatter.references;
    const inlineRefs = Array.isArray(references) ? references : [];
    const loaded: CSL[] = [];
    if (inlineRefs.length) loaded.push(...(inlineRefs as CSL[]));
    if (typeof input.json === 'string') {
      const extra = parseJson<{ refBlock?: string; etag?: string }>(input.json);
      refBlock = extra.refBlock;
    }
    const sources = await convertBibliographyPaths(paths, services);
    sources.push(...loaded);
    if (refBlock) appendRefBlock(sources, refBlock);
    return { sources, project_biblios: projectBiblios };
  }
  const sources = await convertBibliographyPaths(paths, services);
  if (refBlock) appendRefBlock(sources, refBlock);
  return { sources, project_biblios: projectBiblios };
}

function appendRefBlock(sources: CSL[], refBlock: string): void {
  const yamlText = refBlock.replace(/^---[^\n]*\n|\n(?:---|\.\.\.)\s*$/g, '');
  const parsed: unknown = parse(yamlText);
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { references?: unknown }).references)
  ) {
    sources.push(...(parsed as { references: CSL[] }).references);
  }
}

async function convertBibliographyPaths(paths: string[], services: Services): Promise<CSL[]> {
  const sources: CSL[] = [];
  for (const path of paths) {
    const source = await readLimited(path, services);
    const inputFormat = /\.json$/i.test(path) ? 'csljson' : 'bibtex';
    const converted = await services.run(['--from', inputFormat, '--to', 'csljson'], source);
    const parsed = parseJson<CSL[] | CSL>(converted);
    const records = Array.isArray(parsed) ? parsed : [parsed];
    sources.push(...records);
  }
  return sources;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function convertDocument(
  input: EditorInputs['editor.convert'],
  services: Services,
): Promise<{ text: string }> {
  let text: string;
  switch (input.kind) {
    case 'capabilities':
      text = JSON.stringify(await getCapabilities(services));
      break;
    case 'extensions':
      text = await services.run([
        '--list-extensions',
        ...(input.format ? [markdownFormat(input.format)] : []),
      ]);
      break;
    case 'markdownToAst': {
      const format = markdownFormat(input.format);
      const options = safeOptions(input.options);
      const markdown = input.content ?? '';
      const ast = parseJson<PandocAst>(
        await services.run(
          [
            '--from',
            format,
            '--abbreviations',
            join(services.resources, 'abbreviations'),
            '--to',
            'json',
            ...options,
          ],
          markdown,
        ),
      );
      let headingFormat = format.replace(/\+(?:auto_identifiers|gfm_auto_identifiers)/g, '');
      headingFormat += '-auto_identifiers-gfm_auto_identifiers';
      const headingIds = await services.run(
        [
          '--from',
          headingFormat,
          '--to',
          'plain',
          '--lua-filter',
          join(services.resources, 'heading-ids.lua'),
        ],
        markdown,
      );
      if (headingIds) ast.heading_ids = headingIds.split(/\r?\n/).filter(Boolean);
      text = JSON.stringify(ast);
      break;
    }
    case 'astToMarkdown': {
      if (!input.json) fail('invalidRequest', 'AST 内容不能为空。');
      const ast = parseJson<PandocAst>(input.json);
      if (!Array.isArray(ast.blocks) || !Array.isArray(ast['pandoc-api-version']))
        fail('invalidRequest', 'AST 结构无效。');
      const format = markdownFormat(input.format);
      const writer = format.replace(
        /^markdown(?=[+-]|$)/,
        join(services.resources, 'md-writer.lua'),
      );
      text = await services.run(
        ['--from', 'json', '--to', writer, ...safeOptions(input.options)],
        JSON.stringify(ast),
      );
      break;
    }
    case 'bibliography': {
      const result = await loadBibliography(input, services);
      text = JSON.stringify({ etag: globalThis.crypto.randomUUID(), bibliography: result });
      break;
    }
    case 'citationHtml': {
      const value = parseJson<CSL>(input.json ?? 'null');
      if (!value || typeof value !== 'object') fail('invalidRequest', 'CSL 条目无效。');
      const yaml = stringify({ references: [value], nocite: '@*' });
      const markdown = `---\n${yaml}---\n`;
      try {
        text = await services.run(['--from', 'markdown', '--citeproc', '--to', 'html'], markdown);
      } catch (error) {
        if (
          error instanceof OperationError &&
          ['outcomeUnknown', 'shuttingDown', 'permissionDenied'].includes(error.code)
        )
          throw error;
        const label = [
          value.author?.[0]?.family,
          value.issued?.['date-parts']?.[0]?.[0],
          value.title,
        ]
          .filter((part) => part !== undefined)
          .join('. ');
        text = `<p>${escapeHtml(label || value.id || 'Citation')}</p>`;
      }
      break;
    }
  }
  return { text: bounded(text) };
}
