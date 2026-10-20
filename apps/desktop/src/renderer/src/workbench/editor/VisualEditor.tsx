import {
  DispatchEvent,
  defaultEditorUIImages,
  defaultTheme,
  Editor,
  EditorCommands,
  type EditorContext,
  type EditorUI,
} from '@scholoom/editor/visual';
import '@scholoom/editor/visual.css';
import type { KernelClient } from '@scholoom/client';
import katex from 'katex';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'katex/dist/katex.min.css';
import { Dialog } from '../shell/dialog';
import {
  createDialogAdapter,
  currentDocumentXrefs,
  editorFormat,
  makeEditorContext,
  resolveImagePath,
} from './visual-host';

export interface VisualEditorProps {
  client: KernelClient;
  projectId: string;
  path: string;
  content: string;
  recovery?: unknown;
  getRecovery?: () => unknown;
  onCheckpoint?: (state: unknown) => void;
  onRecover?: (checkpoint: unknown, text: string) => string;
  readOnly: boolean;
  onChange: (text: string) => void;
  onError: (message: string) => void;
  onPending: (pending: boolean) => void;
  registerFlush: (flush: (() => Promise<void>) | undefined) => void;
  onSave: () => void | Promise<void>;
}

type Command = ReturnType<Editor['commands']>[number];
type AskField = {
  label: string;
  value: string;
  options?: string[];
  optionLabels?: string[];
  multiple?: boolean;
  multiline?: boolean;
  disabled?: boolean;
};
type DialogRequest = {
  title: string;
  element: HTMLElement;
  confirm: () => void;
  cancel: () => void;
  focus?: () => void;
};
const groups: Array<[string, string[]]> = [
  ['文字', ['Strong', 'Em', 'Code', 'Strikeout', 'Superscript', 'Subscript', 'ClearFormatting']],
  [
    '结构',
    [
      'Paragraph',
      'Heading1',
      'Heading2',
      'Heading3',
      'Heading4',
      'Blockquote',
      'BulletList',
      'OrderedList',
      'HorizontalRule',
      'Footnote',
    ],
  ],
  ['公式', ['InlineMath', 'DisplayMath']],
  ['表格', ['TableInsertTable', 'TableToggleHeader', 'TableAddRowAfter', 'TableAddColumnAfter']],
  ['图片', ['Image']],
  ['引文与引用', ['Citation', 'CrossReference']],
];
const commandId = (name: string) => EditorCommands[name as keyof typeof EditorCommands];
const commandLabels: Record<string, string> = {
  Strong: '加粗',
  Em: '斜体',
  Code: '行内代码',
  Strikeout: '删除线',
  Superscript: '上标',
  Subscript: '下标',
  ClearFormatting: '清除格式',
  Paragraph: '正文',
  Heading1: '一级标题',
  Heading2: '二级标题',
  Heading3: '三级标题',
  Heading4: '四级标题',
  Blockquote: '引用块',
  BulletList: '无序列表',
  OrderedList: '有序列表',
  HorizontalRule: '分隔线',
  Footnote: '脚注',
  InlineMath: '行内公式',
  DisplayMath: '块级公式',
  TableInsertTable: '插入表格',
  TableToggleHeader: '切换表头',
  TableAddRowAfter: '在下方插入行',
  TableAddColumnAfter: '在右侧插入列',
  Image: '图片',
  Citation: '引文',
  CrossReference: '交叉引用',
};

