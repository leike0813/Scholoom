import type { ContextItem } from '@scholoom/protocol';

export function ContextItemLocation({ item }: { item: ContextItem }) {
  if (item.kind === 'text' && item.location) {
    const location = item.location;
    return (
      <p>
        {'pageIndex' in location
          ? `原版本第 ${location.pageIndex + 1} 页`
          : `原版本章节 ${location.sectionId} · ${location.start}–${location.end}`}
      </p>
    );
  }
  if (item.kind !== 'region') return null;
  return (
    <p>
      {item.target?.kind === 'image'
        ? '整幅图片'
        : item.target?.kind === 'pdf'
          ? `原版本第 ${item.target.pageIndex + 1} 页`
          : item.target?.kind === 'object'
            ? `图片对象 ${item.target.objectId}`
            : '区域基准未记录'}
      {' · '}
      区域：{Math.round(item.region.x * 100)}%，{Math.round(item.region.y * 100)}%；
      {Math.round(item.region.width * 100)}% × {Math.round(item.region.height * 100)}%
    </p>
  );
}
