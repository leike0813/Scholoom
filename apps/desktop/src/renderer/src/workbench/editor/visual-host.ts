import type { KernelClient } from '@scholoom/client';
import type { EditorContext, EditorFormat, EditorUI } from '@scholoom/editor/visual';
import { assetTarget } from '../markdown-paths';

type XRefs = Awaited<ReturnType<EditorContext['server']['xref']['indexForFile']>>;

export function currentDocumentXrefs(ast: unknown, path: string): XRefs {
  const value =
    ast && typeof ast === 'object' ? (ast as { blocks?: unknown[]; heading_ids?: string[] }) : {};
  const refs: XRefs['refs'] = [];
  let headingIndex = 0;
  const inlineText = (node: unknown): string => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(inlineText).join('');
    if (!node || typeof node !== 'object') return '';
    const record = node as { t?: string; c?: unknown };
    if (record.t === 'Str') return typeof record.c === 'string' ? record.c : '';
    return inlineText(record.c);
  };
  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const token = node as { t?: string; c?: unknown };
      if (token.t === 'Header' && Array.isArray(token.c)) {
        const attr = Array.isArray(token.c[1])
          ? (token.c[1] as [string, string[], unknown[]])
          : undefined;
        const id = (attr?.[0] || value.heading_ids?.[headingIndex] || '')
          .replace(/^#/u, '')
          .replace(/^sec-/u, '');
        headingIndex++;
        if (id)
          refs.push({ file: path, type: 'sec', id, suffix: '', title: inlineText(token.c[2]) });
      } else if (Array.isArray(token.c)) {
        const attr = token.c[0];
        if (Array.isArray(attr) && typeof attr[0] === 'string' && attr[0]) {
          const classes = Array.isArray(attr[1]) ? (attr[1] as string[]) : [];
          const idType = attr[0].match(
            /^(fig|tbl|eq|lst|sec|thm|def|exm|lem|cor|prp|cnj|rem|sol)-/u,
          )?.[1];
          const type =
            classes
              .find((item) => /^(fig|tbl|eq|lst|thm|def|exm|lem|cor|prp|cnj|rem|sol)-/u.test(item))
              ?.split('-', 1)[0] ??
            idType ??
            'sec';
          const title = inlineText(token.c);
          refs.push({
            file: path,
            type,
            id: attr[0].replace(/^(?:fig|tbl|eq|lst|sec)-/u, ''),
            suffix: '',
            ...(title ? { title } : {}),
          });
        }
        walk(
          token.c.filter(
            (child): child is Record<string, unknown> => !!child && typeof child === 'object',
          ) as unknown[],
        );
      }
    }
  };
  walk(value.blocks ?? []);
  const unique = [...new Map(refs.map((ref) => [`${ref.type}:${ref.id}`, ref])).values()];
  return { baseDir: '', refs: unique };
}

type ConvertInput = {
  projectId: string;
  path: string;
  kind:
    | 'capabilities'
    | 'markdownToAst'
    | 'astToMarkdown'
    | 'extensions'
    | 'bibliography'
    | 'citationHtml';
  content?: string;
  json?: string;
  format?: string;
  options?: string[];
  paths?: string[];
};

export function pandocHost(
  client: KernelClient,
  projectId: string,
  path: string,
  getContent: () => string,
) {
  const convert = async (input: Omit<ConvertInput, 'projectId' | 'path'>) =>
    client.call('editor.convert', { projectId, path, ...input });
  return {
    pandoc: {
      getCapabilities: async () => JSON.parse((await convert({ kind: 'capabilities' })).text),
      markdownToAst: async (markdown: string, format: string, options: string[] = []) =>
        JSON.parse(
          (await convert({ kind: 'markdownToAst', content: markdown, format, options })).text,
        ),
      astToMarkdown: async (ast: unknown, format: string, options: string[] = []) =>
        (await convert({ kind: 'astToMarkdown', json: JSON.stringify(ast), format, options })).text,
      listExtensions: async (format = 'markdown') =>
        (await convert({ kind: 'extensions', format })).text,
      getBibliography: async (
        _file: string | null,
        _bibliography: string[],
        refBlock: string | null,
        etag: string | null,
      ) => {
        const json = JSON.stringify({ refBlock, etag });
        return JSON.parse(
          (await convert({ kind: 'bibliography', content: getContent(), json, paths: [] })).text,
        );
      },
      addToBibliography: async () => false,
      citationHTML: async (_file: string | null, sourceAsJson: string) =>
        (await convert({ kind: 'citationHtml', json: sourceAsJson })).text,
    },
  };
}

const unavailable = async () => ({ status: 'nohost', data: null });