function makeUi(
  dialogs: ReturnType<typeof createDialogAdapter>,
  imageURL: (source: string) => Promise<string>,
  documentPath: () => string,
  flush: () => Promise<void>,
): EditorUI {
  return {
    dialogs,
    display: {
      openURL: (url: string) => {
        if (!/^(https:\/\/|mailto:)/i.test(url)) return;
        if (window.scholoomDesktop) void window.scholoomDesktop.openExternal(url);
        else window.open(url, '_blank', 'noopener,noreferrer');
      },
      navigateToXRef: () => {},
      navigateToFile: () => {},
    },
    context: {
      isWindowsDesktop: () => window.scholoomDesktop?.platform === 'win32',
      isActiveTab: () => true,
      getDocumentPath: documentPath,
      withSavedDocument: async () => {
        await flush();
        return true;
      },
      getDefaultResourceDir: () => documentPath().split('/').slice(0, -1).join('/'),
      mapResourceToURL: imageURL,
      watchResource: () => () => {},
      translateText: (text) => text,
      droppedUris: () => null,
      clipboardUris: async () => null,
      clipboardImage: async () => null,
      resolveImageUris: async (uris) => Promise.all(uris.map(imageURL)),
    },
    prefs: {
      realtimeSpelling: () => false,
      darkMode: () => semanticTheme().darkMode,
      listSpacing: () => 'spaced',
      equationPreview: () => true,
      packageListingEnabled: () => false,
      tabKeyMoveFocus: () => false,
      emojiSkinTone: () => 0 as ReturnType<EditorUI['prefs']['emojiSkinTone']>,
      setEmojiSkinTone: () => {},
      zoteroUseBetterBibtex: () => false,
      setBibliographyDefaultType: () => {},
      bibliographyDefaultType: () => 'bibtex',
      citationDefaultInText: () => false,
      setCitationDefaultInText: () => {},
      spacesForTab: () => true,
      tabWidth: () => 2,
      autoClosingBrackets: () => true,
      highlightSelectedWord: () => false,
      lineNumbers: () => false,
      showWhitespace: () => false,
      blinkingCursor: () => true,
      quickSuggestions: () => false,
    },
    images: defaultEditorUIImages(),
    math: {
      typeset: async (element, text) => {
        try {
          katex.render(text, element, {
            displayMode: element.classList.contains('katex-display'),
            throwOnError: false,
          });
          return true;
        } catch {
          return false;
        }
      },
    },
  };
}

