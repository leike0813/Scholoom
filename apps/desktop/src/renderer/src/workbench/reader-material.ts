export type ReaderKind = 'pdf' | 'epub' | 'html';

/** 共同附件入口只按材料名称选择阅读实现，tab 身份仍由附件与版本决定。 */
export function readerKindForName(name: string): ReaderKind | undefined {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.epub')) return 'epub';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return undefined;
}
