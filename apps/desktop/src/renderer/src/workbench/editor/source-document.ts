import { history, redo, undo } from '@codemirror/commands';
import {
  ChangeSet,
  type EditorSelection,
  EditorState,
  type Transaction as EditorTransaction,
  type EditorState as State,
  Transaction,
} from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

type SharedDocument = {
  state: State;
  externalContent: string;
  views: Set<EditorView>;
  positions: Map<string, { selection: EditorSelection; top: number; left: number }>;
};

const documents = new Map<string, SharedDocument>();

function getDocument(id: string, content: string): SharedDocument {
  let document = documents.get(id);
  if (!document) {
    document = {
      state: EditorState.create({ doc: content, extensions: history() }),
      externalContent: content,
      views: new Set(),
      positions: new Map(),
    };
    documents.set(id, document);
  }
  return document;
}

function syncViews(
  document: SharedDocument,
  changes: EditorTransaction['changes'],
  origin?: EditorView,
) {
  for (const position of document.positions.values())
    position.selection = position.selection.map(changes);
  for (const view of document.views) {
    if (view === origin) continue;
    view.update([
      view.state.update({
        changes,
        annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)],
      }),
    ]);
  }
}

function recordChanges(
  document: SharedDocument,
  changes: EditorTransaction['changes'],
  event?: string,
) {
  const transaction = document.state.update({
    changes,
    ...(event ? { annotations: Transaction.userEvent.of(event) } : {}),
  });
  document.state = transaction.state;
  return transaction;
}

export function sourceDocument(id: string, initialContent: string) {
  const document = getDocument(id, initialContent);
  return {
    get: () => document.state.doc.toString(),
    attach(view: EditorView, viewId: string) {
      document.views.add(view);
      if (!view.state.doc.eq(document.state.doc)) {
        view.update([
          view.state.update({
            changes: { from: 0, to: view.state.doc.length, insert: document.state.doc.toString() },
            annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)],
          }),
        ]);
      }
      const position = document.positions.get(viewId);
      if (position) {
        view.update([view.state.update({ selection: position.selection })]);
        view.scrollDOM.scrollTop = position.top;
        view.scrollDOM.scrollLeft = position.left;
      }
      return () => {
        document.positions.set(viewId, {
          selection: view.state.selection,
          top: view.scrollDOM.scrollTop,
          left: view.scrollDOM.scrollLeft,
        });
        document.views.delete(view);
      };
    },
    dispatch(transactions: readonly EditorTransaction[], view: EditorView) {
      view.update(transactions);
      let changed = false;
      for (const transaction of transactions) {
        if (!transaction.docChanged) continue;
        const event = transaction.annotation(Transaction.userEvent);
        const canonical = recordChanges(document, transaction.changes, event);
        syncViews(document, canonical.changes, view);
        changed = true;
      }
      return changed ? document.state.doc.toString() : undefined;
    },
    replaceExternal(content: string) {
      if (content === document.externalContent) return;
      document.externalContent = content;
      const before = document.state.doc.toString();
      if (content === before) return;
      let from = 0;
      while (from < before.length && from < content.length && before[from] === content[from])
        from++;
      let oldEnd = before.length;
      let newEnd = content.length;
      while (oldEnd > from && newEnd > from && before[oldEnd - 1] === content[newEnd - 1]) {
        oldEnd--;
        newEnd--;
      }
      const changes = ChangeSet.of(
        { from, to: oldEnd, insert: content.slice(from, newEnd) },
        before.length,
      );
      const canonical = recordChanges(document, changes, 'input.external');
      syncViews(document, canonical.changes);
    },
    undo() {
      let changed = false;
      const available = undo({
        state: document.state,
        dispatch: (transaction) => {
          document.state = transaction.state;
          syncViews(document, transaction.changes);
          changed = transaction.docChanged;
        },
      });
      return available && changed ? document.state.doc.toString() : undefined;
    },
    redo() {
      let changed = false;
      const available = redo({
        state: document.state,
        dispatch: (transaction) => {
          document.state = transaction.state;
          syncViews(document, transaction.changes);
          changed = transaction.docChanged;
        },
      });
      return available && changed ? document.state.doc.toString() : undefined;
    },
  };
}
