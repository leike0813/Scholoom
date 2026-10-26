import type { CslMetadata } from '@scholoom/protocol';

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
