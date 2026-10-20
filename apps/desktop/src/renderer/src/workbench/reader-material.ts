export type ReaderKind = 'pdf' | 'epub' | 'html';

/** Shared format classification; ownership and tab identity are independent. */
export function readerKindForName(name: string): ReaderKind | undefined {
  const format = resourceFormatForName(name);
  return format === 'pdf' || format === 'epub' || format === 'html' ? format : undefined;
}

import { resourceFormatForName } from '@scholoom/protocol';
