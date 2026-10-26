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
