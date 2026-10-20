import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  openSearchPanel,
  search,
} from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useMemo, useRef, useState } from 'react';
import { languageForPath } from './language';
import { sourceDocument } from './source-document';

const sourceHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.typeName, tags.annotation], color: 'var(--syntax-keyword)' },
  { tag: [tags.string, tags.regexp], color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.atom, tags.bool], color: 'var(--syntax-number)' },
  { tag: [tags.comment, tags.meta], color: 'var(--text-secondary)' },
  { tag: [tags.link, tags.url], color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.heading, color: 'var(--accent)', fontWeight: 'bold' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.invalid, color: 'var(--status-error)' },
]);

export interface SourceEditorProps {
  documentId: string;
  viewId: string;
  path: string;
  content: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  onChange: (content: string) => void;
  onSave: () => void | Promise<void>;
}

export function SourceEditor({
  documentId,
  viewId,
  path,
  content,
  readOnly = false,
  autoFocus = true,
  onChange,
  onSave,
}: SourceEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const readonlyCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());
  const labelCompartment = useRef(new Compartment());
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };
  const readonlyRef = useRef(readOnly);
  readonlyRef.current = readOnly;
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [indent, setIndent] = useState('空格 2');
  const [lineTarget, setLineTarget] = useState('');
  const language = useMemo(() => languageForPath(path), [path]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: content seeds the document; later changes are synchronized incrementally.
  const shared = useMemo(() => sourceDocument(documentId, content), [documentId]);
  const changeHistory = (redoChange = false) => {
    if (readonlyRef.current) return false;
    const next = redoChange ? shared.redo() : shared.undo();
    if (typeof next === 'string') callbacks.current.onChange(next);
    return typeof next === 'string';
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the view mounts once per document; refs and compartments carry later prop changes.
  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const language = languageForPath(path);
    const view = new EditorView({
      parent: mount,
      state: EditorState.create({
        doc: shared.get(),
        extensions: [
          lineNumbers(),
          foldGutter(),
          highlightActiveLine(),
          drawSelection(),
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          indentUnit.of('  '),
          syntaxHighlighting(sourceHighlightStyle),
          search(),
          EditorState.allowMultipleSelections.of(true),
          readonlyCompartment.current.of([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
          languageCompartment.current.of(language.extension ?? []),
          labelCompartment.current.of(
            EditorView.contentAttributes.of({ 'aria-label': `文件内容 ${path}` }),
          ),
          keymap.of([
            {
              key: 'Mod-s',
              run: () => {
                void callbacks.current.onSave();
                return true;
              },
            },
            { key: 'Mod-z', run: () => changeHistory() },
            { key: 'Mod-Shift-z', run: () => changeHistory(true) },
            { key: 'Mod-y', run: () => changeHistory(true) },
            ...closeBracketsKeymap,
            ...foldKeymap,
            ...defaultKeymap,
            indentWithTab,
          ]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              setCursor({ line: line.number, column: head - line.from + 1 });
              const unit = update.state.facet(indentUnit);
              setIndent(unit.includes('\t') ? 'Tab' : `空格 ${unit.length}`);
            }
          }),
        ],
      }),
      dispatchTransactions: (transactions, view) => {
        const next = shared.dispatch(transactions, view);
        if (next !== undefined) callbacks.current.onChange(next);
      },
    });
    editor.current = view;
    const detach = shared.attach(view, viewId);
    if (autoFocus) view.focus();
    return () => {
      detach();
      view.destroy();
      editor.current = null;
    };
  }, [documentId]);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    view.dispatch({
      effects: readonlyCompartment.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartment.current.reconfigure(language.extension ?? []),
    });
  }, [language.extension]);

  useEffect(() => {
    const view = editor.current;
    if (view)
      view.dispatch({
        effects: labelCompartment.current.reconfigure(
          EditorView.contentAttributes.of({ 'aria-label': `文件内容 ${path}` }),
        ),
      });
  }, [path]);

  useEffect(() => {
    shared.replaceExternal(content);
  }, [content, shared.replaceExternal]);

  const runUndo = (redoChange = false) => {
    if (editor.current) changeHistory(redoChange);
  };
  const goToLine = () => {
    const view = editor.current;
    const target = Number(lineTarget);
    if (!view || !Number.isInteger(target) || target < 1) return;
    const line = Math.min(target, view.state.doc.lines);
    view.dispatch({ selection: { anchor: view.state.doc.line(line).from }, scrollIntoView: true });
    view.focus();
  };

  return (
    <section className="source-editor" aria-label={`源码编辑器 ${path}`}>
      <div className="source-editor-tools" role="toolbar" aria-label="源码编辑工具">
        <button
          className="btn"
          type="button"
          aria-label="查找与替换"
          onClick={() => {
            const view = editor.current;
            if (view) {
              openSearchPanel(view);
              view.focus();
            }
          }}
        >
          查找
        </button>
        <button
          className="btn"
          type="button"
          aria-label="查找下一个"
          onClick={() => editor.current && findNext(editor.current)}
        >
          下一个
        </button>
        <button
          className="btn"
          type="button"
          aria-label="查找上一个"
          onClick={() => editor.current && findPrevious(editor.current)}
        >
          上一个
        </button>
        <button
          className="btn"
          type="button"
          aria-label="关闭查找"
          onClick={() => editor.current && closeSearchPanel(editor.current)}
        >
          关闭查找
        </button>
        <label>
          跳转行{' '}
          <input
            aria-label="跳转到行号"
            inputMode="numeric"
            value={lineTarget}
            onChange={(event) => setLineTarget(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') goToLine();
            }}
          />
        </label>
        <button className="btn" type="button" aria-label="跳转到指定行" onClick={goToLine}>
          跳行
        </button>
        <button
          className="btn"
          type="button"
          aria-label="撤销"
          disabled={readOnly}
          onClick={() => runUndo()}
        >
          撤销
        </button>
        <button
          className="btn"
          type="button"
          aria-label="重做"
          disabled={readOnly}
          onClick={() => runUndo(true)}
        >
          重做
        </button>
      </div>
      <div className="codemirror-host" ref={host} />
      <div className="source-editor-status" role="status" aria-label="编辑器状态">
        <span>
          行 {cursor.line}, 列 {cursor.column}
        </span>
        <span>{language.label}</span>
        <span>{indent}</span>
      </div>
    </section>
  );
}