function semanticTheme() {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const defaults = defaultTheme();
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const bg = token('--bg', defaults.backgroundColor);
  const surface = token('--surface', defaults.divBackgroundColor);
  const border = token('--border', defaults.borderBackgroundColor);
  const strongBorder = token('--border-strong', defaults.paneBorderColor);
  const primary = token('--text-primary', defaults.textColor);
  const secondary = token('--text-secondary', defaults.lightTextColor);
  const tertiary = token('--text-tertiary', defaults.disabledTextColor);
  const accent = token('--accent', defaults.linkTextColor);
  const darkAttribute = root.getAttribute('data-theme');
  const darkMode =
    darkAttribute === 'dark' ||
    (darkAttribute !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  return {
    ...defaults,
    darkMode,
    cursorColor: primary,
    selectionColor: accent,
    selectionForegroundColor: bg,
    nodeSelectionColor: accent,
    backgroundColor: bg,
    metadataBackgroundColor: bg,
    chunkBackgroundColor: surface,
    spanBackgroundColor: surface,
    divBackgroundColor: surface,
    commentColor: secondary,
    commentBackgroundColor: surface,
    hrBackgroundColor: border,
    gutterBackgroundColor: surface,
    gutterTextColor: secondary,
    toolbarBackgroundColor: surface,
    toolbarTextColor: primary,
    textColor: primary,
    surfaceWidgetTextColor: secondary,
    lightTextColor: secondary,
    disabledTextColor: tertiary,
    placeholderTextColor: tertiary,
    invisibleTextColor: tertiary,
    linkTextColor: accent,
    markupTextColor: accent,
    findTextBackgroundColor: surface,
    findTextBorderColor: strongBorder,
    borderBackgroundColor: border,
    blockBorderColor: border,
    focusOutlineColor: accent,
    paneBorderColor: strongBorder,
    fixedWidthFont: token('--font-mono', defaults.fixedWidthFont),
    proportionalFont: token('--font-prose', defaults.proportionalFont),
    suggestWidgetBackgroundColor: surface,
    suggestWidgetBorderColor: strongBorder,
    suggestWidgetForegroundColor: primary,
    suggestWidgetFocusHighlightForegroundColor: accent,
    suggestWidgetHighlightForegroundColor: accent,
    suggestWidgetSelectedBackgroundColor: accent,
    suggestWidgetSelectedForegroundColor: bg,
    suggestWidgetSelectedIconForegroundColor: bg,
    code: Object.fromEntries(
      Object.keys(defaults.code).map((key) => [
        key,
        key === 'commentColor'
          ? secondary
          : key === 'stringColor' || key === 'linkColor'
            ? accent
            : primary,
      ]),
    ) as unknown as typeof defaults.code,
  };
}

export function VisualEditor(props: VisualEditorProps) {
  const mount = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const contentRef = useRef(props.content);
  const dirtyRef = useRef(false);
  const blockedRef = useRef(false);
  const loadingRef = useRef(false);
  const docVersion = useRef(0);
  const pendingRef = useRef(false);
  const conversionRef = useRef<Promise<void> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toolsFrame = useRef<number | undefined>(undefined);
  const instanceVersion = useRef(0);
  const teardownRef = useRef<Promise<void>>(Promise.resolve());
  const readOnlyRef = useRef(props.readOnly);
  const callbacks = useRef(props);
  const requestedContent = useRef(props.content);
  const loadPromise = useRef<Promise<void> | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [status, setStatus] = useState('');
  const [, refreshTools] = useState(0);
  callbacks.current = props;
  readOnlyRef.current = props.readOnly;

  const showDialog = useCallback(
    (
      title: string,
      create: (
        w: number,
        h: number,
        ok: () => void,
        cancel: () => void,
        progress: (s: string) => void,
        hide: () => void,
        themed?: boolean,
      ) => HTMLElement,
      focus: () => void,
      validate: () => string | null,
    ) =>
      new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          setDialog(null);
          resolve(value);
        };
        const element = create(
          window.innerWidth,
          window.innerHeight,
          () => {
            const error = validate();
            if (error) {
              callbacks.current.onError(error);
              return;
            }
            finish(true);
          },
          () => finish(false),
          () => {},
          () => {},
        );
        setDialog({
          title,
          element,
          confirm: () => finish(true),
          cancel: () => finish(false),
          focus,
        });
      }),
    [],
  );

  useEffect(() => {
    dialog?.focus?.();
  }, [dialog]);

  const ask = useCallback(
    (title: string, fields: AskField[]) =>
      new Promise<string[] | null>((resolve) => {
        const form = document.createElement('form');
        form.className = 'visual-editor-dialog-form';
        const inputs = fields.map((field) => {
          const label = document.createElement('label');
          label.textContent = field.label;
          const control = field.options
            ? document.createElement('select')
            : field.multiline
              ? document.createElement('textarea')
              : document.createElement('input');
          control.setAttribute('aria-label', field.label);
          control.disabled = field.disabled ?? false;
          if (control instanceof HTMLSelectElement) {
            control.multiple = field.multiple ?? false;
            for (const [index, value] of (field.options ?? []).entries()) {
              const option = document.createElement('option');
              option.value = value;
              option.textContent = field.optionLabels?.[index] ?? value;
              option.selected = value === field.value;
              control.append(option);
            }
          } else control.value = field.value;
          label.append(control);
          form.append(label);
          return control;
        });
        let accept = () => {};
        let reject = () => {};
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          accept();
        });
        accept = () => {
          setDialog(null);
          resolve(
            inputs.map((input) =>
              input instanceof HTMLSelectElement && input.multiple
                ? [...input.selectedOptions].map((option) => option.value).join('\n')
                : input.value,
            ),
          );
        };
        reject = () => {
          setDialog(null);
          resolve(null);
        };
        const actions = document.createElement('div');
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.textContent = '确定';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = '取消';
        cancel.addEventListener('click', () => reject());
        actions.append(submit, cancel);
        form.append(actions);
        setDialog({ title, element: form, confirm: accept, cancel: reject });
      }),
    [],
  );

  const flush = useCallback((target: VisualEditorProps = callbacks.current): Promise<void> => {
    pendingRef.current ||= dirtyRef.current;
    if (conversionRef.current) return conversionRef.current;
    const instance = editorRef.current;
    if (!instance || !pendingRef.current) return Promise.resolve();
    if (blockedRef.current) {
      target.onPending(false);
      return Promise.resolve();
    }
    const run = async () => {
      while (pendingRef.current && editorRef.current === instance) {
        pendingRef.current = false;
        const version = docVersion.current;
        const result = await instance.getMarkdown({ wrap: 'none' });
        if (editorRef.current !== instance) return;
        if (version !== docVersion.current || pendingRef.current) {
          pendingRef.current = true;
          continue;
        }
        if (result.code !== contentRef.current) {
          contentRef.current = result.code;
          target.onChange(result.code);
        }
        dirtyRef.current = false;
      }
      if (editorRef.current === instance && !pendingRef.current && !dirtyRef.current) {
        target.onCheckpoint?.(undefined);
        target.onPending(false);
      }
    };
    let completed = false;
    const promise = run()
      .then(() => {
        completed = true;
      })
      .catch((error: unknown) => {
        target.onError(error instanceof Error ? error.message : '可视编辑内容转换失败。');
        throw error;
      })
      .finally(() => {
        if (conversionRef.current === promise) conversionRef.current = null;
        if (completed && pendingRef.current && dirtyRef.current) void flush().catch(() => {});
      });
    conversionRef.current = promise;
    return promise;
  }, []);

  const getDraft = useCallback(async () => {
    await flush();
    return contentRef.current;
  }, [flush]);

  const recoverDraft = useCallback(async (instance: Editor, lifecycle: number) => {
    const checkpoint = callbacks.current.getRecovery
      ? callbacks.current.getRecovery()
      : callbacks.current.recovery;
    if (!checkpoint) return;
    const recovered = await instance.getMarkdownFromStateJson(checkpoint, { wrap: 'none' });
    if (editorRef.current !== instance || lifecycle !== instanceVersion.current) return;
    let source = callbacks.current.onRecover?.(checkpoint, recovered) ?? recovered;
    do {
      requestedContent.current = source;
      const result = await instance.setMarkdown(source, { wrap: 'none' }, false);
      if (editorRef.current !== instance || lifecycle !== instanceVersion.current) return;
      if (
        !result ||
        result.unrecognized.length ||
        result.example_lists ||
        Object.keys(result.unparsed_meta).length
      )
        throw new Error('可视草稿暂时无法恢复，原稿与恢复记录已保留。');
      contentRef.current = source;
      source = callbacks.current.content;
    } while (source !== requestedContent.current);
  }, []);

  const applyExternalContent = useCallback(
    (instance: Editor, content: string) => {
      requestedContent.current = content;
      if (dirtyRef.current) {
        setStatus('外部内容已更新；保留当前编辑，请保存或切回源码核对。');
        return;
      }
      if (loadPromise.current) return;
      const lifecycle = instanceVersion.current;
      const task = (async () => {
        loadingRef.current = true;
        instance.refreshEditable();
        try {
          while (
            editorRef.current === instance &&
            lifecycle === instanceVersion.current &&
            requestedContent.current !== contentRef.current
          ) {
            const next = requestedContent.current;
            if (dirtyRef.current) {
              setStatus('外部内容已更新；保留当前编辑，请保存或切回源码核对。');
              return;
            }
            const result = await instance.setMarkdown(next, { wrap: 'none' }, false);
            if (editorRef.current !== instance || lifecycle !== instanceVersion.current) return;
            if (next !== requestedContent.current) continue;
            if (!result) return;
            contentRef.current = next;
            const unsafe = !!(
              result.unrecognized.length ||
              result.example_lists ||
              Object.keys(result.unparsed_meta).length
            );
            blockedRef.current = unsafe;
            setBlocked(unsafe);
            setStatus('');
          }
          if (!blockedRef.current) await recoverDraft(instance, lifecycle);
        } catch (error) {
          blockedRef.current = true;
          setBlocked(true);
          callbacks.current.onError(error instanceof Error ? error.message : '文档载入失败。');
        } finally {
          loadingRef.current = false;
          instance.refreshEditable();
          loadPromise.current = null;
        }
      })();
      loadPromise.current = task;
    },
    [recoverDraft],
  );

  useEffect(() => {
    const registerFlush = props.registerFlush;
    registerFlush(flush);
    return () => registerFlush(undefined);
  }, [flush, props.registerFlush]);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const lifecycle = ++instanceVersion.current;
    let disposed = false;
    let disposeEvent: (() => void) | undefined;
    let disposeTheme: (() => void) | undefined;
    const owner = callbacks.current;
    const liveUrls = new Set<string>();
    const imageUrls = new Map<string, Promise<string>>();
    const format = editorFormat(props.path);
    const chooseCitation: EditorUI['dialogs']['insertCite'] = async () => {
      await dialogs.alert('添加文献', '先在项目书目文件中添加条目，再从“引文”中选择。', 2);
      return null;
    };
    const dialogs = createDialogAdapter(ask, chooseCitation);
    dialogs.htmlDialog = (
      title: string,
      _ok: string | null,
      create: (
        w: number,
        h: number,
        ok: () => void,
        cancel: () => void,
        progress: (message: string) => void,
        hide: () => void,
        themed?: boolean,
      ) => HTMLElement,
      focus: () => void,
      validate: () => string | null,
    ) => showDialog(title, create, focus, validate);
    const ui = makeUi(
      dialogs,
      (source) => {
        const path = resolveImagePath(props.path, source);
        if (!path) throw new Error('图片只支持项目内相对路径。');
        const cached = imageUrls.get(path);
        if (cached) return cached;
        if (imageUrls.size >= 100) throw new Error('本视图最多加载 100 个不同图片资源。');
        const request = (async () => {
          const resource = await callbacks.current.client.call('files.resource', {
            projectId: callbacks.current.projectId,
            path,
          });
          const bytes = Uint8Array.from(atob(resource.data), (char) => char.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: resource.mimeType }));
          if (disposed) {
            URL.revokeObjectURL(url);
            throw new Error('图片资源请求已取消。');
          }
          liveUrls.add(url);
          return url;
        })();
        imageUrls.set(path, request);
        void request.catch(() => {
          if (imageUrls.get(path) === request) imageUrls.delete(path);
        });
        return request;
      },
      () => callbacks.current.path,
      flush,
    );
    const xrefs = async () => {
      const content = await getDraft();
      const result = await callbacks.current.client.call('editor.convert', {
        projectId: callbacks.current.projectId,
        path: callbacks.current.path,
        kind: 'markdownToAst',
        content,
        format: 'markdown',
      });
      return currentDocumentXrefs(JSON.parse(result.text), callbacks.current.path);
    };
    const context: EditorContext = makeEditorContext({
      client: props.client,
      projectId: props.projectId,
      path: props.path,
      format,
      ui,
      isEditable: () => !readOnlyRef.current && !blockedRef.current && !loadingRef.current,
      xrefs,
      getContent: () => contentRef.current,
    });
    void teardownRef.current
      .then(() =>
        Editor.create(
          host,
          context,
          format,
          { className: 'visual-editor-content', autoFocus: false },
          semanticTheme(),
        ),
      )
      .then(async (instance) => {
        if (disposed || lifecycle !== instanceVersion.current) {
          instance.destroy();
          return;
        }
        editorRef.current = instance;
        loadingRef.current = true;
        instance.refreshEditable();
        try {
          let source = callbacks.current.content;
          let initial: Awaited<ReturnType<Editor['setMarkdown']>>;
          do {
            requestedContent.current = source;
            initial = await instance.setMarkdown(source, { wrap: 'none' }, false);
            if (disposed || lifecycle !== instanceVersion.current) {
              instance.destroy();
              return;
            }
            source = callbacks.current.content;
          } while (source !== requestedContent.current);
          if (!initial) return;
          contentRef.current = source;
          const unsafe = !!(
            initial.unrecognized.length ||
            initial.example_lists ||
            Object.keys(initial.unparsed_meta).length
          );
          blockedRef.current = unsafe;
          setBlocked(unsafe);
          if (unsafe)
            callbacks.current.onError(
              '文档包含可视编辑器无法无损表示的内容。请切回源码模式后继续编辑。',
            );
          if (!unsafe) await recoverDraft(instance, lifecycle);
          if (unsafe || !dirtyRef.current) callbacks.current.onPending(false);
        } catch (error) {
          blockedRef.current = true;
          throw error;
        } finally {
          loadingRef.current = false;
          instance.refreshEditable();
        }
        const themeQuery = matchMedia('(prefers-color-scheme: dark)');
        const applySemanticTheme = () => instance.applyTheme(semanticTheme());
        const observer = new MutationObserver(applySemanticTheme);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        });
        themeQuery.addEventListener('change', applySemanticTheme);
        disposeTheme = () => {
          observer.disconnect();
          themeQuery.removeEventListener('change', applySemanticTheme);
        };
        setCommands(instance.commands());
        disposeEvent = instance.subscribe(DispatchEvent, (transaction) => {
          if (toolsFrame.current === undefined)
            toolsFrame.current = requestAnimationFrame(() => {
              toolsFrame.current = undefined;
              if (!disposed) refreshTools((value) => value + 1);
            });
          if (
            !transaction?.docChanged ||
            loadingRef.current ||
            readOnlyRef.current ||
            blockedRef.current
          )
            return;
          dirtyRef.current = true;
          pendingRef.current = true;
          docVersion.current++;
          callbacks.current.onPending(true);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            if (!disposed) void flush().catch(() => {});
          }, 150);
        });
      })
      .catch((error: unknown) => {
        if (!disposed) {
          blockedRef.current = true;
          setBlocked(true);
          editorRef.current?.refreshEditable();
          callbacks.current.onError(
            error instanceof Error ? error.message : '可视编辑器初始化失败。',
          );
        }
      });
    return () => {
      disposed = true;
      instanceVersion.current++;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (toolsFrame.current !== undefined) {
        cancelAnimationFrame(toolsFrame.current);
        toolsFrame.current = undefined;
      }
      disposeEvent?.();
      disposeTheme?.();
      const current = editorRef.current;
      if (current) {
        if (dirtyRef.current) owner.onCheckpoint?.(current.getStateJson());
        teardownRef.current = flush(owner)
          .catch(() => {})
          .finally(() => owner.onPending(false))
          .then(() => {
            current.destroy();
            if (editorRef.current === current) editorRef.current = null;
            for (const url of liveUrls) URL.revokeObjectURL(url);
            liveUrls.clear();
          });
      } else {
        for (const url of liveUrls) URL.revokeObjectURL(url);
      }
    };
  }, [props.client, props.projectId, props.path, showDialog, ask, flush, getDraft, recoverDraft]);

  useEffect(() => {
    const checkpoint = () => {
      if (dirtyRef.current && editorRef.current)
        callbacks.current.onCheckpoint?.(editorRef.current.getStateJson());
    };
    window.addEventListener('pagehide', checkpoint);
    window.addEventListener('beforeunload', checkpoint);
    return () => {
      window.removeEventListener('pagehide', checkpoint);
      window.removeEventListener('beforeunload', checkpoint);
    };
  }, []);

  useEffect(() => {
    const instance = editorRef.current;
    if (props.content === contentRef.current) return;
    requestedContent.current = props.content;
    if (dirtyRef.current) {
      setStatus('外部内容已更新；保留当前编辑，请保存或切回源码核对。');
      return;
    }
    if (loadingRef.current) return;
    if (instance) applyExternalContent(instance, props.content);
    else contentRef.current = props.content;
  }, [props.content, applyExternalContent]);

  useEffect(() => {
    const instance = editorRef.current;
    if (props.recovery && instance && !loadingRef.current)
      applyExternalContent(instance, callbacks.current.content);
  }, [props.recovery, applyExternalContent]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 只读能力变化时通知 ProseMirror 重新读取宿主 hook。
  useEffect(() => {
    editorRef.current?.refreshEditable();
  }, [props.readOnly]);

  const invoke = (id: string) => {
    if (props.readOnly || blocked) return;
    const command = commands.find((item) => item.id === commandId(id));
    if (command?.isEnabled()) command.execute();
  };
  const save = async () => {
    await flush();
    await props.onSave();
  };
  const format = useMemo(
    () =>
      groups.map(([title, ids]) => ({
        title,
        items: ids
          .map((id) => ({ id, command: commandId(id) }))
          .filter(
            (item) => item.command && commands.some((command) => command.id === item.command),
          ),
      })),
    [commands],
  );

  return (
    <section
      className="visual-editor"
      aria-label="可视编辑器"
      onKeyDownCapture={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          if (!props.readOnly && !blocked) void save().catch(() => {});
        }
      }}
    >
      <div className="visual-editor-tools" role="toolbar" aria-label="编辑工具">
        {format.map((group) => {
          return (
            <fieldset
              className="visual-editor-tools__group"
              key={group.title}
              aria-label={group.title}
            >
              {group.items.map(({ id, command: commandKey }) => {
                const command = commands.find((item) => item.id === commandKey);
                return (
                  <button
                    className="btn"
                    key={id}
                    type="button"
                    disabled={props.readOnly || blocked || !command?.isEnabled()}
                    aria-label={commandLabels[id] ?? id}
                    title={command?.keymap?.join(' / ')}
                    onClick={() => invoke(id)}
                  >
                    {commandLabels[id] ?? id}
                  </button>
                );
              })}
            </fieldset>
          );
        })}
        <button
          className="btn"
          type="button"
          disabled={props.readOnly || blocked}
          onClick={() => {
            void save().catch(() => {});
          }}
        >
          保存
        </button>
      </div>
      {status && <div role="status">{status}</div>}
      {blocked && <div role="alert">无法保证无损编辑。请从工作台源码入口处理该文档。</div>}
      <div className="codemirror-host visual-editor-host" ref={mount} />
      {dialog && (
        <Dialog title={dialog.title} onClose={dialog.cancel} className="visual-editor-dialog">
          <div
            ref={(node) => {
              if (node && !node.contains(dialog.element)) node.append(dialog.element);
            }}
          />
        </Dialog>
      )}
    </section>
  );
}
