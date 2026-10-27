import { type CslMetadata, catalogEditorNumericDate } from '@scholoom/protocol';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function catalogDateParts(value: unknown): readonly (readonly number[])[] | undefined {
  if (!record(value) || catalogEditorNumericDate.readOnlyProperties.some((key) => key in value))
    return;
  const dates = value['date-parts'];
  if (
    !Array.isArray(dates) ||
    dates.length < 1 ||
    dates.length > catalogEditorNumericDate.maxEndpoints
  )
    return;
  if (
    !dates.every(
      (parts) =>
        Array.isArray(parts) &&
        parts.length >= 1 &&
        parts.length <= catalogEditorNumericDate.parts.length &&
        parts.every((part, index) => {
          const bounds = catalogEditorNumericDate.parts[index];
          return (
            bounds &&
            typeof part === 'number' &&
            Number.isInteger(part) &&
            part >= bounds.min &&
            part <= bounds.max
          );
        }),
    )
  )
    return;
  return dates as number[][];
}

export function catalogDateCirca(value: unknown): 'unset' | 'true' | 'false' | undefined {
  const flag = record(value) ? value.circa : undefined;
  if (flag === undefined) return 'unset';
  if (!catalogEditorNumericDate.circaValues.some((known) => known === flag)) return;
  return flag === true || flag === 1 ? 'true' : 'false';
}

/** Date precision is a prefix; clearing a middle component must not discard later values. */
export function editCatalogDatePart(
  metadata: CslMetadata,
  key: string,
  index: number,
  value: string,
  endpoint = 0,
): CslMetadata {
  const current = metadata[key];
  const dates = catalogDateParts(current);
  const bounds = catalogEditorNumericDate.parts[index];
  if (
    (current !== undefined && !dates) ||
    !Number.isInteger(index) ||
    !bounds ||
    !Number.isInteger(endpoint) ||
    endpoint < 0 ||
    endpoint >= catalogEditorNumericDate.maxEndpoints ||
    endpoint > (dates?.length ?? 0)
  )
    return metadata;
  const next = (dates ?? []).map((parts) => [...parts]);
  const parts = [...(next[endpoint] ?? [])];
  if (value === '') {
    if (index !== parts.length - 1 || (parts.length === 1 && endpoint === 0 && next.length > 1))
      return metadata;
    parts.pop();
  } else {
    const number = Number(value);
    if (
      !/^\d+$/.test(value) ||
      !Number.isInteger(number) ||
      number < bounds.min ||
      number > bounds.max ||
      index > parts.length
    )
      return metadata;
    parts[index] = number;
  }
  if (parts.length) next[endpoint] = parts;
  else next.splice(endpoint, 1);
  const date = { ...(record(current) ? current : {}) };
  if (next.length) date['date-parts'] = next;
  else delete date['date-parts'];
  return editCatalogField(metadata, key, Object.keys(date).length ? date : '');
}

export function removeCatalogDateEnd(metadata: CslMetadata, key: string): CslMetadata {
  const current = metadata[key],
    dates = catalogDateParts(current);
  if (!record(current) || dates?.length !== 2) return metadata;
  return editCatalogField(metadata, key, { ...current, 'date-parts': [dates[0]] });
}

export function editCatalogDateCirca(
  metadata: CslMetadata,
  key: string,
  value: string,
): CslMetadata {
  const current = metadata[key];
  if (
    !record(current) ||
    !catalogDateParts(current) ||
    catalogDateCirca(current) === undefined ||
    !['unset', 'true', 'false'].includes(value)
  )
    return metadata;
  const date = { ...current };
  if (value === 'unset') delete date.circa;
  else date.circa = typeof current.circa === 'number' ? Number(value === 'true') : value === 'true';
  return editCatalogField(metadata, key, date);
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