/** Creates the non-network service endpoints expected by the upstream editor. */
export function makeEditorContext(args: {
  client: KernelClient;
  projectId: string;
  path: string;
  format: EditorFormat;
  ui: EditorUI;
  isEditable: () => boolean;
  xrefs: () => Promise<XRefs>;
  getContent: () => string;
}): EditorContext {
  const pandoc = pandocHost(args.client, args.projectId, args.path, args.getContent).pandoc;
  const noNetwork = new Proxy({}, { get: () => unavailable }) as Record<
    string,
    (...values: unknown[]) => Promise<unknown>
  >;
  return {
    server: {
      pandoc,
      doi: noNetwork,
      crossref: noNetwork,
      datacite: noNetwork,
      pubmed: noNetwork,
      xref: {
        indexForFile: args.xrefs,
        quartoIndexForFile: args.xrefs,
        xrefForId: async (_file: string, id: string) => {
          const index = await args.xrefs();
          const key = id.replace(
            /^(?:fig|tbl|eq|lst|sec|thm|def|exm|lem|cor|prp|cnj|rem|sol)-/u,
            '',
          );
          return { ...index, refs: index.refs.filter((item) => item.id === id || item.id === key) };
        },
        quartoXrefForId: async (_file: string, id: string) => {
          const index = await args.xrefs();
          const key = id.replace(
            /^(?:fig|tbl|eq|lst|sec|thm|def|exm|lem|cor|prp|cnj|rem|sol)-/u,
            '',
          );
          return { ...index, refs: index.refs.filter((item) => item.id === id || item.id === key) };
        },
      },
      zotero: noNetwork,
    } as unknown as EditorContext['server'],
    ui: args.ui,
    hooks: { isEditable: args.isEditable },
  };
}

export function editorFormat(path: string): EditorFormat {
  const quarto = /\.qmd$/i.test(path);
  const rMarkdown = /\.rmd$/i.test(path);
  return {
    pandocMode: 'markdown',
    pandocExtensions: '',
    rmdExtensions: {
      codeChunks: quarto || rMarkdown,
      bookdownXRef: quarto || rMarkdown,
      bookdownXRefUI: rMarkdown,
      bookdownPart: false,
      blogdownMathInCode: false,
    },
    hugoExtensions: { shortcodes: false },
    docTypes: quarto ? ['quarto'] : rMarkdown ? ['bookdown'] : [],
  };
}

export function resolveImagePath(documentPath: string, source: string): string | undefined {
  const target = assetTarget(documentPath, source);
  return target.kind === 'local' ? target.path : undefined;
}

