import type { CslMetadata } from '@scholoom/protocol';

const datePartMaximum = (index: number) => (index === 0 ? 9999 : index === 1 ? 12 : 31);

export function catalogDateParts(value: unknown): readonly number[] | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !('date-parts' in value)
  )
    return;
  const dates = value['date-parts'];
  if (!Array.isArray(dates) || dates.length !== 1 || !Array.isArray(dates[0])) return;
  const parts: unknown[] = dates[0];
  if (
    parts.length < 1 ||
    parts.length > 3 ||
    !parts.every(
      (part, index) =>
        typeof part === 'number' &&
        Number.isInteger(part) &&
        part >= 1 &&
        part <= datePartMaximum(index),
    )
  )
    return;
  return parts as number[];
}

/** Date precision is a prefix; clearing a middle component must not discard later values. */
export function editCatalogDatePart(
  metadata: CslMetadata,
  key: string,
  index: number,
  value: string,
): CslMetadata {
  const current = metadata[key];
  const parts = catalogDateParts(current);
  if ((current !== undefined && !parts) || index < 0 || index > 2) return metadata;
  const next = [...(parts ?? [])];
  if (value === '') {
    if (index !== next.length - 1) return metadata;
    next.pop();
  } else {
    const number = Number(value);
    if (
      !/^\d+$/.test(value) ||
      !Number.isInteger(number) ||
      number < 1 ||
      number > datePartMaximum(index) ||
      index > next.length
    )
      return metadata;
    next[index] = number;
  }
  return editCatalogField(metadata, key, next.length ? { 'date-parts': [next] } : '');
}

export function editCatalogField(metadata: CslMetadata, key: string, value: unknown): CslMetadata {
  const next = { ...metadata };
  if (value === '' && key !== 'title') delete next[key];
  else next[key] = value;
  return next;
}

export function moveCatalogCreator(
  metadata: CslMetadata,
  role: string,
  index: number,
  targetRole: string,
  targetIndex?: number,
): CslMetadata {
  const original = metadata[role];
  const destination = metadata[targetRole];
  if (
    !Array.isArray(original) ||
    index < 0 ||
    index >= original.length ||
    (destination !== undefined && !Array.isArray(destination))
  )
    throw new Error('创建者名单无法移动。');
  const source = [...original];
  const [creator] = source.splice(index, 1);
  const target = role === targetRole ? source : [...(destination ?? [])];
  target.splice(targetIndex ?? target.length, 0, creator);
  return { ...metadata, [role]: source, [targetRole]: target };
}
