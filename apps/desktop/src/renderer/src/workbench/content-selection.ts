import { contextItemSchema, contextLimits } from '@scholoom/protocol';

export type ContentSelection =
  | { kind: 'text'; quote: string; contentState?: 'draft' }
  | {
      kind: 'object';
      providerId: string;
      objectId: string;
      name: string;
      semantics: string;
      contentState?: 'draft';
    }
  | { error: 'tooLarge' | 'partialFormula' };

function* selectedDomText(node: Node, range: Range): Generator<string> {
  let separator = '';
  let started = false;
  function* visit(current: Node): Generator<string> {
    if (!range.intersectsNode(current)) return;
    const element = current.nodeType === 1 ? (current as Element) : undefined;
    if (element?.matches('button, .markdown-image')) return;
    if (element?.tagName === 'BR') {
      separator += '\n';
      return;
    }
    if (element?.tagName === 'TR') {
      let first = true;
      for (const cell of element.children) {
        if (!cell.matches('td, th') || !range.intersectsNode(cell)) continue;
        if (started && separator) yield separator;
        separator = '';
        if (!first) yield '\t';
        started = true;
        yield* visit(cell);
        first = false;
      }
      if (!first) separator = '\n';
      return;
    }
    const block = element?.matches(
      'p, h1, h2, h3, h4, h5, h6, pre, blockquote, li, dt, dd, div, section, table, thead, tbody, tfoot, tr, caption',
    );
    if (block) separator ||= '\n';
    const text = element?.classList.contains('katex')
      ? (element.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? '')
      : current.nodeType === 3
        ? (current.textContent ?? '').slice(
            current === range.startContainer ? range.startOffset : 0,
            current === range.endContainer ? range.endOffset : undefined,
          )
        : undefined;
    if (text !== undefined) {
      if (text) {
        if (started && separator) yield separator;
        yield text;
        started = true;
        separator = '';
      }
    } else {
      for (const child of current.childNodes) yield* visit(child);
    }
    if (block) separator = '\n';
  }
  yield* visit(node);
}

/** Read only the selected subtree, using the frame's own DOM realm. */
export function domTextSelection(
  container: HTMLElement,
  selection: Selection | null,
): ContentSelection | null {
  if (
    !selection ||
    selection.isCollapsed ||
    !selection.rangeCount ||
    !container.contains(selection.anchorNode) ||
    !container.contains(selection.focusNode)
  )
    return null;
  const range = selection.getRangeAt(0);
  const elementOf = (node: Node) => (node.nodeType === 1 ? (node as Element) : node.parentElement);
  const root = range.commonAncestorContainer;
  if (elementOf(root)?.closest('button, .markdown-image')) return null;
  for (const boundary of [range.startContainer, range.endContainer]) {
    const formula = elementOf(boundary)?.closest('.katex');
    if (!formula || !container.contains(formula)) continue;
    const contents = formula.ownerDocument.createRange();
    contents.selectNodeContents(formula);
    if (
      range.compareBoundaryPoints(0, contents) > 0 ||
      range.compareBoundaryPoints(2, contents) < 0
    )
      return { error: 'partialFormula' };
  }
  const formula = elementOf(root)?.closest('.katex');
  const quote = selectionText(
    selectedDomText(formula && container.contains(formula) ? formula : root, range),
  );
  return quote === null ? { error: 'tooLarge' } : quote ? { kind: 'text', quote } : null;
}

/** Stop reading as soon as the excerpt cannot fit; never return a partial excerpt. */
export function selectionText(parts: Iterable<string>): string | null {
  let text = '';
  for (const part of parts) {
    if (text.length + part.length > contextLimits.excerptUnits) return null;
    text += part;
  }
  return text;
}

export function boundedSelection(selection: ContentSelection): ContentSelection {
  if ('error' in selection) return selection;
  if (
    (selection.kind === 'text' ? selection.quote : selection.semantics).length >
      contextLimits.excerptUnits ||
    (selection.kind === 'object' &&
      selection.name.length > contextItemSchema.anyOf[3].properties.name.maxLength)
  )
    return { error: 'tooLarge' };
  return selection;
}