export function createDialogAdapter(
  ask: (
    title: string,
    fields: Array<{
      label: string;
      value: string;
      options?: string[];
      multiple?: boolean;
      multiline?: boolean;
      disabled?: boolean;
    }>,
  ) => Promise<string[] | null>,
  chooseCitation: (
    props: Parameters<EditorUI['dialogs']['insertCite']>[0],
  ) => ReturnType<EditorUI['dialogs']['insertCite']>,
): EditorUI['dialogs'] {
  const attrFields = (attr: {
    id?: string;
    classes?: string[];
    keyvalue?: Array<[string, string]>;
  }) => [
    { label: 'ID', value: attr.id ?? '' },
    { label: 'Classes（空格分隔）', value: attr.classes?.join(' ') ?? '' },
    {
      label: '属性（每行 key=value）',
      value: attr.keyvalue?.map(([key, value]) => `${key}=${value}`).join('\n') ?? '',
      multiline: true,
    },
  ];
  const readAttr = (values: string[]) => ({
    ...(values[0] ? { id: values[0].trim() } : {}),
    classes: values[1]?.split(/\s+/u).filter(Boolean) ?? [],
    keyvalue: (values[2] ?? '').split(/\r?\n/u).flatMap((line) => {
      const index = line.indexOf('=');
      return index > 0
        ? [[line.slice(0, index).trim(), line.slice(index + 1).trim()] as [string, string]]
        : [];
    }),
  });
  return {
    alert: async (title, message) => {
      await ask(title, [{ label: '消息', value: message, multiline: true, disabled: true }]);
      return true;
    },
    yesNoMessage: async (title, message, _type, yesLabel, noLabel) =>
      (
        await ask(title, [{ label: message, value: noLabel, options: [yesLabel, noLabel] }])
      )?.[0] === yesLabel,
    editLink: async (link) => {
      const values = await ask('编辑链接', [
        { label: '链接文字', value: link.text },
        { label: '目标（相对路径、https:// 或 mailto:）', value: link.href },
        { label: '标题', value: link.title ?? '' },
      ]);
      return values
        ? {
            action: 'edit',
            link: {
              ...link,
              text: values[0] ?? '',
              href: values[1] ?? '',
              ...(values[2] ? { title: values[2] } : {}),
            },
          }
        : null;
    },
    editImage: async (image) => {
      const values = await ask('编辑图片', [
        { label: '项目内相对路径', value: image.src ?? '' },
        { label: '替代文字', value: image.alt ?? '' },
        { label: '图注', value: image.caption ?? '' },
        {
          label: '宽度（如 80% 或 640px）',
          value: image.width ? `${image.width}${image.units ?? 'px'}` : '',
        },
      ]);
      if (!values) return null;
      const dimension = values[3]?.match(/^\s*(\d+(?:\.\d+)?)\s*(%|px|cm|mm|in)?\s*$/u);
      return {
        ...image,
        src: values[0] || null,
        alt: values[1] ?? '',
        caption: values[2] ?? '',
        ...(dimension ? { width: Number(dimension[1]), units: dimension[2] ?? 'px' } : {}),
      };
    },
    editCodeBlock: async (block, _attributes, languages) => {
      const values = await ask('编辑代码块', [
        { label: `语言（可用：${languages.slice(0, 24).join(', ')}）`, value: block.lang },
        { label: 'ID', value: block.id ?? '' },
        { label: 'Classes（空格分隔）', value: block.classes?.join(' ') ?? '' },
      ]);
      return values
        ? {
            ...block,
            lang: values[0] ?? '',
            ...(values[1] ? { id: values[1] } : {}),
            classes: values[2]?.split(/\s+/u).filter(Boolean) ?? [],
          }
        : null;
    },
    editList: async (list) => {
      const values = await ask('编辑列表', [
        { label: '类型（bullet / ordered）', value: list.type },
        { label: '起始编号', value: String(list.order) },
        { label: '编号样式', value: list.number_style },
        { label: '分隔符（period / one）', value: list.number_delim },
        { label: '紧凑（yes / no）', value: list.tight ? 'yes' : 'no' },
      ]);
      if (!values) return null;
      return {
        ...list,
        type: (values[0] === 'ordered' ? 'ordered' : 'bullet') as typeof list.type,
        order: Math.max(1, Number(values[1]) || 1),
        number_style: values[2] || list.number_style,
        number_delim: values[3] || list.number_delim,
        tight: values[4]?.toLowerCase() === 'yes',
      };
    },
    editAttr: async (attr) => {
      const values = await ask('编辑属性', attrFields(attr));
      return values ? { action: 'edit', attr: readAttr(values) } : null;
    },
    editSpan: async (attr) => {
      const values = await ask('编辑行内属性', attrFields(attr));
      return values ? { action: 'edit', attr: readAttr(values) } : null;
    },
    editDiv: async (attr, removeEnabled) => {
      const values = await ask(
        `编辑区块属性${removeEnabled ? '（清空 ID、类和属性不会删除区块）' : ''}`,
        attrFields(attr),
      );
      return values ? { action: 'edit', attr: readAttr(values) } : null;
    },
    editCallout: async ({ attr, callout }) => {
      const values = await ask('编辑提示框', [
        { label: '类型（note / tip / warning / important / caution）', value: callout.type },
        { label: '标题', value: callout.caption },
        { label: '图标（yes / no）', value: callout.icon ? 'yes' : 'no' },
        ...attrFields(attr),
      ]);
      return values
        ? {
            action: 'edit',
            callout: {
              ...callout,
              type: values[0] || callout.type,
              caption: values[1] ?? '',
              icon: values[2]?.toLowerCase() === 'yes',
            },
            attr: readAttr(values.slice(3)),
          }
        : null;
    },
    editRawInline: async (raw) => {
      const values = await ask('编辑原始行内内容', [
        { label: '格式', value: raw.format },
        { label: '内容', value: raw.content },
      ]);
      return values
        ? { action: 'edit', raw: { format: values[0] ?? '', content: values[1] ?? '' } }
        : null;
    },
    editRawBlock: async (raw) => {
      const values = await ask('编辑原始区块内容', [
        { label: '格式', value: raw.format },
        { label: '内容', value: raw.content },
      ]);
      return values
        ? { action: 'edit', raw: { format: values[0] ?? '', content: values[1] ?? '' } }
        : null;
    },
    editMath: async (id) => (await ask('公式标识', [{ label: 'ID', value: id }]))?.[0] ?? null,
    insertTable: async () => {
      const values = await ask('插入表格', [
        { label: '行数', value: '3' },
        { label: '列数', value: '3' },
        { label: '标题', value: '' },
      ]);
      if (!values) return null;
      const rows = Number(values[0]);
      const cols = Number(values[1]);
      if (
        !Number.isInteger(rows) ||
        !Number.isInteger(cols) ||
        rows < 1 ||
        cols < 1 ||
        rows > 50 ||
        cols > 20
      )
        return null;
      return { rows, cols, header: true, ...(values[2] ? { caption: values[2] } : {}) };
    },
    insertTabset: async () => {
      const names = await ask('插入分页组', [
        { label: '分页标题（逗号分隔）', value: '内容一, 内容二' },
      ]);
      const tabs = names?.[0]
        ?.split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      return tabs?.length ? { tabs, attr: { id: '', classes: [], keyvalue: [] } } : null;
    },
    insertCite: chooseCitation,
    htmlDialog: async () => false,
  } as EditorUI['dialogs'];
}
